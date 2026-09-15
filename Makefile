.PHONY: dev dev-backend dev-frontend install install-backend install-frontend clean test test-backend

dev: install
	cd frontend && npm run dev &
	cd backend && python -m uvicorn app.main:app --reload --port 8000
	wait

dev-backend:
	cd backend && python -m uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev

install: install-backend install-frontend

install-backend:
	cd backend && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

test: test-backend

test-backend:
	cd backend && python -m pytest tests/ -v

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	cd frontend && rm -rf node_modules dist
