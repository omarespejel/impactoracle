import { describe, it, expect, vi, beforeEach } from 'vitest'
import { app } from '../../src/app'

// Mock the services
vi.mock('../../src/services/chain', () => ({
  ChainService: vi.fn().mockImplementation(() => ({
    getDonationFromTx: vi.fn().mockResolvedValue({
      donor: '0x1234567890123456789012345678901234567890' as const,
      amount: BigInt('1000000'),
      orgId: 'ukraine-aid-001'
    })
  }))
}))

vi.mock('../../src/services/eigenai', () => ({
  EigenAIService: vi.fn().mockImplementation(() => ({
    generateReport: vi.fn().mockResolvedValue({
      proof: 'proof123',
      metrics: {
        livesImpacted: 50,
        resourceType: 'medical'
      }
    })
  }))
}))

describe('POST /v1/verify', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    // Set required env vars
    process.env.PAYMENT_PRICE = '$0.05'
    process.env.PAY_TO = '0x0000000000000000000000000000000000000000'
    process.env.BASE_SEPOLIA_RPC = 'https://sepolia.base.org'
    process.env.EIGENAI_API_KEY = 'test-key'
    process.env.EIGENAI_BASE_URL = 'https://api.eigenai.com'
  })

  it('validates request body', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-Payment': 'valid-payment-proof'
      },
      body: JSON.stringify({ invalid: 'body' })
    })
    
    expect(res.status).toBe(400)
  })

  it('returns 402 when no payment header', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        orgId: 'ukraine-aid-001',
        chainId: 84532
      })
    })
    
    expect(res.status).toBe(402)
  })

  it('returns impact report on valid request', async () => {
    const res = await app.request('/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Payment': 'valid-payment-proof'
      },
      body: JSON.stringify({
        txHash: '0x' + 'a'.repeat(64),
        orgId: 'ukraine-aid-001',
        chainId: 84532
      })
    })
    
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.proof).toBeDefined()
    expect(body.impactMetrics).toBeDefined()
    expect(body.impactMetrics.livesImpacted).toBe(50)
  })
})

