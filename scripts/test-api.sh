#!/usr/bin/env bash
cd "$(dirname "$0")/../apps/api"
if [ -d "venv" ]; then
  source venv/bin/activate
fi
exec pytest -v

