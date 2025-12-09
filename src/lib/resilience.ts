import {
  ConsecutiveBreaker,
  ExponentialBackoff,
  retry,
  handleAll,
  circuitBreaker,
  wrap,
  CircuitState
} from 'cockatiel'
import { logger } from './logger'

export class CircuitOpenError extends Error {
  constructor(public readonly serviceName: string) {
    super(`Circuit breaker open for ${serviceName}`)
    this.name = 'CircuitOpenError'
  }
}

interface ResilientClientConfig {
  name: string
  failureThreshold: number
  resetTimeout: number
  maxRetries?: number
  onStateChange?: (event: {
    name: string
    from: string
    to: string
    timestamp: number
  }) => void
}

export function createResilientClient(config: ResilientClientConfig) {
  const {
    name,
    failureThreshold,
    resetTimeout,
    maxRetries = 3,
    onStateChange
  } = config

  // Circuit breaker - opens after consecutive failures
  const breaker = circuitBreaker(handleAll, {
    halfOpenAfter: resetTimeout,
    breaker: new ConsecutiveBreaker(failureThreshold)
  })

  // Retry policy with exponential backoff
  const retryPolicy = retry(handleAll, {
    maxAttempts: maxRetries + 1,
    backoff: new ExponentialBackoff({
      initialDelay: 100,
      maxDelay: 5000
    })
  })

  // Track previous state for change detection
  let previousState = breaker.state

  // Log state changes
  breaker.onStateChange((state) => {
    if (state !== previousState) {
      const stateNames: Record<CircuitState, string> = {
        [CircuitState.Closed]: 'closed',
        [CircuitState.Open]: 'open',
        [CircuitState.HalfOpen]: 'half-open',
        [CircuitState.Isolated]: 'isolated'
      }

      const event = {
        name,
        from: stateNames[previousState],
        to: stateNames[state],
        timestamp: Date.now()
      }

      logger.warn({ circuit: name, state: event.to }, 'Circuit state changed')
      onStateChange?.(event)
      previousState = state
    }
  })

  // Combine policies: retry first, then circuit breaker
  const policy = wrap(retryPolicy, breaker)

  return {
    async execute<T>(fn: () => Promise<T>): Promise<T> {
      try {
        return await policy.execute(fn)
      } catch (err) {
        if (breaker.state === CircuitState.Open) {
          throw new CircuitOpenError(name)
        }
        throw err
      }
    },

    getState() {
      return breaker.state
    }
  }
}

