import { createRoute, z } from '@hono/zod-openapi'
import {
  VerifyRequestSchema,
  VerifyResponseSchema,
  ErrorResponseSchema,
  PaymentRequiredSchema
} from './schemas'

export const verifyRoute = createRoute({
  method: 'post',
  path: '/v1/verify',
  tags: ['Impact Verification'],
  summary: 'Verify donation impact',
  description: `
    Generates a verifiable impact report for a charitable donation.
    
    **Payment Required**: This endpoint requires x402 payment ($0.05 USDC).
    Include payment in the \`X-PAYMENT\` header (base64-encoded).
    
    **Verification**: Response includes cryptographic proof from EigenAI
    that the report was not hallucinated.
  `,
  request: {
    body: {
      content: {
        'application/json': {
          schema: VerifyRequestSchema
        }
      },
      required: true
    }
  },
  responses: {
    200: {
      description: 'Impact report generated successfully',
      content: {
        'application/json': {
          schema: VerifyResponseSchema
        }
      }
    },
    400: {
      description: 'Invalid request parameters',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    402: {
      description: 'Payment required',
      content: {
        'application/json': {
          schema: PaymentRequiredSchema
        }
      }
    },
    500: {
      description: 'Internal server error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

export type VerifyRoute = typeof verifyRoute
