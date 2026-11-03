#!/usr/bin/env bash
set -e

echo "🚀 Running Render Build Script for SaveIt API..."

# 1. Install Deno if not already present (enables yt-dlp JavaScript challenge solver)
if ! command -v deno >/dev/null 2>&1; then
  echo "📦 Installing Deno for yt-dlp JS challenge evaluation..."
  curl -fsSL https://deno.land/install.sh | sh
  export PATH="$HOME/.deno/bin:$PATH"
fi

if command -v deno >/dev/null 2>&1; then
  echo "✅ Deno installed successfully: $(deno --version | head -n 1)"
else
  echo "⚠️ Warning: Deno installation finished but deno binary not in PATH"
fi

# 2. Upgrade pip and install API dependencies
echo "🐍 Installing Python dependencies..."
pip install --upgrade pip
pip install -r apps/api/requirements.txt

echo "✅ Build completed successfully."

