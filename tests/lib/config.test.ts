import { describe, it, expect, beforeEach } from 'vitest'
import { ConfigSchema, loadConfig, resetConfig } from '../../src/lib/config'

describe('ConfigSchema', () => {
  beforeEach(() => {
    // Clear env for isolation
    delete process.env.PAY_TO_ADDRESS
    delete process.env.EIGENAI_API_KEY
    delete process.env.BASE_SEPOLIA_RPC_URL
    delete process.env.PRICE_CENTS
    delete process.env.NODE_ENV
    delete process.env.EIGENAI_BASE_URL
    resetConfig()
  })

  it('rejects missing required env vars', () => {
    expect(() => loadConfig()).toThrow('PAY_TO_ADDRESS')
  })

  it('rejects invalid ethereum address', () => {
    process.env.PAY_TO_ADDRESS = 'not-an-address'
    process.env.EIGENAI_API_KEY = 'key'
    process.env.BASE_SEPOLIA_RPC_URL = 'https://rpc.example.com'

    expect(() => loadConfig()).toThrow('Invalid ethereum address')
  })

  it('rejects http RPC urls (require https)', () => {
    process.env.PAY_TO_ADDRESS = '0x' + 'a'.repeat(40)
    process.env.EIGENAI_API_KEY = 'key'
    process.env.BASE_SEPOLIA_RPC_URL = 'http://insecure.com'

    expect(() => loadConfig()).toThrow('HTTPS required')
  })

  it('accepts valid config', () => {
    process.env.PAY_TO_ADDRESS = '0x' + 'a'.repeat(40)
    process.env.EIGENAI_API_KEY = 'sk-test-key'
    process.env.BASE_SEPOLIA_RPC_URL = 'https://base-sepolia.g.alchemy.com/v2/xxx'
    process.env.PRICE_CENTS = '5'

    const config = loadConfig()

    expect(config.payToAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(config.priceCents).toBe(5)
  })

  it('defaults price to 5 cents', () => {
    process.env.PAY_TO_ADDRESS = '0x' + 'a'.repeat(40)
    process.env.EIGENAI_API_KEY = 'key'
    process.env.BASE_SEPOLIA_RPC_URL = 'https://rpc.example.com'

    const config = loadConfig()
    expect(config.priceCents).toBe(5)
  })
})

