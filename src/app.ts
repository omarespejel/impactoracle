import { OpenAPIHono } from '@hono/zod-openapi'
import { cors } from 'hono/cors'
import { Scalar } from '@scalar/hono-api-reference'
import { nanoid } from 'nanoid'
import { logger } from './lib/logger'
import { errorToResponse, ValidationError } from './lib/errors'
import { createX402Middleware } from './middleware/x402'
import { createRateLimiter, MemoryRateLimitStore, keyGenerators } from './middleware/ratelimit'
import { verifyRoute } from './routes/verify'
import { healthRoute, readinessRoute } from './routes/health'
import { ServiceContainer, createServices } from './services/factory'

// === App configuration ===

interface AppConfig {
  services?: Partial<ServiceContainer>
  version?: string
}

// === App factory ===

export function createApp(config: AppConfig = {}) {
  const app = new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        const errors = result.error?.errors || []
        const error = new ValidationError('Invalid request', {
          errors: errors.map((e: any) => ({
            path: e.path?.join('.') || 'unknown',
            message: e.message || 'Validation error'
          }))
        })
        return c.json(errorToResponse(error), 400)
      }
    }
  })

  const version = config.version || process.env.npm_package_version || '1.0.0'

  // === Global middleware ===

  // CORS
  app.use('*', cors({
    origin: ['http://localhost:3000', 'http://localhost:5173', 'https://*.vercel.app'],
    allowMethods: ['GET', 'POST', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'X-PAYMENT', 'X-Request-ID'],
    exposeHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
    credentials: true
  }))

  // Request ID
  app.use('*', async (c, next) => {
    const requestId = c.req.header('x-request-id') || `req_${nanoid(12)}`
    c.set('requestId', requestId)
    c.header('X-Request-ID', requestId)
    await next()
  })

  // Request logging
  app.use('*', async (c, next) => {
    const start = Date.now()
    const log = logger.child({ 
      requestId: c.get('requestId'),
      method: c.req.method,
      path: c.req.path
    })

    log.info('Request started')

    await next()

    const duration = Date.now() - start
    log.info({ status: c.res.status, durationMs: duration }, 'Request completed')
  })

  // === Rate limiting (before x402) ===

  const rateLimiter = createRateLimiter({
    windowMs: 60000,
    max: 100,
    store: new MemoryRateLimitStore(),
    keyGenerator: keyGenerators.byIP,
    skip: (c) => c.req.path.startsWith('/v1/health') || c.req.path.startsWith('/v1/ready')
  })

  app.use('/v1/verify', rateLimiter)

  // === x402 payment middleware ===

  if (config.services?.payment) {
    app.use('/v1/verify', createX402Middleware({
      paymentService: config.services.payment,
      settleBeforeResponse: true
    }))
  }

  // === Routes ===

  // Health endpoints (no auth required)
  app.openapi(healthRoute, async (c) => {
    const eigenaiHealth = config.services?.eigenai
      ? await config.services.eigenai.healthCheck()
      : { healthy: true }

    const facilitatorHealthy = true // TODO: implement facilitator health check

    const allHealthy = eigenaiHealth.healthy && facilitatorHealthy
    const anyHealthy = eigenaiHealth.healthy || facilitatorHealthy

    let status: 'healthy' | 'degraded' | 'unhealthy'
    if (allHealthy) status = 'healthy'
    else if (anyHealthy) status = 'degraded'
    else status = 'unhealthy'

    return c.json({
      status,
      version,
      timestamp: Date.now(),
      services: {
        eigenai: {
          status: eigenaiHealth.healthy ? 'healthy' : 'unhealthy',
          ...(eigenaiHealth.error && { error: eigenaiHealth.error })
        },
        facilitator: {
          status: facilitatorHealthy ? 'healthy' : 'unhealthy'
        }
      }
    }, 200)
  })

  app.openapi(readinessRoute, async (c) => {
    const eigenaiHealth = config.services?.eigenai
      ? await config.services.eigenai.healthCheck()
      : { healthy: true }

    const isReady = eigenaiHealth.healthy

    return c.json({
      status: isReady ? 'healthy' : 'unhealthy',
      version,
      timestamp: Date.now(),
      services: {
        eigenai: {
          status: eigenaiHealth.healthy ? 'healthy' : 'unhealthy'
        },
        facilitator: { status: 'healthy' }
      }
    }, isReady ? 200 : 503)
  })

  // Verify endpoint (x402 protected)
  app.openapi(verifyRoute, async (c) => {
    const requestId = c.get('requestId') || `req_${nanoid(12)}`
    const body = c.req.valid('json')
    const payer = c.get('x402Payer')
    const paymentAmount = c.get('x402Amount')
    const settleTxHash = c.get('x402TxHash')

    const log = logger.child({ requestId, txHash: body.txHash, orgId: body.orgId })

    try {
      // Generate impact report via EigenAI
      if (!config.services?.eigenai) {
        throw new Error('EigenAI service not configured')
      }

      log.info('Generating impact report')

      const report = await config.services.eigenai.generateImpactReport({
        txHash: body.txHash,
        orgId: body.orgId,
        amount: '1000000', // TODO: fetch from chain
        donor: payer || '0x0000000000000000000000000000000000000000',
        timestamp: Math.floor(Date.now() / 1000)
      })

      const response = {
        success: true as const,
        requestId,
        data: {
          txHash: body.txHash,
          orgId: body.orgId,
          amount: '1000000',
          impactMetrics: {
            livesImpacted: report.metrics.livesImpacted,
            resourceType: report.metrics.resourceType,
            region: report.metrics.region
          },
          confidence: report.confidence,
          generatedAt: Date.now(),
          expiresAt: Date.now() + 86400000, // 24 hours
          proof: report.proof
        },
        payment: {
          payer: payer || '0x0000000000000000000000000000000000000000',
          amount: paymentAmount || '50000',
          ...(settleTxHash && { settledTxHash: settleTxHash })
        }
      }

      log.info({ confidence: report.confidence }, 'Impact report generated')

      return c.json(response, 200)

    } catch (error) {
      log.error({ error }, 'Failed to generate impact report')
      return c.json({
        success: false as const,
        error: {
          code: 'GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown error'
        }
      }, 500)
    }
  })

  // === OpenAPI documentation ===

  app.doc31('/v1/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'ImpactOracle API',
      version,
      description: `
        Pay-per-call impact verification API for charitable donations.
        
        ## Authentication
        
        This API uses the x402 payment protocol. Include payment proof
        in the \`X-PAYMENT\` header (base64-encoded JSON).
        
        ## Pricing
        
        - Impact verification: $0.05 USDC per request
        
        ## Networks
        
        - Base Sepolia (testnet): Chain ID 84532
        - Base (mainnet): Chain ID 8453
      `,
      contact: {
        name: 'ImpactOracle Team',
        url: 'https://github.com/omarespejel/impactoracle'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local development' },
      { url: 'https://api.impactoracle.xyz', description: 'Production' }
    ],
    tags: [
      { name: 'Impact Verification', description: 'Core verification endpoints' },
      { name: 'System', description: 'Health and status endpoints' }
    ]
  })

  // Scalar API reference - Enhanced aesthetic configuration
  app.get('/docs', Scalar({
    url: '/v1/openapi.json',
    pageTitle: 'ImpactOracle API',
    theme: {
      color: {
        accent: '#8B5CF6', // Purple accent
        background: '#0F172A', // Dark slate background
        border: '#1E293B',
        text: '#F1F5F9',
        textSecondary: '#94A3B8'
      }
    },
    layout: 'modern',
    darkMode: true,
    hideDownloadButton: false,
    hideModels: false,
    hideSidebar: false,
    hideSearch: false,
    hideThemeToggle: false,
    metaData: {
      title: 'ImpactOracle API - Verifiable Impact Verification',
      description: 'Pay-per-call impact verification API for charitable donations. Powered by EigenAI with cryptographic proofs.',
      ogImage: 'https://github.com/omarespejel/impactoracle/raw/main/.github/og-image.png',
      favicon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🔮</text></svg>'
    },
    searchHotKey: 'k',
    showSidebar: true,
    sidebarOpen: true,
    customCss: `
      :root {
        --scalar-color-1: #8B5CF6;
        --scalar-color-2: #A78BFA;
        --scalar-color-3: #C4B5FD;
        --scalar-color-accent: #8B5CF6;
        --scalar-sidebar-background-1: #0F172A;
        --scalar-sidebar-item-hover-color: #1E293B;
        --scalar-button-1: #8B5CF6;
        --scalar-button-1-hover: #7C3AED;
        --scalar-button-1-color: #FFFFFF;
      }
      .scalar-app {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      }
      .scalar-header {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      }
      .scalar-sidebar {
        background: #0F172A;
        border-right: 1px solid #1E293B;
      }
      .scalar-content {
        background: #0F172A;
      }
      .scalar-card {
        background: #1E293B;
        border: 1px solid #334155;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      }
      .scalar-button {
        border-radius: 6px;
        transition: all 0.2s ease;
      }
      .scalar-button:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
      }
      .scalar-code {
        background: #1E293B;
        border: 1px solid #334155;
        border-radius: 6px;
      }
      .scalar-tag {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        border-radius: 4px;
        padding: 2px 8px;
        font-weight: 500;
      }
    `
  }))

  // Root redirect to docs
  app.get('/', (c) => c.redirect('/docs'))

  // === Global error handler ===

  app.onError((err, c) => {
    const requestId = c.get('requestId')
    logger.error({ err, requestId }, 'Unhandled error')
    return c.json(errorToResponse(err), 500)
  })

  // === 404 handler ===

  app.notFound((c) => {
    return c.json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: `Route ${c.req.method} ${c.req.path} not found`
      }
    }, 404)
  })

  return app
}

// Extend Hono context
declare module 'hono' {
  interface ContextVariableMap {
    requestId: string
  }
}
