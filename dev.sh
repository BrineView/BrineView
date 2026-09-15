#!/usr/bin/env bash
set -e

cleanup() {
  echo ""
  echo "Shutting down..."
  kill $FRONTEND_PID $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID $BACKEND_PID 2>/dev/null
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "Installing dependencies..."
cd frontend && npm install --silent && cd ..
cd backend && pip install -r requirements.txt -q && cd ..

echo ""
echo "Starting BrineView..."
echo "  Frontend: http://localhost:5173"
echo "  Backend:  http://localhost:8000"
echo ""

cd frontend && npm run dev &
FRONTEND_PID=$!

cd backend && python -m uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

wait $FRONTEND_PID $BACKEND_PID
