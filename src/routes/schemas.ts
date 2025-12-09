import { z } from '@hono/zod-openapi'

// === Primitives with OpenAPI metadata ===

export const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/)
  .transform(s => s.toLowerCase())
  .openapi({
    example: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    description: 'Ethereum transaction hash (66 characters, 0x-prefixed)'
  })

export const OrgIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(/^[a-zA-Z0-9-_]+$/)
  .openapi({
    example: 'ukraine-aid-001',
    description: 'Organization identifier (alphanumeric with hyphens/underscores)'
  })

export const ChainIdSchema = z
  .number()
  .int()
  .refine(id => [84532, 8453].includes(id), 'Unsupported chain')
  .default(84532)
  .openapi({
    example: 84532,
    description: 'Chain ID (84532 = Base Sepolia, 8453 = Base Mainnet)'
  })

export const EthAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/)
  .openapi({
    example: '0x1234567890123456789012345678901234567890',
    description: 'Ethereum address (42 characters, 0x-prefixed)'
  })

// === Request schemas ===

export const VerifyRequestSchema = z.object({
  txHash: TxHashSchema,
  orgId: OrgIdSchema,
  chainId: ChainIdSchema
}).openapi('VerifyRequest')

// === Response schemas ===

export const ImpactMetricsSchema = z.object({
  livesImpacted: z.number().int().min(0).openapi({ example: 50 }),
  resourceType: z.string().openapi({ example: 'medical_supplies' }),
  region: z.string().optional().openapi({ example: 'Kharkiv Oblast' })
}).openapi('ImpactMetrics')

export const ProofSchema = z.object({
  eigenaiProof: z.string().openapi({ example: 'proof_abc123xyz' }),
  modelId: z.string().openapi({ example: 'eigenai-v1' }),
  promptHash: TxHashSchema
}).openapi('Proof')

export const ImpactReportSchema = z.object({
  txHash: TxHashSchema,
  orgId: OrgIdSchema,
  amount: z.string().openapi({ example: '1000000', description: 'USDC amount (6 decimals)' }),
  impactMetrics: ImpactMetricsSchema,
  confidence: z.number().min(0).max(100).openapi({ example: 85 }),
  generatedAt: z.number().int().openapi({ example: 1702000000000 }),
  expiresAt: z.number().int().openapi({ example: 1702086400000 }),
  proof: ProofSchema
}).openapi('ImpactReport')

export const PaymentInfoSchema = z.object({
  payer: EthAddressSchema,
  amount: z.string().openapi({ example: '50000', description: 'USDC paid (6 decimals)' }),
  settledTxHash: TxHashSchema.optional()
}).openapi('PaymentInfo')

export const VerifyResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  requestId: z.string().openapi({ example: 'req_abc123' }),
  data: ImpactReportSchema,
  payment: PaymentInfoSchema
}).openapi('VerifyResponse')

// === Error schemas ===

// Base schema without openapi for nesting
const ErrorDetailBaseSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.any().optional()
})

// OpenAPI version for standalone use
export const ErrorDetailSchema = ErrorDetailBaseSchema.openapi('ErrorDetail', {
  example: {
    code: 'VALIDATION_ERROR',
    message: 'Invalid transaction hash format'
  }
})

// Note: Using base schema without openapi() to avoid nested openapi issues
// The schema still validates correctly, OpenAPI metadata added at route level
export const ErrorResponseSchema = z.object({
  success: z.boolean(),
  error: ErrorDetailBaseSchema
})

// === Health schemas ===

export const ServiceHealthSchema = z.object({
  status: z.enum(['healthy', 'unhealthy']),
  latencyMs: z.number().optional(),
  error: z.string().optional()
}).openapi('ServiceHealth')

export const HealthResponseSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  version: z.string().openapi({ example: '1.0.0' }),
  timestamp: z.number().int(),
  services: z.object({
    eigenai: ServiceHealthSchema,
    facilitator: ServiceHealthSchema
  })
}).openapi('HealthResponse')

// === Payment Required (402) schema ===

export const PaymentRequiredSchema = z.object({
  x402Version: z.literal(1),
  schemes: z.array(z.literal('exact')),
  network: z.string(),
  payTo: EthAddressSchema,
  maxAmountRequired: z.string(),
  resource: z.string().url(),
  description: z.string().optional(),
  error: z.string().optional()
}).openapi('PaymentRequired')

