# Task 7: Makefile (Single Command to Run Everything)

## What You Implemented

Created `Makefile` at project root with targets for:
- `make dev` — installs deps, starts both backend (FastAPI on port 8000) and frontend (Vite) concurrently
- `make dev-backend` / `make dev-frontend` — run each individually
- `make install` — install all dependencies
- `make test` — run backend tests
- `make clean` — remove `__pycache__`, `node_modules`, `dist`

## Files Changed

- `Makefile` (new) — 29 lines

## Git Commit

- Commit: `5970e19` on branch `organizing-code`
- Message: `feat: add Makefile for single-command dev startup`

## Status

**DONE**
