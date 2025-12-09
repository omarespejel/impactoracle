import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'
import { createX402Middleware } from '../../src/middleware/x402'
import { PaymentService } from '../../src/services/payment'

describe('x402Middleware', () => {
  let app: Hono
  let mockPaymentService: PaymentService

  beforeEach(() => {
    // Create mock payment service
    mockPaymentService = {
      verifyPayment: vi.fn(),
      settlePayment: vi.fn(),
      buildPaymentRequirements: vi.fn().mockReturnValue({
        x402Version: 1,
        schemes: ['exact'],
        network: 'base-sepolia',
        payTo: '0x' + 'a'.repeat(40),
        maxAmountRequired: '50000',
        resource: 'https://api.test.com/verify'
      }),
      getConfig: vi.fn().mockReturnValue({
        payTo: '0x' + 'a'.repeat(40),
        network: 'base-sepolia',
        priceCents: 5
      })
    } as unknown as PaymentService

    app = new Hono()

    // Apply middleware
    app.use('/v1/verify', createX402Middleware({
      paymentService: mockPaymentService,
      settleBeforeResponse: false // Verify only for most tests
    }))

    app.post('/v1/verify', (c) => c.json({ success: true, data: 'protected' }))
  })

  describe('without X-PAYMENT header', () => {
    it('returns 402 Payment Required', async () => {
      const res = await app.request('/v1/verify', { method: 'POST' })

      expect(res.status).toBe(402)
    })

    it('includes payment requirements in response', async () => {
      const res = await app.request('/v1/verify', { method: 'POST' })
      const body = await res.json()

      expect(body.x402Version).toBe(1)
      expect(body.schemes).toContain('exact')
      expect(body.payTo).toBeDefined()
      expect(body.maxAmountRequired).toBeDefined()
    })

    it('sets correct content-type header', async () => {
      const res = await app.request('/v1/verify', { method: 'POST' })

      expect(res.headers.get('content-type')).toContain('application/json')
    })
  })

  describe('with invalid X-PAYMENT header', () => {
    it('returns 402 for malformed JSON', async () => {
      const res = await app.request('/v1/verify', {
        method: 'POST',
        headers: { 'X-PAYMENT': 'not-valid-json' }
      })

      expect(res.status).toBe(402)
    })

    it('returns 402 for invalid payment structure', async () => {
      const res = await app.request('/v1/verify', {
        method: 'POST',
        headers: {
          'X-PAYMENT': Buffer.from(JSON.stringify({ invalid: true })).toString('base64')
        }
      })

      expect(res.status).toBe(402)
    })
  })

  describe('with valid X-PAYMENT header', () => {
    const validPayment = {
      x402Version: 1,
      scheme: 'exact',
      network: 'base-sepolia',
      payload: {
        signature: '0x' + 'a'.repeat(130),
        authorization: {
          from: '0x' + 'b'.repeat(40),
          to: '0x' + 'a'.repeat(40),
          value: '50000',
          validAfter: Math.floor(Date.now() / 1000) - 60,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: '0x' + 'd'.repeat(64)
        }
      }
    }

    const encodedPayment = Buffer.from(JSON.stringify(validPayment)).toString('base64')

    it('allows request when payment verifies', async () => {
      (mockPaymentService.verifyPayment as any).mockResolvedValueOnce({
        valid: true,
        payer: validPayment.payload.authorization.from,
        amount: validPayment.payload.authorization.value
      })

      const res = await app.request('/v1/verify', {
        method: 'POST',
        headers: { 'X-PAYMENT': encodedPayment }
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.success).toBe(true)
    })

    it('sets payer info in context', async () => {
      (mockPaymentService.verifyPayment as any).mockResolvedValueOnce({
        valid: true,
        payer: validPayment.payload.authorization.from,
        amount: '50000'
      })

      let capturedPayer: string | undefined

      const testApp = new Hono()
      testApp.use('/v1/verify', createX402Middleware({
        paymentService: mockPaymentService,
        settleBeforeResponse: false
      }))
      testApp.post('/v1/verify', (c) => {
        capturedPayer = c.get('x402Payer')
        return c.json({ payer: capturedPayer })
      })

      await testApp.request('/v1/verify', {
        method: 'POST',
        headers: { 'X-PAYMENT': encodedPayment }
      })

      expect(capturedPayer).toBe(validPayment.payload.authorization.from)
    })

    it('returns 402 when payment verification fails', async () => {
      (mockPaymentService.verifyPayment as any).mockResolvedValueOnce({
        valid: false,
        invalidReason: 'insufficient_funds'
      })

      const res = await app.request('/v1/verify', {
        method: 'POST',
        headers: { 'X-PAYMENT': encodedPayment }
      })

      expect(res.status).toBe(402)
      const body = await res.json()
      expect(body.error).toContain('insufficient_funds')
    })
  })

  describe('with settleBeforeResponse: true', () => {
    it('settles payment before returning response', async () => {
      const validPayment = {
        x402Version: 1,
        scheme: 'exact',
        network: 'base-sepolia',
        payload: {
          signature: '0x' + 'a'.repeat(130),
          authorization: {
            from: '0x' + 'b'.repeat(40),
            to: '0x' + 'a'.repeat(40),
            value: '50000',
            validAfter: Math.floor(Date.now() / 1000) - 60,
            validBefore: Math.floor(Date.now() / 1000) + 3600,
            nonce: '0x' + 'd'.repeat(64)
          }
        }
      }
      const encodedPayment = Buffer.from(JSON.stringify(validPayment)).toString('base64')

      const settleApp = new Hono()
      settleApp.use('/v1/verify', createX402Middleware({
        paymentService: mockPaymentService,
        settleBeforeResponse: true
      }))
      settleApp.post('/v1/verify', (c) => c.json({ done: true }))

      ;(mockPaymentService.verifyPayment as any).mockResolvedValueOnce({ valid: true })
      ;(mockPaymentService.settlePayment as any).mockResolvedValueOnce({
        success: true,
        txHash: '0x' + 'e'.repeat(64)
      })

      const res = await settleApp.request('/v1/verify', {
        method: 'POST',
        headers: { 'X-PAYMENT': encodedPayment }
      })

      expect(res.status).toBe(200)
      expect(mockPaymentService.settlePayment).toHaveBeenCalled()
    })

    it('returns 402 if settlement fails', async () => {
      const validPayment = {
        x402Version: 1,
        scheme: 'exact',
        network: 'base-sepolia',
        payload: {
          signature: '0x' + 'a'.repeat(130),
          authorization: {
            from: '0x' + 'b'.repeat(40),
            to: '0x' + 'a'.repeat(40),
            value: '50000',
            validAfter: Math.floor(Date.now() / 1000) - 60,
            validBefore: Math.floor(Date.now() / 1000) + 3600,
            nonce: '0x' + 'd'.repeat(64)
          }
        }
      }
      const encodedPayment = Buffer.from(JSON.stringify(validPayment)).toString('base64')

      const settleApp = new Hono()
      settleApp.use('/v1/verify', createX402Middleware({
        paymentService: mockPaymentService,
        settleBeforeResponse: true
      }))
      settleApp.post('/v1/verify', (c) => c.json({ done: true }))

      ;(mockPaymentService.verifyPayment as any).mockResolvedValueOnce({ valid: true })
      ;(mockPaymentService.settlePayment as any).mockResolvedValueOnce({
        success: false,
        error: 'insufficient_funds'
      })

      const res = await settleApp.request('/v1/verify', {
        method: 'POST',
        headers: { 'X-PAYMENT': encodedPayment }
      })

      expect(res.status).toBe(402)
    })
  })
})
