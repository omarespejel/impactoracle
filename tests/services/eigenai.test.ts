import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EigenAIService, EigenAIConfig } from '../../src/services/eigenai'
import { EigenAIError } from '../../src/lib/errors'

describe('EigenAIService', () => {
  let mockFetch: ReturnType<typeof vi.spyOn>

  const config: EigenAIConfig = {
    apiKey: 'test-api-key',
    baseUrl: 'https://api.eigencloud.xyz/v1',
    model: 'eigenai-v1',
    maxTokens: 1000
  }

  beforeEach(() => {
    // Ensure fetch is properly mocked
    mockFetch = vi.spyOn(global, 'fetch') as ReturnType<typeof vi.spyOn>
  })

  afterEach(() => {
    vi.restoreAllMocks()
    mockFetch.mockReset()
  })

  // Helper to create fresh service instance for each test
  // Use high failure threshold to prevent circuit opening during tests
  const createService = (overrides?: Partial<EigenAIConfig>) => {
    return new EigenAIService({
      ...config,
      failureThreshold: 100, // High threshold for tests
      resetTimeout: 100, // Short timeout for tests
      ...overrides
    })
  }

  describe('generateImpactReport', () => {
    const validInput = {
      txHash: '0x' + 'a'.repeat(64),
      orgId: 'ukraine-aid-001',
      amount: '1000000',
      donor: '0x' + 'b'.repeat(40),
      timestamp: 1702000000
    }

    it('returns structured report with proof', async () => {
      const service = createService()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-eigen-proof': 'proof_abc123',
          'x-eigen-model': 'eigenai-v1'
        }),
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                livesImpacted: 50,
                resourceType: 'medical_supplies',
                region: 'Kharkiv Oblast',
                confidence: 85
              })
            },
            finish_reason: 'stop'
          }],
          usage: { prompt_tokens: 100, completion_tokens: 50 }
        })
      })

      const result = await service.generateImpactReport(validInput)

      expect(result.metrics.livesImpacted).toBe(50)
      expect(result.metrics.resourceType).toBe('medical_supplies')
      expect(result.proof.eigenaiProof).toBe('proof_abc123')
      expect(result.proof.modelId).toBe('eigenai-v1')
      expect(result.confidence).toBe(85)
    })

    it('includes prompt hash in proof for audit', async () => {
      const service = createService()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({
          'x-eigen-proof': 'proof_xyz'
        }),
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                livesImpacted: 10,
                resourceType: 'food',
                confidence: 70
              })
            }
          }]
        })
      })

      const result = await service.generateImpactReport(validInput)

      expect(result.proof.promptHash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('validates AI response structure', async () => {
      // Disable retries for this test
      const service = createService({ failureThreshold: 100, resetTimeout: 100 })
      const mockResponse = {
        ok: true,
        headers: new Headers({ 'x-eigen-proof': 'proof' }),
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                // Missing required fields
                someRandomField: 'value'
              })
            }
          }]
        })
      } as Response
      // Mock multiple times in case of retries
      mockFetch.mockResolvedValue(mockResponse)

      await expect(service.generateImpactReport(validInput))
        .rejects.toThrow('Invalid AI response structure')
    })

    it('throws EigenAIError on API failure', async () => {
      const service = createService({ failureThreshold: 100, resetTimeout: 100 })
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Rate Limited',
        json: async () => ({ error: { message: 'Too many requests' } })
      } as Response
      // Mock multiple times in case of retries
      mockFetch.mockResolvedValue(mockResponse)

      await expect(service.generateImpactReport(validInput))
        .rejects.toThrow(EigenAIError)
    })

    it('throws when proof header missing', async () => {
      const service = createService({ failureThreshold: 100, resetTimeout: 100 })
      const mockResponse = {
        ok: true,
        headers: new Headers({}), // No proof header
        json: async () => ({
          choices: [{ message: { content: '{}' } }]
        })
      } as Response
      // Mock multiple times in case of retries
      mockFetch.mockResolvedValue(mockResponse)

      await expect(service.generateImpactReport(validInput))
        .rejects.toThrow('Missing verification proof')
    })

    it('includes request signature in headers', async () => {
      const serviceWithSecret = createService({ signingSecret: 'test-secret' })

      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ 'x-eigen-proof': 'proof' }),
        json: async () => ({
          choices: [{
            message: {
              content: JSON.stringify({
                livesImpacted: 10,
                resourceType: 'shelter',
                confidence: 60
              })
            }
          }]
        })
      })

      await serviceWithSecret.generateImpactReport(validInput)

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Request-Signature': expect.stringMatching(/^[a-f0-9]{64}$/)
          })
        })
      )
    })
  })

  describe('health check', () => {
    it('returns healthy when API responds', async () => {
      const service = createService()
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: ['eigenai-v1'] })
      })

      const health = await service.healthCheck()

      expect(health.healthy).toBe(true)
    })

    it('returns unhealthy on timeout', async () => {
      const service = createService()
      mockFetch.mockImplementationOnce(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 100)
        )
      )

      const health = await service.healthCheck()

      expect(health.healthy).toBe(false)
      expect(health.error).toContain('timeout')
    })
  })
})
