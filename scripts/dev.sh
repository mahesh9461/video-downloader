#!/usr/bin/env bash
set -e
cd "$(dirname "$0")/.."

cleanup() {
  echo ""
  echo "🛑 Shutting down SaveIt servers..."
  kill $(jobs -p) 2>/dev/null || true
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

echo "🎬 Starting SaveIt Monorepo..."

# Start API in background
./scripts/dev-api.sh &
API_PID=$!

# Brief pause for API startup
sleep 1

# Start Web in foreground
cd apps/web
npm run dev

