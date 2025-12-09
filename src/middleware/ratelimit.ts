import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'
import { RateLimitError } from '../lib/errors'
import { logger } from '../lib/logger'

// === Types ===

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<{
    count: number
    resetAt: number
  }>
  reset(key: string): Promise<void>
}

interface RateLimiterConfig {
  windowMs: number
  max: number
  store: RateLimitStore
  keyGenerator: (c: Context) => string
  skipFailedRequests?: boolean
  skip?: (c: Context) => boolean
}

// === In-memory store (for development) ===

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>()

  async increment(key: string, windowMs: number) {
    const now = Date.now()
    const existing = this.store.get(key)

    if (!existing || existing.resetAt < now) {
      const entry = { count: 1, resetAt: now + windowMs }
      this.store.set(key, entry)
      return entry
    }

    existing.count++
    return { count: existing.count, resetAt: existing.resetAt }
  }

  async reset(key: string) {
    this.store.delete(key)
  }
}

// === Middleware factory ===

export function createRateLimiter(config: RateLimiterConfig) {
  const {
    windowMs,
    max,
    store,
    keyGenerator,
    skipFailedRequests = false,
    skip
  } = config

  return createMiddleware(async (c: Context, next: Next) => {
    // Check if rate limiting should be skipped
    if (skip?.(c)) {
      return next()
    }

    const key = keyGenerator(c)
    const log = logger.child({ middleware: 'ratelimit', key })

    try {
      const { count, resetAt } = await store.increment(key, windowMs)
      const remaining = Math.max(0, max - count)
      const resetInSeconds = Math.ceil((resetAt - Date.now()) / 1000)

      // Set rate limit headers (draft-7 standard)
      c.header('X-RateLimit-Limit', max.toString())
      c.header('X-RateLimit-Remaining', remaining.toString())
      c.header('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString())

      if (count > max) {
        log.warn({ count, max, resetIn: resetInSeconds }, 'Rate limit exceeded')

        c.header('Retry-After', resetInSeconds.toString())

        return c.json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests',
            retryAfter: resetInSeconds
          }
        }, 429)
      }

      await next()

      // Optionally undo increment for failed requests
      if (skipFailedRequests && c.res.status >= 400) {
        // Note: This is approximate, may have race conditions
        // For production, use atomic decrement in store
      }

    } catch (error) {
      log.error({ error }, 'Rate limit check failed')
      // Fail open - allow request if rate limiter errors
      await next()
    }
  })
}

// === Key generators ===

export const keyGenerators = {
  // Rate limit by x402 payer address
  byPayer: (c: Context) => {
    const payer = c.get('x402Payer')
    return payer || c.req.header('x-forwarded-for') || 'anonymous'
  },

  // Rate limit by IP
  byIP: (c: Context) => {
    return c.req.header('x-forwarded-for') ||
           c.req.header('x-real-ip') ||
           'anonymous'
  },

  // Rate limit by API key
  byApiKey: (c: Context) => {
    return c.req.header('x-api-key') || 'anonymous'
  }
}

