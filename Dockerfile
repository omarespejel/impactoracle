FROM oven/bun:1.1.38 AS base
WORKDIR /app

# Install dependencies (cached layer)
FROM base AS deps
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile --production

# Build stage (if needed)
FROM base AS builder
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun test
RUN bun run typecheck

# Production image
FROM base AS runner
ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono
USER hono

# Copy built app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/src ./src
COPY --from=builder /app/package.json ./

EXPOSE 3000
ENV PORT=3000

CMD ["bun", "run", "src/index.ts"]

