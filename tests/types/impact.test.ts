import { describe, it, expect } from 'vitest'
import {
  VerificationRequestSchema,
  ImpactReportSchema,
  OrganizationSchema,
  TxHashSchema,
  USDCAmountSchema
} from '../../src/types/impact'

describe('TxHashSchema', () => {
  it('accepts valid 66-char hex hash', () => {
    const valid = '0x' + 'a'.repeat(64)
    expect(TxHashSchema.parse(valid)).toBe(valid)
  })

  it('rejects short hash', () => {
    expect(() => TxHashSchema.parse('0x123')).toThrow()
  })

  it('rejects non-hex characters', () => {
    expect(() => TxHashSchema.parse('0x' + 'g'.repeat(64))).toThrow()
  })

  it('normalizes to lowercase', () => {
    const upper = '0x' + 'A'.repeat(64)
    expect(TxHashSchema.parse(upper)).toBe(upper.toLowerCase())
  })
})

describe('USDCAmountSchema', () => {
  it('accepts valid 6-decimal string', () => {
    expect(USDCAmountSchema.parse('1000000')).toBe('1000000') // 1 USDC
  })

  it('rejects negative amounts', () => {
    expect(() => USDCAmountSchema.parse('-100')).toThrow()
  })

  it('rejects zero', () => {
    expect(() => USDCAmountSchema.parse('0')).toThrow('Minimum donation')
  })

  it('rejects non-numeric strings', () => {
    expect(() => USDCAmountSchema.parse('abc')).toThrow()
  })

  it('rejects amounts exceeding max safe integer', () => {
    expect(() => USDCAmountSchema.parse('99999999999999999999')).toThrow()
  })
})

describe('OrganizationSchema', () => {
  it('accepts valid org id format', () => {
    const valid = {
      id: 'ukraine-aid-001',
      name: 'Ukraine Medical Aid',
      category: 'humanitarian'
    }
    expect(() => OrganizationSchema.parse(valid)).not.toThrow()
  })

  it('rejects org id with special characters', () => {
    expect(() => OrganizationSchema.parse({
      id: 'org<script>',
      name: 'Bad',
      category: 'humanitarian'
    })).toThrow()
  })
})

describe('VerificationRequestSchema', () => {
  const validRequest = {
    txHash: '0x' + 'a'.repeat(64),
    orgId: 'ukraine-aid-001',
    chainId: 84532
  }

  it('accepts valid request', () => {
    expect(() => VerificationRequestSchema.parse(validRequest)).not.toThrow()
  })

  it('defaults chainId to Base Sepolia', () => {
    const { chainId, ...noChain } = validRequest
    const parsed = VerificationRequestSchema.parse(noChain)
    expect(parsed.chainId).toBe(84532)
  })

  it('rejects unsupported chainId', () => {
    expect(() => VerificationRequestSchema.parse({
      ...validRequest,
      chainId: 1 // mainnet not supported yet
    })).toThrow('Unsupported chain')
  })
})

describe('ImpactReportSchema', () => {
  const validReport = {
    requestId: 'req_123',
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
    expiresAt: Date.now() + 86400000, // 24h
    proof: {
      eigenaiProof: 'proof_abc123',
      modelId: 'gpt-oss-120b',
      promptHash: '0x' + 'b'.repeat(64)
    }
  }

  it('accepts valid report', () => {
    expect(() => ImpactReportSchema.parse(validReport)).not.toThrow()
  })

  it('rejects confidence > 100', () => {
    expect(() => ImpactReportSchema.parse({
      ...validReport,
      confidence: 101
    })).toThrow()
  })

  it('rejects confidence < 0', () => {
    expect(() => ImpactReportSchema.parse({
      ...validReport,
      confidence: -5
    })).toThrow()
  })

  it('rejects expired report', () => {
    expect(() => ImpactReportSchema.parse({
      ...validReport,
      expiresAt: Date.now() - 1000 // expired
    })).toThrow('Report expired')
  })

  it('requires proof object with all fields', () => {
    const { proof, ...noProof } = validReport
    expect(() => ImpactReportSchema.parse(noProof)).toThrow()
  })
})
