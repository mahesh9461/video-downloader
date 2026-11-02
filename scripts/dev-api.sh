#!/usr/bin/env bash
cd "$(dirname "$0")/../apps/api"

if [ ! -d "venv" ]; then
  echo "⚠️  Python venv not found. Creating and installing..."
  python3 -m venv venv
  source venv/bin/activate
  pip install -r requirements.txt
else
  source venv/bin/activate
fi

echo "🚀 Starting FastAPI backend on http://127.0.0.1:8000..."
exec uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload

