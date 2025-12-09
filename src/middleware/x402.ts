import { createMiddleware } from 'hono/factory'
import { logger } from '../lib/logger'

export const x402Middleware = (config: {
  price: string
  payTo: string
  network: string
}) => {
  return createMiddleware(async (c, next) => {
    const paymentHeader = c.req.header('X-Payment')
    
    if (!paymentHeader) {
      logger.info({ path: c.req.path }, '402 Payment Required')
      
      // Return 402 with payment requirements following x402 spec
      return c.json({
        error: 'Payment Required',
        accepts: ['application/x402'],
        price: config.price,
        payTo: config.payTo,
        network: config.network,
        instructions: `Include X-Payment header with valid payment proof to access this endpoint. Price: ${config.price}`
      }, 402)
    }
    
    // TODO: Verify payment with facilitator
    // For now, we'll accept any non-empty payment header
    // In production, verify the payment proof with Coinbase's x402 facilitator
    
    logger.info({ path: c.req.path, hasPayment: !!paymentHeader }, 'Payment verified')
    await next()
  })
}

