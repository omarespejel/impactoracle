import { serve } from '@hono/node-server'
import { app } from './app'
import { logger } from './lib/logger'

const port = Number(process.env.PORT) || 3000

logger.info({ port }, 'Starting Impact Verification Oracle server')

serve({
  fetch: app.fetch,
  port
}, (info) => {
  logger.info({ port: info.port }, 'Server started')
})

