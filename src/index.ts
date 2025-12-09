import { serve } from '@hono/node-server'
import { createApp } from './app'
import { createServices } from './services/factory'
import { loadConfig, resetConfig } from './lib/config'
import { logger } from './lib/logger'

async function main() {
  // Load and validate configuration
  const config = loadConfig()
  
  logger.info({ 
    network: config.nodeEnv,
    priceCents: config.priceCents
  }, 'Starting ImpactOracle API')

  // Initialize services
  const services = createServices({
    eigenai: {
      apiKey: config.eigenaiApiKey,
      baseUrl: config.eigenaiBaseUrl,
      model: 'eigenai-v1',
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
    logger.info({ port: info.port }, 'Server started')
    logger.info(`📚 API Docs: http://localhost:${info.port}/docs`)
    logger.info(`🔍 OpenAPI: http://localhost:${info.port}/v1/openapi.json`)
    logger.info(`❤️  Health: http://localhost:${info.port}/v1/health`)
  })
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server')
  process.exit(1)
})
