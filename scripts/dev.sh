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

# 1. Start API in background
./scripts/dev-api.sh &
API_PID=$!

# 2. Wait up to 10 seconds for backend port 8000 to be live
echo "⏳ Waiting for backend API to be ready on port 8000..."
for i in {1..20}; do
  if curl -s http://127.0.0.1:8000/health >/dev/null 2>&1; then
    echo "✅ Backend API is live on http://127.0.0.1:8000"
    break
  fi
  sleep 0.5
done

# 3. Start Web frontend
cd apps/web
npm run dev
