#!/bin/sh

# Exit on any error
set -e

echo "Starting Finance Tracker with cron support..."

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