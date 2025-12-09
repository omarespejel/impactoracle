import { describe, it, expect } from 'vitest'
import {
  createRequestSignature,
  verifyRequestSignature,
  hashPrompt
} from '../../src/lib/signing'

describe('Request Signing', () => {
  const testSecret = 'test-hmac-secret-key-256-bits-long!'

  describe('createRequestSignature', () => {
    it('creates deterministic signature for same input', () => {
      const payload = { txHash: '0xabc', orgId: 'test-org' }

      const sig1 = createRequestSignature(payload, testSecret)
      const sig2 = createRequestSignature(payload, testSecret)

      expect(sig1).toBe(sig2)
    })

    it('creates different signatures for different inputs', () => {
      const sig1 = createRequestSignature({ txHash: '0xabc' }, testSecret)
      const sig2 = createRequestSignature({ txHash: '0xdef' }, testSecret)

      expect(sig1).not.toBe(sig2)
    })

    it('returns hex-encoded signature', () => {
      const sig = createRequestSignature({ test: 'data' }, testSecret)
      expect(sig).toMatch(/^[a-f0-9]{64}$/)
    })
  })

  describe('verifyRequestSignature', () => {
    it('returns true for valid signature', () => {
      const payload = { txHash: '0xabc', orgId: 'test-org' }
      const sig = createRequestSignature(payload, testSecret)

      expect(verifyRequestSignature(payload, sig, testSecret)).toBe(true)
    })

    it('returns false for tampered payload', () => {
      const payload = { txHash: '0xabc', orgId: 'test-org' }
      const sig = createRequestSignature(payload, testSecret)

      const tampered = { txHash: '0xabc', orgId: 'hacked-org' }
      expect(verifyRequestSignature(tampered, sig, testSecret)).toBe(false)
    })

    it('returns false for invalid signature', () => {
      const payload = { txHash: '0xabc' }
      expect(verifyRequestSignature(payload, 'invalid-sig', testSecret)).toBe(false)
    })
  })

  describe('hashPrompt', () => {
    it('hashes prompt to 32-byte hex', () => {
      const prompt = 'Generate impact report for donation'
      const hash = hashPrompt(prompt)

      expect(hash).toMatch(/^0x[a-f0-9]{64}$/)
    })

    it('is deterministic', () => {
      const prompt = 'Same prompt'
      expect(hashPrompt(prompt)).toBe(hashPrompt(prompt))
    })
  })
})

