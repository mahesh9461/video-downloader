#!/usr/bin/env bash
cd "$(dirname "$0")/../apps/api"

if [ ! -f "venv/bin/uvicorn" ]; then
  echo "⚠️  Backend dependencies not installed in venv. Setting up now..."
  if command -v python3.11 >/dev/null 2>&1; then
    PYTHON_CMD="python3.11"
  else
    PYTHON_CMD="python3"
  fi
  rm -rf venv
  $PYTHON_CMD -m venv venv
  source venv/bin/activate
  pip install --upgrade pip
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

echo "🚀 Starting FastAPI backend on http://127.0.0.1:8000..."
exec uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
