#!/usr/bin/env bash
set -e

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
  wait $FRONTEND_PID $BACKEND_PID 2>/dev/null || true
  exit 0
}

trap cleanup SIGINT SIGTERM

VENV_DIR="backend/.venv"

if [ ! -x "$VENV_DIR/bin/python" ]; then
  echo "Creating virtualenv..."
  python3 -m venv "$VENV_DIR"
fi

echo "Installing dependencies..."
(cd frontend && npm install --silent)
(cd backend && ./.venv/bin/pip install -r requirements.txt -q)

echo ""
echo "Starting BrineView..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo ""

(cd frontend && npm run dev) &
FRONTEND_PID=$!

(cd backend && ./.venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
BACKEND_PID=$!

wait $FRONTEND_PID $BACKEND_PID
