#!/usr/bin/env bash
set -euo pipefail

# Load DATABASE_URL_E2E from .env
if [[ -f .env ]]; then
  set -a
  source .env
  set +a
fi

if [[ -z "${DATABASE_URL_E2E:-}" ]]; then
  echo "ERROR: DATABASE_URL_E2E is not set. Add it to .env or export it." >&2
  exit 1
fi

docker compose down -v postgres-e2e
docker compose up -d postgres-e2e
echo "Waiting for Postgres to be ready..."
sleep 3

DATABASE_URL="$DATABASE_URL_E2E" npx prisma migrate deploy
DATABASE_URL="$DATABASE_URL_E2E" npx prisma db seed
