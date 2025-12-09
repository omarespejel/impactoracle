import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createRateLimiter, RateLimitStore } from '../../src/middleware/ratelimit'

describe('rateLimitMiddleware', () => {
  let app: Hono
  let mockStore: RateLimitStore

  beforeEach(() => {
    // In-memory store for testing
    const store = new Map<string, { count: number; resetAt: number }>()

    mockStore = {
      async increment(key: string, windowMs: number) {
        const now = Date.now()
        const existing = store.get(key)

        if (!existing || existing.resetAt < now) {
          store.set(key, { count: 1, resetAt: now + windowMs })
          return { count: 1, resetAt: now + windowMs }
        }

        existing.count++
        return { count: existing.count, resetAt: existing.resetAt }
      },
      async reset(key: string) {
        store.delete(key)
      }
    }

    app = new Hono()

    app.use('*', createRateLimiter({
      windowMs: 60000, // 1 minute
      max: 5,
      store: mockStore,
      keyGenerator: (c) => c.req.header('x-api-key') || 'anonymous'
    }))

    app.get('/test', (c) => c.json({ ok: true }))
  })

  it('allows requests under limit', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await app.request('/test', {
        headers: { 'x-api-key': 'test-key' }
      })
      expect(res.status).toBe(200)
    }
  })

  it('blocks requests over limit with 429', async () => {
    // Exhaust limit
    for (let i = 0; i < 5; i++) {
      await app.request('/test', {
        headers: { 'x-api-key': 'test-key' }
      })
    }

    // Next request should be blocked
    const res = await app.request('/test', {
      headers: { 'x-api-key': 'test-key' }
    })

    expect(res.status).toBe(429)
  })

  it('includes rate limit headers', async () => {
    const res = await app.request('/test', {
      headers: { 'x-api-key': 'test-key' }
    })

    expect(res.headers.get('X-RateLimit-Limit')).toBe('5')
    expect(res.headers.get('X-RateLimit-Remaining')).toBeDefined()
  })

  it('uses different buckets per key', async () => {
    // Exhaust limit for key A
    for (let i = 0; i < 5; i++) {
      await app.request('/test', {
        headers: { 'x-api-key': 'key-a' }
      })
    }

    // Key B should still have quota
    const res = await app.request('/test', {
      headers: { 'x-api-key': 'key-b' }
    })

    expect(res.status).toBe(200)
  })

  it('includes Retry-After header on 429', async () => {
    for (let i = 0; i < 5; i++) {
      await app.request('/test', {
        headers: { 'x-api-key': 'test-key' }
      })
    }

    const res = await app.request('/test', {
      headers: { 'x-api-key': 'test-key' }
    })

    expect(res.headers.get('Retry-After')).toBeDefined()
  })
})

