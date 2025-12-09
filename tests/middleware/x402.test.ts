import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { x402Middleware } from '../../src/middleware/x402'

describe('x402Middleware', () => {
  const app = new Hono()
  
  app.use('/verify', x402Middleware({
    price: '$0.05',
    payTo: '0xYourAddress',
    network: 'base-sepolia'
  }))
  
  app.post('/verify', (c) => c.json({ success: true }))

  it('returns 402 when no payment header', async () => {
    const res = await app.request('/verify', { method: 'POST' })
    expect(res.status).toBe(402)
  })

  it('includes payment requirements in 402 response', async () => {
    const res = await app.request('/verify', { method: 'POST' })
    const body = await res.json()
    expect(body.accepts).toBeDefined()
    expect(body.price).toBe('$0.05')
  })

  it('allows request when valid payment header is present', async () => {
    const res = await app.request('/verify', {
      method: 'POST',
      headers: {
        'X-Payment': 'valid-payment-proof'
      }
    })
    // For now, we'll just check it doesn't return 402
    // In a real implementation, we'd verify the payment
    expect(res.status).not.toBe(402)
  })
})

