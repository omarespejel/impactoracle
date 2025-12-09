import { describe, it, expect, vi } from 'vitest'
import { createServices, ServiceContainer } from '../../src/services/factory'

describe('ServiceContainer', () => {
  const mockFacilitator = {
    verify: vi.fn(),
    settle: vi.fn()
  }

  it('creates all services with config', () => {
    const services = createServices({
      eigenai: {
        apiKey: 'test-key',
        baseUrl: 'https://api.eigencloud.xyz/v1',
        model: 'eigenai-v1',
        maxTokens: 1000
      },
      x402: {
        payTo: '0x' + 'a'.repeat(40),
        network: 'base-sepolia',
        priceCents: 5,
        facilitator: mockFacilitator as any
      }
    })
    expect(services.eigenai).toBeDefined()
    expect(services.payment).toBeDefined()
    expect(typeof services.eigenai.generateImpactReport).toBe('function')
    expect(typeof services.payment.verifyPayment).toBe('function')
  })

  it('supports mock injection for testing', () => {
    const mockEigenai = {
      generateImpactReport: async () => ({
        metrics: { livesImpacted: 100, resourceType: 'test', confidence: 90 },
        confidence: 90,
        proof: { eigenaiProof: 'mock', modelId: 'mock', promptHash: '0x' + 'a'.repeat(64) as `0x${string}` }
      }),
      healthCheck: async () => ({ healthy: true })
    }

    const mockPayment = {
      verifyPayment: vi.fn(),
      settlePayment: vi.fn(),
      buildPaymentRequirements: vi.fn(),
      getConfig: vi.fn()
    }

    const services = createServices({
      eigenai: { apiKey: '', baseUrl: '', model: '', maxTokens: 0 },
      x402: {
        payTo: '0x' + 'a'.repeat(40),
        network: 'base-sepolia',
        priceCents: 5,
        facilitator: mockFacilitator as any
      }
    }, { eigenai: mockEigenai as any, payment: mockPayment as any })
    expect(services.eigenai).toBe(mockEigenai)
    expect(services.payment).toBe(mockPayment)
  })
})

