import { z } from 'zod'

// === Network configuration ===

export const SUPPORTED_NETWORKS = ['base', 'base-sepolia'] as const
export type SupportedNetwork = typeof SUPPORTED_NETWORKS[number]

export const NetworkSchema = z.enum(SUPPORTED_NETWORKS)

// === USDC contract addresses per network ===

export const USDC_ADDRESSES: Record<SupportedNetwork, `0x${string}`> = {
  'base': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  'base-sepolia': '0x036CbD53842c5426634e7929541eC2318f3dCF7e'
} as const

// === Facilitator URLs ===

export const DEFAULT_FACILITATOR_URLS: Record<SupportedNetwork, string> = {
  'base': 'https://x402.coinbase.com/facilitator',
  'base-sepolia': 'https://x402.coinbase.com/facilitator'
} as const

// === Config schema ===

const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/
const httpsUrlRegex = /^https:\/\/.+/

export const X402ConfigSchema = z.object({
  payTo: z.string().regex(ethereumAddressRegex, 'Invalid payTo address'),
  network: NetworkSchema,
  priceCents: z.number().int().min(1).max(10000), // $0.01 - $100.00
  description: z.string().max(500).optional(),
  facilitatorUrl: z
    .string()
    .regex(httpsUrlRegex, 'HTTPS required for facilitator')
    .optional()
    .transform((url, ctx) => {
      if (url) return url
      // Default based on network from parent
      const network = (ctx as any).parent?.network as SupportedNetwork
      return DEFAULT_FACILITATOR_URLS[network] || DEFAULT_FACILITATOR_URLS['base-sepolia']
    }),
  maxTimeoutSeconds: z.number().int().min(10).max(300).default(60),
  resource: z.string().optional()
})

export type X402Config = z.infer<typeof X402ConfigSchema>

// === Payment payload schemas (EIP-712 based) ===

const EthereumSignatureSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{130}$/, 'Invalid signature length')

const AuthorizationSchema = z.object({
  from: z.string().regex(ethereumAddressRegex),
  to: z.string().regex(ethereumAddressRegex),
  value: z.string().regex(/^\d+$/, 'Value must be numeric string'),
  validAfter: z.number().int(),
  validBefore: z.number().int(),
  nonce: z.string().regex(/^0x[a-fA-F0-9]{64}$/)
}).refine(
  data => data.validBefore > Math.floor(Date.now() / 1000),
  'Authorization expired'
).refine(
  data => data.validAfter <= Math.floor(Date.now() / 1000),
  'Authorization not yet valid'
)

export const PaymentPayloadSchema = z.object({
  x402Version: z.literal(1),
  scheme: z.literal('exact'),
  network: NetworkSchema,
  payload: z.object({
    signature: EthereumSignatureSchema,
    authorization: AuthorizationSchema
  })
})

export type PaymentPayload = z.infer<typeof PaymentPayloadSchema>

// === Payment requirements (402 response) ===

export const PaymentRequirementsSchema = z.object({
  x402Version: z.literal(1),
  schemes: z.array(z.literal('exact')),
  network: NetworkSchema,
  payTo: z.string().regex(ethereumAddressRegex),
  maxAmountRequired: z.string(),
  resource: z.string().url(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
  outputSchema: z.record(z.unknown()).optional(),
  extra: z.object({
    name: z.string(),
    version: z.string()
  }).optional()
})

export type PaymentRequirements = z.infer<typeof PaymentRequirementsSchema>

