import { z } from 'zod'

// === Primitives with security constraints ===

export const TxHashSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash')
  .transform(s => s.toLowerCase() as `0x${string}`)

export const USDCAmountSchema = z
  .string()
  .refine(s => /^\d+$/.test(s), 'Must be numeric')
  .refine(s => BigInt(s) > 0n, 'Minimum donation required')
  .refine(s => BigInt(s) <= BigInt(Number.MAX_SAFE_INTEGER), 'Amount too large')

const SAFE_STRING_REGEX = /^[a-zA-Z0-9-_]+$/

export const OrgIdSchema = z
  .string()
  .min(1)
  .max(100)
  .regex(SAFE_STRING_REGEX, 'Invalid characters in org ID')

// === Supported chains (whitelist approach) ===

const SUPPORTED_CHAINS = [84532] as const // Base Sepolia only for now

export const ChainIdSchema = z
  .number()
  .refine(
    (id): id is typeof SUPPORTED_CHAINS[number] =>
      SUPPORTED_CHAINS.includes(id as any),
    'Unsupported chain'
  )

// === Complex types ===

export const OrganizationSchema = z.object({
  id: OrgIdSchema,
  name: z.string().min(1).max(200),
  category: z.enum(['humanitarian', 'medical', 'education', 'infrastructure'])
})

export const VerificationRequestSchema = z.object({
  txHash: TxHashSchema,
  orgId: OrgIdSchema,
  chainId: ChainIdSchema.default(84532)
})

export const ImpactMetricsSchema = z.object({
  livesImpacted: z.number().int().min(0),
  resourceType: z.string().min(1).max(100),
  region: z.string().min(1).max(200).optional()
})

export const ProofSchema = z.object({
  eigenaiProof: z.string().min(1),
  modelId: z.string().min(1),
  promptHash: TxHashSchema
})

export const ImpactReportSchema = z.object({
  requestId: z.string().min(1),
  txHash: TxHashSchema,
  orgId: OrgIdSchema,
  amount: USDCAmountSchema,
  impactMetrics: ImpactMetricsSchema,
  confidence: z.number().min(0).max(100),
  generatedAt: z.number().int().positive(),
  expiresAt: z.number().int().positive(),
  proof: ProofSchema
}).refine(
  data => data.expiresAt > Date.now(),
  'Report expired'
)

// === Type exports ===

export type TxHash = z.infer<typeof TxHashSchema>
export type USDCAmount = z.infer<typeof USDCAmountSchema>
export type OrgId = z.infer<typeof OrgIdSchema>
export type Organization = z.infer<typeof OrganizationSchema>
export type VerificationRequest = z.infer<typeof VerificationRequestSchema>
export type ImpactMetrics = z.infer<typeof ImpactMetricsSchema>
export type ImpactReport = z.infer<typeof ImpactReportSchema>
