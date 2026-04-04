#!/bin/sh

# Exit on any error
set -e

echo "Starting Finance Tracker..."

# --- Environment normalization ---
# Allow platform-injected URL variables to satisfy APP_URL when not explicitly set.
# RENDER_EXTERNAL_URL is automatically set by Render for web services.
if [ -z "$APP_URL" ] && [ -n "$RENDER_EXTERNAL_URL" ]; then
  export APP_URL="$RENDER_EXTERNAL_URL"
  echo "APP_URL set from RENDER_EXTERNAL_URL: $APP_URL"
fi

# --- Database migrations ---
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  echo "Running database migrations..."

  DB_MIGRATION_MAX_RETRIES=${DB_MIGRATION_MAX_RETRIES:-10}
  DB_MIGRATION_RETRY_DELAY=${DB_MIGRATION_RETRY_DELAY:-5}

  attempt=1
  while [ "$attempt" -le "$DB_MIGRATION_MAX_RETRIES" ]; do
    echo "Migration attempt $attempt of $DB_MIGRATION_MAX_RETRIES..."
    if npx prisma migrate deploy; then
      echo "Migrations complete."
      break
    fi

    if [ "$attempt" -eq "$DB_MIGRATION_MAX_RETRIES" ]; then
      echo "Migrations failed after $DB_MIGRATION_MAX_RETRIES attempts. Giving up."
      exit 1
    fi

    echo "Migrations failed (database may not be ready yet). Retrying in ${DB_MIGRATION_RETRY_DELAY}s..."
    sleep "$DB_MIGRATION_RETRY_DELAY"
    attempt=$((attempt + 1))
  done
else
  echo "Skipping database migrations (SKIP_MIGRATIONS=true)."
fi

# --- Optional database seeding ---
if [ "$ENABLE_SEEDING" = "true" ]; then
  echo "Running database seeding..."
  npx prisma db seed
  echo "Seeding complete."
fi

# Start the cron job in the background
echo "Starting weekly summary cron job..."
node scripts/weekly-summary-cron.js &
CRON_PID=$!
echo "Cron job started with PID: $CRON_PID"

# Start the Next.js server
echo "Starting Next.js server..."
node server.js &
SERVER_PID=$!
echo "Next.js server started with PID: $SERVER_PID"

# Handle shutdown signals
cleanup() {
  echo "Received shutdown signal, cleaning up..."
  
  if [ ! -z "$CRON_PID" ]; then
    echo "Stopping cron job (PID: $CRON_PID)..."
    kill $CRON_PID 2>/dev/null || true
  fi
  
  if [ ! -z "$SERVER_PID" ]; then
    echo "Stopping Next.js server (PID: $SERVER_PID)..."
    kill $SERVER_PID 2>/dev/null || true
  fi
  
  # Wait for processes to exit
  sleep 2
  
  echo "Cleanup complete"
  exit 0
}

# Set up signal handlers
trap cleanup SIGTERM SIGINT

# Wait for the server process (main process)
# If the server exits, the container should stop
wait $SERVER_PID
EXIT_CODE=$?

echo "Next.js server exited with code: $EXIT_CODE"

# If server exited, clean up cron job
if [ ! -z "$CRON_PID" ]; then
  echo "Stopping cron job..."
  kill $CRON_PID 2>/dev/null || true
fi

exit $EXIT_CODE