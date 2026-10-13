#!/usr/bin/env bash
# Starts backend (8000) and frontend production server (3000) in the background.
# Logs: /tmp/backend.log, /tmp/frontend.log
cd "$(dirname "$0")/.."

pkill -f "uvicorn app.main:app" 2>/dev/null
pkill -f "next start" 2>/dev/null

(cd backend && nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 > /tmp/backend.log 2>&1 &)

[ -d frontend/.next ] || npm run build --prefix frontend
(cd frontend && nohup npm start -- -p 3000 > /tmp/frontend.log 2>&1 &)

echo "Wandscheibe startet: App auf Port 3000, Backend auf Port 8000 (Logs in /tmp/*.log)"
