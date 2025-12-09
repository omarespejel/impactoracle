import { Hono } from 'hono'
import { logger } from './lib/logger'
import { verify } from './routes/verify'

export const app = new Hono()

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: Date.now() })
})

// API routes
app.route('/v1/verify', verify)

// Error handling
app.onError((err, c) => {
  logger.error({ error: err }, 'Unhandled error')
  return c.json({ error: 'Internal server error' }, 500)
})

app.notFound((c) => {
  return c.json({ error: 'Not found' }, 404)
})

