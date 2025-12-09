import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaymentService, PaymentVerificationResult } from '../../src/services/payment'
import { PaymentRequiredError } from '../../src/lib/errors'

describe('PaymentService', () => {
  let service: PaymentService
  let mockFacilitator: any

  beforeEach(() => {
    mockFacilitator = {
      verify: vi.fn(),
      settle: vi.fn()
    }

    service = new PaymentService({
      payTo: '0x' + 'a'.repeat(40),
      network: 'base-sepolia',
      priceCents: 5,
      facilitator: mockFacilitator
    })
  })

  describe('verifyPayment', () => {
    const validPayload = {
      x402Version: 1 as const,
      scheme: 'exact' as const,
      network: 'base-sepolia' as const,
      payload: {
        signature: '0x' + 'a'.repeat(130),
        authorization: {
          from: '0x' + 'b'.repeat(40),
          to: '0x' + 'a'.repeat(40), // Must match payTo
          value: '50000', // 0.05 USDC (5 cents)
          validAfter: Math.floor(Date.now() / 1000) - 60,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: '0x' + 'd'.repeat(64)
        }
      }
    }

    it('returns valid result for correct payment', async () => {
      mockFacilitator.verify.mockResolvedValueOnce({
        valid: true,
        invalidReason: null
      })

      const result = await service.verifyPayment(validPayload)

      expect(result.valid).toBe(true)
      expect(result.payer).toBe(validPayload.payload.authorization.from)
    })

    it('rejects payment below minimum', async () => {
      const underpaid = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: {
            ...validPayload.payload.authorization,
            value: '1000' // Only 0.001 USDC
          }
        }
      }

      const result = await service.verifyPayment(underpaid)

      expect(result.valid).toBe(false)
      expect(result.invalidReason).toContain('insufficient')
    })

    it('rejects payment to wrong address', async () => {
      const wrongRecipient = {
        ...validPayload,
        payload: {
          ...validPayload.payload,
          authorization: {
            ...validPayload.payload.authorization,
            to: '0x' + 'f'.repeat(40) // Wrong address
          }
        }
      }

      const result = await service.verifyPayment(wrongRecipient)

      expect(result.valid).toBe(false)
      expect(result.invalidReason).toContain('recipient')
    })

    it('calls facilitator verify with correct params', async () => {
      mockFacilitator.verify.mockResolvedValueOnce({ valid: true })

      await service.verifyPayment(validPayload)

      expect(mockFacilitator.verify).toHaveBeenCalledWith(
        expect.objectContaining({
          payload: validPayload.payload,
          paymentRequirements: expect.any(Object)
        })
      )
    })

    it('handles facilitator errors gracefully', async () => {
      mockFacilitator.verify.mockRejectedValueOnce(new Error('Network error'))

      const result = await service.verifyPayment(validPayload)

      expect(result.valid).toBe(false)
      expect(result.invalidReason).toContain('verification failed')
    })
  })

  describe('settlePayment', () => {
    it('settles valid payment on-chain', async () => {
      const paymentPayload = {
        x402Version: 1 as const,
        scheme: 'exact' as const,
        network: 'base-sepolia' as const,
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

      mockFacilitator.settle.mockResolvedValueOnce({
        success: true,
        txHash: '0x' + 'e'.repeat(64)
      })

      const result = await service.settlePayment(paymentPayload)

      expect(result.success).toBe(true)
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('returns failure for rejected settlement', async () => {
      mockFacilitator.settle.mockResolvedValueOnce({
        success: false,
        error: 'insufficient_funds'
      })

      const result = await service.settlePayment({
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
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('insufficient_funds')
    })
  })

  describe('buildPaymentRequirements', () => {
    it('returns valid 402 response structure', () => {
      const requirements = service.buildPaymentRequirements(
        'https://api.impactoracle.xyz/v1/verify'
      )

      expect(requirements.x402Version).toBe(1)
      expect(requirements.schemes).toContain('exact')
      expect(requirements.network).toBe('base-sepolia')
      expect(requirements.payTo).toBe('0x' + 'a'.repeat(40))
      expect(requirements.maxAmountRequired).toBe('50000') // 5 cents in USDC
    })

    it('includes resource URL', () => {
      const requirements = service.buildPaymentRequirements(
        'https://api.impactoracle.xyz/v1/verify'
      )

      expect(requirements.resource).toBe('https://api.impactoracle.xyz/v1/verify')
    })
  })
})

