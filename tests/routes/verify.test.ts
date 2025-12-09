import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApp } from '../../src/app'
import { ServiceContainer } from '../../src/services/factory'

describe('POST /v1/verify', () => {
  let app: ReturnType<typeof createApp>
  let mockServices: ServiceContainer

  beforeEach(() => {
    mockServices = {
      eigenai: {
        generateImpactReport: vi.fn().mockResolvedValue({
          metrics: {
            livesImpacted: 50,
            resourceType: 'medical_supplies',
            region: 'Kharkiv Oblast',
            confidence: 85
          },
          confidence: 85,
          proof: {
            eigenaiProof: 'proof_abc123',
            modelId: 'eigenai-v1',
            promptHash: '0x' + 'b'.repeat(64)
          }
        }),
        healthCheck: vi.fn().mockResolvedValue({ healthy: true })
      },
      payment: {
        verifyPayment: vi.fn().mockResolvedValue({
          valid: true,
          payer: '0x' + 'c'.repeat(40),
          amount: '50000'
        }),
        settlePayment: vi.fn().mockResolvedValue({
          success: true,
          txHash: '0x' + 'd'.repeat(64)
        }),
        buildPaymentRequirements: vi.fn().mockReturnValue({
          x402Version: 1,
          schemes: ['exact'],
          network: 'base-sepolia',
          payTo: '0x' + 'a'.repeat(40),
          maxAmountRequired: '50000',
          resource: 'https://api.test.com/v1/verify'
        }),
        getConfig: vi.fn().mockReturnValue({
          payTo: '0x' + 'a'.repeat(40),
          network: 'base-sepolia',
          priceCents: 5
        })
      }
    } as unknown as ServiceContainer

    app = createApp({ services: mockServices })
  })

  const validPayment = {
    x402Version: 1,
    scheme: 'exact',
    network: 'base-sepolia',
    payload: {
      signature: '0x' + 'a'.repeat(130),
      authorization: {
        from: '0x' + 'c'.repeat(40),
        to: '0x' + 'a'.repeat(40),
        value: '50000',
        validAfter: Math.floor(Date.now() / 1000) - 60,
        validBefore: Math.floor(Date.now() / 1000) + 3600,
        nonce: '0x' + 'd'.repeat(64)
      }
    }
  }

  const encodedPayment = Buffer.from(JSON.stringify(validPayment)).toString('base64')

  it('returns 402 without payment', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        orgId: 'ukraine-aid-001'
      })
    })

    expect(res.status).toBe(402)
    const body = await res.json()
    expect(body.x402Version).toBe(1)
  })

  it('returns 400 for invalid request body', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': encodedPayment
      },
      body: JSON.stringify({
        txHash: 'invalid',
        orgId: 'test'
      })
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.success).toBe(false)
    expect(body.error.code).toBe('VALIDATION_ERROR')
  })

  it('returns impact report on valid request', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': encodedPayment
      },
      body: JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        orgId: 'ukraine-aid-001',
        chainId: 84532
      })
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(body.data.impactMetrics.livesImpacted).toBe(50)
    expect(body.data.proof.eigenaiProof).toBe('proof_abc123')
    expect(body.payment.payer).toBeDefined()
  })

  it('includes requestId in response', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-PAYMENT': encodedPayment
      },
      body: JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        orgId: 'ukraine-aid-001'
      })
    })

    const body = await res.json()
    expect(body.requestId).toMatch(/^req_/)
  })
})

describe('GET /v1/health', () => {
  it('returns healthy status', async () => {
    const mockServices = {
      eigenai: {
        healthCheck: vi.fn().mockResolvedValue({ healthy: true })
      },
      payment: {
        getConfig: vi.fn().mockReturnValue({ network: 'base-sepolia' })
      }
    } as unknown as ServiceContainer

    const app = createApp({ services: mockServices })
    
    const res = await app.request('/v1/health')
    
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('healthy')
    expect(body.version).toBeDefined()
  })

  it('returns degraded when EigenAI unhealthy', async () => {
    const mockServices = {
      eigenai: {
        healthCheck: vi.fn().mockResolvedValue({ healthy: false, error: 'timeout' })
      },
      payment: {
        getConfig: vi.fn().mockReturnValue({ network: 'base-sepolia' })
      }
    } as unknown as ServiceContainer

    const app = createApp({ services: mockServices })
    
    const res = await app.request('/v1/health')
    
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('degraded')
  })
})

describe('GET /v1/openapi.json', () => {
  it('returns OpenAPI spec', async () => {
    const app = createApp({})
    
    const res = await app.request('/v1/openapi.json')
    
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.openapi).toBe('3.1.0')
    expect(body.paths['/v1/verify']).toBeDefined()
  })
})
