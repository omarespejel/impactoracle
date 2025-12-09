import { describe, it, expect } from 'vitest'
import { createServices, ServiceContainer } from '../../src/services/factory'

describe('ServiceContainer', () => {
  it('creates all services with config', () => {
    const services = createServices({
      eigenai: {
        apiKey: 'test-key',
        baseUrl: 'https://api.eigencloud.xyz/v1',
        model: 'eigenai-v1',
        maxTokens: 1000
      }
    })
    expect(services.eigenai).toBeDefined()
    expect(typeof services.eigenai.generateImpactReport).toBe('function')
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
    const services = createServices({
      eigenai: { apiKey: '', baseUrl: '', model: '', maxTokens: 0 }
    }, { eigenai: mockEigenai })
    expect(services.eigenai).toBe(mockEigenai)
  })
})

