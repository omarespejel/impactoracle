export abstract class AppError extends Error {
  abstract readonly statusCode: number
  abstract readonly code: string

  constructor(
    message: string,
    public readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = this.constructor.name
    // Capture stack trace if available (Node.js)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400
  readonly code = 'VALIDATION_ERROR'
}

export class PaymentRequiredError extends AppError {
  readonly statusCode = 402
  readonly code = 'PAYMENT_REQUIRED'
}

export class NotFoundError extends AppError {
  readonly statusCode = 404
  readonly code = 'NOT_FOUND'
}

export class ChainError extends AppError {
  readonly statusCode = 502
  readonly code = 'CHAIN_ERROR'
}

export class EigenAIError extends AppError {
  readonly statusCode = 503
  readonly code = 'EIGENAI_ERROR'
}

export class RateLimitError extends AppError {
  readonly statusCode = 429
  readonly code = 'RATE_LIMITED'
}

// Safe error serialization - never leak internals
export function errorToResponse(err: unknown): {
  error: { code: string; message: string; details?: Record<string, unknown> }
} {
  if (err instanceof AppError) {
    return {
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      }
    }
  }

  // Unknown error - hide details
  return {
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }
}

