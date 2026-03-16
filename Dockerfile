# syntax=docker.io/docker/dockerfile:1

FROM node:25-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# Check https://github.com/nodejs/docker-node/tree/b4117f9333da4138b03a546ec926ef50a31506c3#nodealpine to understand why libc6-compat might be needed.
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Install dependencies based on the preferred package manager
COPY prisma ./prisma/
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* .npmrc* ./
RUN --mount=type=cache,target=/root/.npm \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci --verbose; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi


# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN echo "=== Prisma Generate Debug Info ===" && \
    echo "Node version: $(node --version)" && \
    echo "NPM version: $(npm --version)" && \
    echo "Architecture: $(uname -m)" && \
    echo "Platform: $(uname -s)" && \
    echo "Working directory: $(pwd)" && \
    echo "Prisma schema exists: $(ls -la prisma/schema.prisma)" && \
    echo "Node modules exists: $(ls -la node_modules/ | head -5)" && \
    echo "Running Prisma generate..." && \
    npx prisma generate

# No build arguments needed for Better Auth (all config at runtime)

# Next.js collects completely anonymous telemetry data about general usage.
# Learn more here: https://nextjs.org/telemetry
# Uncomment the following line in case you want to disable telemetry during the build.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN \
  if [ -f yarn.lock ]; then yarn run build; \
  elif [ -f package-lock.json ]; then npm run build; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm run build; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

LABEL org.opencontainers.image.source=https://github.com/dfsf5263/finance-tracker

ENV NODE_ENV=production
ENV LOG_LEVEL=info
# Uncomment the following line in case you want to disable telemetry during runtime.
# ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Install curl for health checks, node-cron for weekly summaries, prisma CLI (pinned to @prisma/client version), and tsx for optional seeding
COPY --from=builder /app/node_modules/@prisma/client/package.json /tmp/prisma-client-pkg.json
RUN apk add --no-cache curl && \
    PRISMA_VERSION=$(node -p "require('/tmp/prisma-client-pkg.json').version") && \
    npm install --no-save node-cron "prisma@${PRISMA_VERSION}" tsx && \
    rm /tmp/prisma-client-pkg.json

COPY --from=builder /app/public ./public

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Copy Prisma schema, migrations, config, and generated client for runtime
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma

# Copy cron script and entrypoint
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/docker-entrypoint.sh ./docker-entrypoint.sh

# Make scripts executable
RUN chmod +x ./docker-entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000

# Health check using the existing API endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# server.js is created by next build from the standalone output
# https://nextjs.org/docs/pages/api-reference/config/next-config-js/output
ENV HOSTNAME="0.0.0.0"
CMD ["./docker-entrypoint.sh"]
