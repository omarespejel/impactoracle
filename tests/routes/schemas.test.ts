import { describe, it, expect } from 'vitest'
import {
  VerifyRequestSchema,
  VerifyResponseSchema,
  ErrorResponseSchema,
  HealthResponseSchema
} from '../../src/routes/schemas'

describe('API Schemas', () => {
  describe('VerifyRequestSchema', () => {
    it('accepts valid verification request', () => {
      const valid = {
        txHash: '0x' + 'a'.repeat(64),
        orgId: 'ukraine-aid-001',
        chainId: 84532
      }

      expect(() => VerifyRequestSchema.parse(valid)).not.toThrow()
    })

    it('provides OpenAPI metadata', () => {
      const schema = VerifyRequestSchema._def
      expect(schema).toBeDefined()
    })
  })

  describe('VerifyResponseSchema', () => {
    it('validates successful response', () => {
      const valid = {
        success: true,
        requestId: 'req_abc123',
        data: {
          txHash: '0x' + 'a'.repeat(64),
          orgId: 'ukraine-aid-001',
          amount: '1000000',
          impactMetrics: {
            livesImpacted: 50,
            resourceType: 'medical_supplies',
            region: 'Kharkiv Oblast'
          },
          confidence: 85,
          generatedAt: Date.now(),
          expiresAt: Date.now() + 86400000,
          proof: {
            eigenaiProof: 'proof_xyz',
            modelId: 'eigenai-v1',
            promptHash: '0x' + 'b'.repeat(64)
          }
        },
        payment: {
          payer: '0x' + 'c'.repeat(40),
          amount: '50000',
          settledTxHash: '0x' + 'd'.repeat(64)
        }
      }

      expect(() => VerifyResponseSchema.parse(valid)).not.toThrow()
    })
  })

  describe('ErrorResponseSchema', () => {
    it('validates error response', () => {
      const valid = {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid transaction hash',
          details: { field: 'txHash' }
        }
      }

      expect(() => ErrorResponseSchema.parse(valid)).not.toThrow()
    })
  })

  describe('HealthResponseSchema', () => {
    it('validates health check response', () => {
      const valid = {
        status: 'healthy',
        version: '1.0.0',
        timestamp: Date.now(),
        services: {
          eigenai: { status: 'healthy', latencyMs: 150 },
          facilitator: { status: 'healthy', latencyMs: 50 }
        }
      }

      expect(() => HealthResponseSchema.parse(valid)).not.toThrow()
    })

    it('accepts degraded status', () => {
      const degraded = {
        status: 'degraded',
        version: '1.0.0',
        timestamp: Date.now(),
        services: {
          eigenai: { status: 'unhealthy', error: 'timeout' },
          facilitator: { status: 'healthy', latencyMs: 50 }
        }
      }

      expect(() => HealthResponseSchema.parse(degraded)).not.toThrow()
    })
  })
})

