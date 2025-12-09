import { createRoute } from '@hono/zod-openapi'
import { HealthResponseSchema } from './schemas'

export const healthRoute = createRoute({
  method: 'get',
  path: '/v1/health',
  tags: ['System'],
  summary: 'Health check',
  description: 'Returns the health status of the API and its dependencies.',
  responses: {
    200: {
      description: 'Health status',
      content: {
        'application/json': {
          schema: HealthResponseSchema
        }
      }
    }
  }
})

export const readinessRoute = createRoute({
  method: 'get',
  path: '/v1/ready',
  tags: ['System'],
  summary: 'Readiness check',
  description: 'Returns whether the service is ready to accept traffic.',
  responses: {
    200: {
      description: 'Service is ready',
      content: {
        'application/json': {
          schema: HealthResponseSchema
        }
      }
    },
    503: {
      description: 'Service is not ready',
      content: {
        'application/json': {
          schema: HealthResponseSchema
        }
      }
    }
  }
})

export type HealthRoute = typeof healthRoute
export type ReadinessRoute = typeof readinessRoute

