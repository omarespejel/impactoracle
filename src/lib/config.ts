import { z } from 'zod'

const ethereumAddressRegex = /^0x[a-fA-F0-9]{40}$/

const httpsUrlRegex = /^https:\/\/.+/

export const ConfigSchema = z.object({
  payToAddress: z
    .string()
    .regex(ethereumAddressRegex, 'Invalid ethereum address'),
  eigenaiApiKey: z
    .string()
    .min(1, 'EIGENAI_API_KEY required'),
  eigenaiBaseUrl: z
    .string()
    .url()
    .default('https://api.eigenai.xyz/v1'),
  baseSepoliaRpcUrl: z
    .string()
    .regex(httpsUrlRegex, 'HTTPS required for RPC'),
  priceCents: z
    .number()
    .int()
    .min(1)
    .max(100)
    .default(5),
  nodeEnv: z
    .enum(['development', 'test', 'production'])
    .default('development')
})

export type Config = z.infer<typeof ConfigSchema>

// Singleton pattern - config loaded once at startup
let _config: Config | null = null

export function loadConfig(): Config {
  if (_config) return _config

  const result = ConfigSchema.safeParse({
    payToAddress: process.env.PAY_TO_ADDRESS,
    eigenaiApiKey: process.env.EIGENAI_API_KEY,
    eigenaiBaseUrl: process.env.EIGENAI_BASE_URL,
    baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL,
    priceCents: process.env.PRICE_CENTS
      ? parseInt(process.env.PRICE_CENTS, 10)
      : undefined,
    nodeEnv: process.env.NODE_ENV
  })

  if (!result.success) {
    const errors = result.error.issues.map(e => {
      const path = e.path.length > 0 ? e.path.join('.') : 'root'
      // Map schema field names to env var names for better error messages
      const envVarMap: Record<string, string> = {
        payToAddress: 'PAY_TO_ADDRESS',
        eigenaiApiKey: 'EIGENAI_API_KEY',
        eigenaiBaseUrl: 'EIGENAI_BASE_URL',
        baseSepoliaRpcUrl: 'BASE_SEPOLIA_RPC_URL',
        priceCents: 'PRICE_CENTS',
        nodeEnv: 'NODE_ENV'
      }
      const envVar = envVarMap[path] || path
      return `${envVar}: ${e.message}`
    })
    throw new Error(`Config validation failed:\n${errors.join('\n')}`)
  }

  _config = result.data
  return _config
}

// For testing - reset singleton
export function resetConfig(): void {
  _config = null
}

