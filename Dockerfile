# Finance Tracker Production Dockerfile
# Multi-stage build for optimal production image

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy package files
COPY package.json package-lock.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

# Build arguments for public Clerk key only (safe to embed)
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Set environment variables for build
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY


# Copy dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Install all dependencies (including dev dependencies for build)
RUN npm ci

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

# Build the application
RUN npm run build


# Stage 3: Production runner
FROM node:20-alpine AS runner
WORKDIR /app

# Install necessary packages for production
RUN apk add --no-cache dumb-init curl postgresql-client

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy public directory (static assets)
COPY --from=builder /app/public ./public

# Copy Prisma schema files
COPY --from=builder /app/prisma ./prisma

# Copy production node_modules for Prisma CLI and other tools
COPY --from=deps /app/node_modules ./node_modules

# Copy startup scripts
COPY docker-entrypoint.sh ./
COPY scripts/wait-for-db.sh ./scripts/
RUN chmod +x docker-entrypoint.sh scripts/wait-for-db.sh

# Set ownership
RUN chown -R nextjs:nodejs /app
USER nextjs

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["./docker-entrypoint.sh"]