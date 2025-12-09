import { z } from 'zod'
import { createResilientClient } from '../lib/resilience'
import { createRequestSignature, hashPrompt } from '../lib/signing'
import { EigenAIError } from '../lib/errors'
import { logger } from '../lib/logger'

// === Response validation schemas ===

const AIMetricsSchema = z.object({
  livesImpacted: z.number().int().min(0),
  resourceType: z.string().min(1),
  region: z.string().optional(),
  confidence: z.number().min(0).max(100)
})

const OpenAIResponseSchema = z.object({
  choices: z.array(z.object({
    message: z.object({
      content: z.string()
    }),
    finish_reason: z.string().optional()
  })).min(1),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number()
  }).optional()
})

// === Types ===

export interface EigenAIConfig {
  apiKey: string
  baseUrl: string
  model: string
  maxTokens: number
  signingSecret?: string
  failureThreshold?: number // For testing
  resetTimeout?: number // For testing
}

export interface ImpactReportInput {
  txHash: string
  orgId: string
  amount: string
  donor: string
  timestamp: number
}

export interface GeneratedReport {
  metrics: z.infer<typeof AIMetricsSchema>
  confidence: number
  proof: {
    eigenaiProof: string
    modelId: string
    promptHash: `0x${string}`
  }
  usage?: {
    promptTokens: number
    completionTokens: number
  }
}

// === Service Implementation ===

export class EigenAIService {
  private client: ReturnType<typeof createResilientClient>
  private config: EigenAIConfig

  constructor(config: EigenAIConfig) {
    this.config = config
    this.client = createResilientClient({
      name: 'eigenai',
      failureThreshold: config.failureThreshold ?? 3,
      resetTimeout: config.resetTimeout ?? 30000,
      maxRetries: 2,
      onStateChange: (event) => {
        logger.warn({ event }, 'EigenAI circuit state changed')
      }
    })
  }

  async generateImpactReport(input: ImpactReportInput): Promise<GeneratedReport> {
    const prompt = this.buildPrompt(input)
    const promptHash = hashPrompt(prompt)

    // Create request signature for audit trail
    const requestSignature = this.config.signingSecret
      ? createRequestSignature(input, this.config.signingSecret)
      : undefined

    return this.client.execute(async () => {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...(requestSignature && { 'X-Request-Signature': requestSignature })
        },
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: 0, // Deterministic for verifiability
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content: `You are an impact verification oracle. Analyze donation data and estimate humanitarian impact. Always respond with valid JSON matching this schema: { livesImpacted: number, resourceType: string, region?: string, confidence: number (0-100) }`
            },
            { role: 'user', content: prompt }
          ]
        })
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new EigenAIError(
          `API error: ${response.statusText}`,
          { status: response.status, error }
        )
      }

      // Extract proof from headers (EigenAI specific)
      const eigenProof = response.headers.get('x-eigen-proof')
      const modelId = response.headers.get('x-eigen-model') || this.config.model

      if (!eigenProof) {
        throw new EigenAIError('Missing verification proof', {
          headers: Object.fromEntries(response.headers.entries())
        })
      }

      // Parse and validate response
      const data = await response.json()
      const parsed = OpenAIResponseSchema.safeParse(data)

      if (!parsed.success) {
        throw new EigenAIError('Invalid API response', {
          errors: parsed.error.issues
        })
      }

      // Parse AI-generated content
      const content = parsed.data.choices[0].message.content
      let metrics: z.infer<typeof AIMetricsSchema>

      try {
        const parsedContent = JSON.parse(content)
        const validated = AIMetricsSchema.safeParse(parsedContent)

        if (!validated.success) {
          throw new EigenAIError('Invalid AI response structure', {
            content,
            errors: validated.error.issues
          })
        }

        metrics = validated.data
      } catch (e) {
        if (e instanceof EigenAIError) throw e
        throw new EigenAIError('Failed to parse AI response', { content })
      }

      return {
        metrics,
        confidence: metrics.confidence,
        proof: {
          eigenaiProof: eigenProof,
          modelId,
          promptHash
        },
        usage: parsed.data.usage ? {
          promptTokens: parsed.data.usage.prompt_tokens,
          completionTokens: parsed.data.usage.completion_tokens
        } : undefined
      }
    })
  }

  async healthCheck(): Promise<{ healthy: boolean; error?: string }> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)
      const response = await fetch(`${this.config.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.config.apiKey}` },
        signal: controller.signal
      })
      clearTimeout(timeout)

      return { healthy: response.ok }
    } catch (e) {
      return {
        healthy: false,
        error: e instanceof Error ? e.message : 'Unknown error'
      }
    }
  }

  private buildPrompt(input: ImpactReportInput): string {
    // Structured prompt for consistent outputs
    return `Analyze humanitarian impact for donation:

Transaction: ${input.txHash}
Organization ID: ${input.orgId}
Amount: ${input.amount} (USDC, 6 decimals)
Donor: ${input.donor}
Timestamp: ${new Date(input.timestamp * 1000).toISOString()}

Based on the organization's known operations and donation amount, estimate:

1. Number of lives directly impacted
2. Primary resource type provided (medical_supplies, food, shelter, evacuation, education)
3. Geographic region if determinable
4. Confidence score (0-100) based on data availability

Respond with JSON only.`
  }
}
