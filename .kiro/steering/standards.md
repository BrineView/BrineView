# Coding Standards

## Backend (Python/FastAPI)
- Python 3.11+
- FastAPI with async where beneficial
- Type hints on all public functions
- xarray for NetCDF data operations
- NumPy for array manipulation
- Custom stdlib-only JWT + PBKDF2 auth (no third-party auth libraries)
- JSON-file user storage (demo scope)
- Tests: pytest with TestClient for routes

## Frontend (React/TypeScript)
- React 19 + TypeScript strict mode
- Vite for bundling
- Zustand for state management (split by domain: auth, ocean, data, uploads)
- Tailwind CSS for layout, CSS custom properties for colors
- Three.js for 3D visualization
- Chart.js for depth profile charts
- No CSS frameworks (Bootstrap/Tailwind utility-only)
- Component naming: PascalCase, one component per file

## Architecture
- Backend and frontend in separate folders (monorepo, no shared tooling)
- Backend: adapter pattern for data sources (DataAdapter ABC)
- Frontend: hash-based routing (no React Router)
- API: RESTful JSON endpoints under /api prefix
- Auth: server-side OAuth flow with JWT tokens

## Git
- Conventional commits: feat:, fix:, refactor:, test:, docs:
- One logical change per commit
- Never commit .env, node_modules, __pycache__, users.json
