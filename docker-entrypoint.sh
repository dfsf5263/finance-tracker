#!/bin/sh
set -e

echo "🚀 Starting Finance Tracker..."

# Function to log with timestamp
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') [ENTRYPOINT] $1"
}

# Function to handle errors
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Validate required environment variables
log "Validating environment variables..."
if [ -z "$DATABASE_URL" ]; then
    error_exit "DATABASE_URL environment variable is required"
fi

if [ -z "$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY" ]; then
    error_exit "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY environment variable is required"
fi

if [ -z "$CLERK_SECRET_KEY" ]; then
    error_exit "CLERK_SECRET_KEY environment variable is required"
fi

# Database migrations are now applied manually before container startup
# The Prisma client is pre-generated during the Docker build stage

# Database seeding should be done manually if needed
# Set ENABLE_SEEDING=true and run: npx prisma db seed

# Final health check is performed by wait-for-db.sh above

log "✅ All startup checks passed"
log "🎉 Starting Next.js application on port ${PORT:-3000}..."

# Start the Next.js application
exec node server.js