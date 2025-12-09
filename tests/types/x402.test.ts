import { describe, it, expect } from 'vitest'
import {
  PaymentRequirementsSchema,
  PaymentPayloadSchema,
  X402ConfigSchema,
  SUPPORTED_NETWORKS
} from '../../src/types/x402'

describe('X402ConfigSchema', () => {
  it('validates correct config', () => {
    const valid = {
      payTo: '0x' + 'a'.repeat(40),
      network: 'base-sepolia',
      priceCents: 5,
      description: 'Impact verification API',
      facilitatorUrl: 'https://x402.org/facilitator'
    }

    expect(() => X402ConfigSchema.parse(valid)).not.toThrow()
  })

  it('rejects invalid network', () => {
    const invalid = {
      payTo: '0x' + 'a'.repeat(40),
      network: 'ethereum-mainnet', // Not supported
      priceCents: 5
    }

    expect(() => X402ConfigSchema.parse(invalid)).toThrow('network')
  })

  it('rejects non-https facilitator URL', () => {
    const invalid = {
      payTo: '0x' + 'a'.repeat(40),
      network: 'base-sepolia',
      priceCents: 5,
      facilitatorUrl: 'http://insecure.com'
    }

    expect(() => X402ConfigSchema.parse(invalid)).toThrow('HTTPS')
  })

  it('defaults to Coinbase facilitator', () => {
    const minimal = {
      payTo: '0x' + 'a'.repeat(40),
      network: 'base-sepolia',
      priceCents: 5
    }

    const parsed = X402ConfigSchema.parse(minimal)
    expect(parsed.facilitatorUrl).toContain('coinbase')
  })
})

describe('PaymentPayloadSchema', () => {
  it('validates EIP-712 signed payload', () => {
    const valid = {
      x402Version: 1,
      scheme: 'exact',
      network: 'base-sepolia',
      payload: {
        signature: '0x' + 'a'.repeat(130),
        authorization: {
          from: '0x' + 'b'.repeat(40),
          to: '0x' + 'c'.repeat(40),
          value: '50000', // 0.05 USDC
          validAfter: Math.floor(Date.now() / 1000) - 60,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          nonce: '0x' + 'd'.repeat(64)
        }
      }
    }

    expect(() => PaymentPayloadSchema.parse(valid)).not.toThrow()
  })

  it('rejects expired authorization', () => {
    const expired = {
      x402Version: 1,
      scheme: 'exact',
      network: 'base-sepolia',
      payload: {
        signature: '0x' + 'a'.repeat(130),
        authorization: {
          from: '0x' + 'b'.repeat(40),
          to: '0x' + 'c'.repeat(40),
          value: '50000',
          validAfter: 0,
          validBefore: Math.floor(Date.now() / 1000) - 100, // Expired
          nonce: '0x' + 'd'.repeat(64)
        }
      }
    }

    expect(() => PaymentPayloadSchema.parse(expired)).toThrow('expired')
  })

  it('rejects validAfter in future', () => {
    const notYetValid = {
      x402Version: 1,
      scheme: 'exact',
      network: 'base-sepolia',
      payload: {
        signature: '0x' + 'a'.repeat(130),
        authorization: {
          from: '0x' + 'b'.repeat(40),
          to: '0x' + 'c'.repeat(40),
          value: '50000',
          validAfter: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
          validBefore: Math.floor(Date.now() / 1000) + 7200,
          nonce: '0x' + 'd'.repeat(64)
        }
      }
    }

    expect(() => PaymentPayloadSchema.parse(notYetValid)).toThrow('not yet valid')
  })
})

describe('SUPPORTED_NETWORKS', () => {
  it('includes Base Sepolia for testnet', () => {
    expect(SUPPORTED_NETWORKS).toContain('base-sepolia')
  })

  it('includes Base mainnet for production', () => {
    expect(SUPPORTED_NETWORKS).toContain('base')
  })
})

