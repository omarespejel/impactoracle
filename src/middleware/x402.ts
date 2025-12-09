import { createMiddleware } from 'hono/factory'
import type { Context, Next } from 'hono'
import { PaymentService } from '../services/payment'
import { PaymentPayloadSchema, type PaymentPayload } from '../types/x402'
import { logger } from '../lib/logger'

// === Hono context type extensions ===

declare module 'hono' {
  interface ContextVariableMap {
    x402Payer: string
    x402Amount: string
    x402TxHash?: string
    x402PaymentPayload: PaymentPayload
  }
}

// === Middleware config ===

interface X402MiddlewareConfig {
  paymentService: PaymentService
  settleBeforeResponse?: boolean
  onPaymentVerified?: (ctx: Context, payer: string, amount: string) => Promise<void>
  onPaymentSettled?: (ctx: Context, txHash: string) => Promise<void>
}

// === Helper functions ===

function decodePaymentHeader(header: string): PaymentPayload | null {
  try {
    const decoded = Buffer.from(header, 'base64').toString('utf-8')
    const parsed = JSON.parse(decoded)
    return PaymentPayloadSchema.parse(parsed)
  } catch {
    return null
  }
}

function build402Response(
  paymentService: PaymentService,
  resourceUrl: string,
  error?: string
) {
  const requirements = paymentService.buildPaymentRequirements(resourceUrl)

  return {
    ...requirements,
    ...(error && { error })
  }
}

// === Middleware factory ===

export function createX402Middleware(config: X402MiddlewareConfig) {
  const {
    paymentService,
    settleBeforeResponse = false,
    onPaymentVerified,
    onPaymentSettled
  } = config

  return createMiddleware(async (c: Context, next: Next) => {
    const log = logger.child({
      middleware: 'x402',
      path: c.req.path,
      method: c.req.method
    })

    // 1. Check for X-PAYMENT header
    const paymentHeader = c.req.header('X-PAYMENT')

    if (!paymentHeader) {
      log.debug('No X-PAYMENT header, returning 402')
      const resourceUrl = new URL(c.req.url).toString()

      return c.json(
        build402Response(paymentService, resourceUrl),
        402
      )
    }

    // 2. Decode and validate payment payload
    const paymentPayload = decodePaymentHeader(paymentHeader)

    if (!paymentPayload) {
      log.warn('Invalid X-PAYMENT header format')
      const resourceUrl = new URL(c.req.url).toString()

      return c.json(
        build402Response(paymentService, resourceUrl, 'invalid_payment_header'),
        402
      )
    }

    // 3. Verify payment
    const verification = await paymentService.verifyPayment(paymentPayload)

    if (!verification.valid) {
      log.warn({ reason: verification.invalidReason }, 'Payment verification failed')
      const resourceUrl = new URL(c.req.url).toString()

      return c.json(
        build402Response(paymentService, resourceUrl, verification.invalidReason),
        402
      )
    }

    log.info({
      payer: verification.payer,
      amount: verification.amount
    }, 'Payment verified')

    // 4. Optionally settle before response
    if (settleBeforeResponse) {
      const settlement = await paymentService.settlePayment(paymentPayload)

      if (!settlement.success) {
        log.error({ error: settlement.error }, 'Payment settlement failed')
        const resourceUrl = new URL(c.req.url).toString()

        return c.json(
          build402Response(paymentService, resourceUrl, `settlement_failed: ${settlement.error}`),
          402
        )
      }

      log.info({ txHash: settlement.txHash }, 'Payment settled')
      c.set('x402TxHash', settlement.txHash!)

      if (onPaymentSettled && settlement.txHash) {
        await onPaymentSettled(c, settlement.txHash)
      }
    }

    // 5. Set context variables for downstream handlers
    c.set('x402Payer', verification.payer!)
    c.set('x402Amount', verification.amount!)
    c.set('x402PaymentPayload', paymentPayload)

    if (onPaymentVerified) {
      await onPaymentVerified(c, verification.payer!, verification.amount!)
    }

    // 6. Continue to route handler
    await next()
  })
}
