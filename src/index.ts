import 'dotenv/config'  // Load environment variables first
import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createServices } from './services/factory'
import { loadConfig } from './lib/config'
import { logger } from './lib/logger'

async function main() {
  // Load and validate configuration
  const config = loadConfig()
  
  logger.info({ 
    network: config.nodeEnv,
    price: `$${(config.priceCents / 100).toFixed(2)}`
  }, 'Starting ImpactOracle API')

  // Initialize services
  const services = createServices({
    eigenai: {
      apiKey: config.eigenaiApiKey,
      baseUrl: config.eigenaiBaseUrl,
      model: 'gpt-oss',  // EigenAI's model
      maxTokens: 1000,
      signingSecret: config.eigenaiApiKey // Use API key as HMAC secret
    },
    x402: {
      payTo: config.payToAddress as `0x${string}`,
      network: 'base-sepolia',
      priceCents: config.priceCents,
      facilitator: {
        // TODO: Initialize real facilitator client
        verify: async () => ({ valid: true }),
        settle: async () => ({ success: true, txHash: '0x' + 'a'.repeat(64) })
      }
    }
  })

  // Create app
  const app = createApp({ services })

  // Start server
  serve({
    fetch: app.fetch,
    port: config.port
  }, (info) => {
    logger.info(`🚀 Server: http://localhost:${info.port}`)
    logger.info(`❤️  Health: http://localhost:${info.port}/v1/health`)
    logger.info(`📄 Verify: http://localhost:${info.port}/v1/verify`)
  })
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})
