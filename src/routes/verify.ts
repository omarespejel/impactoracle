import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { VerificationRequestSchema } from '../types/impact'
import { x402Middleware } from '../middleware/x402'
import { EigenAIService } from '../services/eigenai'
import { ChainService } from '../services/chain'
import { logger } from '../lib/logger'

const verify = new Hono()

verify.post('/',
  x402Middleware({ 
    price: process.env.PAYMENT_PRICE || '$0.05', 
    payTo: process.env.PAY_TO || '0x0000000000000000000000000000000000000000', 
    network: 'base-sepolia' 
  }),
  zValidator('json', VerificationRequestSchema),
  async (c) => {
    const body = c.req.valid('json')
    
    try {
      // 1. Fetch tx details from chain (viem)
      const chainService = new ChainService({ 
        rpcUrl: process.env.BASE_SEPOLIA_RPC || 'https://sepolia.base.org' 
      })
      
      const donation = await chainService.getDonationFromTx(body.txHash as `0x${string}`)
      
      // 2. Call EigenAI service
      const eigenAIService = new EigenAIService({
        apiKey: process.env.EIGENAI_API_KEY || '',
        baseUrl: process.env.EIGENAI_BASE_URL || 'https://api.eigenai.com'
      })
      
      const report = await eigenAIService.generateReport({
        orgId: body.orgId,
        amount: donation.amount.toString(),
        txHash: body.txHash
      })
      
      // 3. Return report with proof
      return c.json({
        orgId: body.orgId,
        amount: donation.amount.toString(),
        impactMetrics: report.metrics,
        confidence: 85, // Could be calculated based on report quality
        timestamp: Date.now(),
        proof: report.proof
      }, 200)
    } catch (error) {
      logger.error({ error, txHash: body.txHash }, 'Error processing verification request')
      
      if (error instanceof Error) {
        return c.json({ 
          error: error.message 
        }, 500)
      }
      
      return c.json({ 
        error: 'Internal server error' 
      }, 500)
    }
  }
)

export { verify }

