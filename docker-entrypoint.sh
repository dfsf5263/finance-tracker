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

# Wait for database to be ready
log "Checking database connectivity..."
if ! ./scripts/wait-for-db.sh; then
    error_exit "Database is not accessible"
fi

# Run database migrations (unless explicitly skipped)
if [ "$SKIP_MIGRATIONS" != "true" ]; then
    log "Running database migrations..."
    if ! npx prisma migrate deploy; then
        error_exit "Database migration failed"
    fi
    log "✅ Database migrations completed successfully"
else
    log "⚠️  Skipping database migrations (SKIP_MIGRATIONS=true)"
fi

# Generate Prisma client (ensure it's up to date)
log "Generating Prisma client..."
if ! npx prisma generate; then
    error_exit "Prisma client generation failed"
fi
log "✅ Prisma client generated successfully"

# Optional: Run database seeding
if [ "$ENABLE_SEEDING" = "true" ]; then
    log "Running database seeding..."
    if npx prisma db seed; then
        log "✅ Database seeding completed successfully"
    else
        log "⚠️  Database seeding failed (continuing anyway)"
    fi
fi

# Final health check - verify database connection
log "Performing final database health check..."
if ! npx prisma db execute --url "$DATABASE_URL" --stdin <<EOF
SELECT 1;
EOF
then
    error_exit "Final database health check failed"
fi

log "✅ All startup checks passed"
log "🎉 Starting Next.js application on port ${PORT:-3000}..."

# Start the Next.js application
exec node server.js