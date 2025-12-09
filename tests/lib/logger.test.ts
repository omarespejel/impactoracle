import { describe, it, expect, vi } from 'vitest'
import { createLogger, sanitizeForLog } from '../../src/lib/logger'

describe('sanitizeForLog', () => {
  it('redacts API keys', () => {
    const input = { apiKey: 'sk-secret-123', data: 'visible' }
    const sanitized = sanitizeForLog(input)

    expect(sanitized.apiKey).toBe('[REDACTED]')
    expect(sanitized.data).toBe('visible')
  })

  it('redacts private keys', () => {
    const input = { privateKey: '0xdeadbeef' }
    expect(sanitizeForLog(input).privateKey).toBe('[REDACTED]')
  })

  it('truncates long strings', () => {
    const input = { data: 'a'.repeat(1000) }
    const sanitized = sanitizeForLog(input)

    expect(sanitized.data.length).toBeLessThan(300)
    expect(sanitized.data).toContain('[TRUNCATED]')
  })

  it('handles nested objects', () => {
    const input = {
      outer: {
        apiKey: 'secret',
        safe: 'visible'
      }
    }
    const sanitized = sanitizeForLog(input)

    expect(sanitized.outer.apiKey).toBe('[REDACTED]')
    expect(sanitized.outer.safe).toBe('visible')
  })
})

describe('createLogger', () => {
  it('includes request ID in all logs', () => {
    const logs: any[] = []
    const logger = createLogger({
      requestId: 'req_123',
      write: (log) => logs.push(JSON.parse(log))
    })

    logger.info('test message')

    expect(logs[0].requestId).toBe('req_123')
  })
})

