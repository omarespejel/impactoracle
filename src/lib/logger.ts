import pino from 'pino'

const REDACT_KEYS = ['apiKey', 'privateKey', 'secret', 'password', 'authorization']
const MAX_STRING_LENGTH = 250

export function sanitizeForLog(obj: unknown): unknown {
  if (typeof obj !== 'object' || obj === null) {
    if (typeof obj === 'string' && obj.length > MAX_STRING_LENGTH) {
      return obj.slice(0, MAX_STRING_LENGTH) + '[TRUNCATED]'
    }
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLog)
  }

  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (REDACT_KEYS.some(k => key.toLowerCase().includes(k.toLowerCase()))) {
      sanitized[key] = '[REDACTED]'
    } else {
      sanitized[key] = sanitizeForLog(value)
    }
  }

  return sanitized
}

export function createLogger(opts?: { requestId?: string; write?: (log: string) => void }) {
  return pino({
    level: process.env.LOG_LEVEL || 'info',
    base: opts?.requestId ? { requestId: opts.requestId } : undefined,
    redact: {
      paths: REDACT_KEYS.map(k => `*.${k}`),
      censor: '[REDACTED]'
    },
    formatters: {
      level: (label) => ({ level: label })
    }
  }, opts?.write ? { write: opts.write } : undefined)
}

export const logger = createLogger()
