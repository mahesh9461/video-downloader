#!/usr/bin/env bash
set -e

echo "📦 Setting up SaveIt Monorepo..."

cd "$(dirname "$0")/.."

# Detect best available Python (prefer python3.11 for guaranteed yt-dlp & fastapi wheel support)
if command -v python3.11 >/dev/null 2>&1; then
  PYTHON_CMD="python3.11"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_CMD="python3"
else
  echo "❌ Error: Python 3 not found on your system."
  exit 1
fi

echo "🐍 Using $($PYTHON_CMD --version) to set up virtual environment..."

if [ ! -d "apps/api/venv" ] || [ ! -f "apps/api/venv/bin/uvicorn" ]; then
  rm -rf apps/api/venv
  $PYTHON_CMD -m venv apps/api/venv
fi

source apps/api/venv/bin/activate
echo "⬇️  Installing Python dependencies (FastAPI, yt-dlp, FFmpeg)..."
pip install --upgrade pip
pip install -r apps/api/requirements.txt

# 2. Setup Node frontend
echo "⚛️  Installing Web dependencies..."
npm install --prefix apps/web

echo "✅ Setup complete! Run 'npm run dev' to start the application."
