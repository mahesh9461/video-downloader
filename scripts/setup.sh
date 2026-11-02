#!/usr/bin/env bash
set -e

echo "📦 Setting up SaveIt Monorepo..."

cd "$(dirname "$0")/.."

# 1. Setup Python backend virtualenv
echo "🐍 Setting up Python virtual environment in apps/api/venv..."
if [ ! -d "apps/api/venv" ]; then
  python3 -m venv apps/api/venv
fi

source apps/api/venv/bin/activate
echo "⬇️  Installing Python dependencies..."
pip install --upgrade pip
pip install -r apps/api/requirements.txt

# 2. Setup Node frontend
echo "⚛️  Installing Web dependencies..."
npm install --prefix apps/web

echo "✅ Setup complete! Run 'npm run dev' to start the application."

