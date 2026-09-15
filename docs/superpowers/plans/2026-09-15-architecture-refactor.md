# BrineView Architecture Refactor — Implementation Plan

## Global Constraints
- Python 3.11+, FastAPI, React 19, TypeScript, Zustand 5, Three.js 0.170
- Backend: `backend/` folder, run with `uvicorn app.main:app --reload --port 8000`
- Frontend: `frontend/` folder, run with `npm run dev` (port 5173)
- No new dependencies unless absolutely necessary
- All changes must be committed before moving to next task
- Test command for backend: `cd backend && python -m pytest tests/ -v`
- Test command for frontend: `cd frontend && npm run verify` (lint + typecheck)

---

## Task 1: Backend Quick Cleanup

**Files:**
- Create: `backend/app/utils.py`
- Modify: `backend/app/adapters/synthetic.py`
- Modify: `backend/app/userdata.py`
- Modify: `backend/app/auth/deps.py`
- Modify: `backend/app/main.py`

**What to do:**

1. Create `backend/app/utils.py` with shared `_sanitize()`:
```python
"""Shared utilities."""
import numpy as np
from typing import Any


def sanitize(arr: Any) -> Any:
    """Replace NaN/Inf with None for safe JSON serialization."""
    if isinstance(arr, np.ndarray):
        return sanitize(arr.tolist())
    if isinstance(arr, list):
        return [sanitize(x) for x in arr]
    if isinstance(arr, float) and (np.isnan(arr) or np.isinf(arr)):
        return None
    if isinstance(arr, (np.floating, np.integer)):
        v = float(arr)
        if np.isnan(v) or np.isinf(v):
            return None
        return v
    return arr
```

2. In `backend/app/adapters/synthetic.py`:
   - Remove the `_sanitize()` function (lines 17-30)
   - Add `from ..utils import sanitize`
   - Replace all `_sanitize(` calls with `sanitize(`

3. In `backend/app/userdata.py`:
   - Remove `from dataclasses import dataclass, field` → change to `from dataclasses import dataclass` (remove unused `field` import)
   - Remove the `_sanitize()` function (lines 22-35)
   - Add `from .utils import sanitize`
   - Replace all `_sanitize(` calls with `sanitize(`

4. In `backend/app/auth/deps.py`:
   - Remove `get_optional_user` function (lines 40-50) — dead code, never imported

5. In `backend/app/main.py`:
   - Fix version mismatch: line 9 says `version="0.2.0"` but line 32 returns `"0.1.0"` — change line 32 to `"0.2.0"`

6. Commit: `fix: extract shared _sanitize, remove dead code, fix version`

---

## Task 2: `.env.sample` + Startup Validation

**Files:**
- Create: `.env.sample` (project root)
- Modify: `backend/app/auth/config.py`

**What to do:**

1. Create `.env.sample`:
```
# BrineView Environment Configuration
# Copy to .env and fill in values

# Data adapter (default: synthetic)
BRINEVIEW_ADAPTER=synthetic

# JWT secret — REQUIRED for production, change from dev default
JWT_SECRET=change-me-to-a-strong-random-string

# OAuth providers (optional — leave blank to disable)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=

# URLs (default to localhost)
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:8000
```

2. In `backend/app/auth/config.py`, add startup validation after the warning log:
```python
import os

ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")

if JWT_SECRET == DEV_JWT_SECRET and ENVIRONMENT != "development":
    raise RuntimeError(
        "JWT_SECRET must be set to a strong secret in non-development environments. "
        "Set the JWT_SECRET environment variable."
    )
```

3. Commit: `feat: add .env.sample and startup validation for JWT_SECRET`

---

## Task 3: Frontend Quick Cleanup

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/api/auth.ts`
- Create: `frontend/src/components/ErrorBoundary.tsx`
- Modify: `frontend/src/App.tsx`

**What to do:**

1. In `frontend/src/api/client.ts`:
   - Remove the `sendJson` function entirely (lines 22-41)
   - Rewrite `postJson` to inline the fetch logic:
   ```typescript
   export async function postJson<T>(url: string, body: unknown): Promise<T> {
     const res = await fetch(url, {
       method: "POST",
       headers: { "Content-Type": "application/json" },
       body: JSON.stringify(body),
       signal: AbortSignal.timeout(TIMEOUT),
     });
     if (!res.ok) {
       const text = await res.text().catch(() => "");
       throw new Error(apiErrorMessage(res.status, text));
     }
     return res.json() as Promise<T>;
   }
   ```
   - Remove `fetchJsonAuth` function entirely (lines 61-63)

2. In `frontend/src/api/auth.ts`:
   - Rewrite `getMe` to inline the auth fetch:
   ```typescript
   export async function getMe(token: string): Promise<{ user: AuthResponse["user"] }> {
     const res = await fetch(`${AUTH}/me`, {
       headers: { Authorization: `Bearer ${token}` },
       signal: AbortSignal.timeout(15000),
     });
     if (!res.ok) {
       const text = await res.text().catch(() => "");
       throw new Error(`API error ${res.status}`);
     }
     return res.json();
   }
   ```
   - Remove the import of `fetchJsonAuth` from `./client`

3. Create `frontend/src/components/ErrorBoundary.tsx`:
```tsx
import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="flex items-center justify-center h-screen w-screen" style={{ background: "var(--ocean-bg)" }}>
            <div className="text-center p-8">
              <h2 className="text-xl font-bold mb-2" style={{ color: "#f87171" }}>
                Something went wrong
              </h2>
              <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
                {this.state.error?.message ?? "An unexpected error occurred"}
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: "var(--accent-cyan)", color: "#000", border: "none", cursor: "pointer" }}
              >
                Reload page
              </button>
            </div>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
```

4. In `frontend/src/App.tsx`:
   - Import `ErrorBoundary`
   - Wrap the page content with `<ErrorBoundary>`:
   ```tsx
   return (
     <ErrorBoundary>
       <a href="#main" className="skip-link">Skip to content</a>
       {(() => { /* ... existing switch ... */ })()}
     </ErrorBoundary>
   );
   ```

5. Run `cd frontend && npm run verify` to confirm no type/lint errors

6. Commit: `refactor: inline API wrappers, add ErrorBoundary`

---

## Task 4: OceanScene Split (874 lines → 6 modules)

**Files:**
- Create: `frontend/src/components/three/helpers.ts`
- Create: `frontend/src/components/three/terrain.ts`
- Create: `frontend/src/components/three/environment.ts`
- Create: `frontend/src/components/three/markers.ts`
- Create: `frontend/src/components/three/surface.ts`
- Modify: `frontend/src/components/three/OceanScene.ts`

**Split:**

`helpers.ts` (~60 lines) — pure functions:
- `latLonToWorld()`, `terrainColor()`, `makeHaloTexture()`, `niceTickStep()`, `tickValues()`, `formatTick()`

`terrain.ts` (~80 lines):
- `createTerrainMesh(bathymetry, latRange, lonRange)` → returns `{ mesh, dispose }`
- Contains the terrain vertex displacement + coloring logic from `setBathymetry()`

`environment.ts` (~120 lines):
- `createEnvironment(scene)` → returns `{ sky, seaPlane, waterline, graticule, container, rebuildGraticule, dispose }`
- Contains sky dome, sea plane, graticule, container creation

`markers.ts` (~80 lines):
- `MarkerManager` class with `setFloats()`, `setSelectedId()`, `setShow()`, `reposition()`, `dispose()`
- Owns marker meshes, halo sprites, raycaster targets

`surface.ts` (~90 lines):
- `createSurfaceMesh(field, colorscale, latRange, lonRange)` → returns `{ mesh, dispose }`
- Contains field texture → geometry → material pipeline

`OceanScene.ts` (~350 lines, down from 874):
- Orchestrator only: renderer, camera, controls, animation loop
- Composes the above modules
- Owns pointer events and dispatches to marker/surface
- Public API unchanged: `setField()`, `setBathymetry()`, `setFloats()`, etc.

---

## Task 5: Zustand Store Split (348 lines → 4 stores)

**Files:**
- Create: `frontend/src/state/useAuthStore.ts`
- Create: `frontend/src/state/useDataStore.ts`
- Create: `frontend/src/state/useUploadStore.ts`
- Modify: `frontend/src/state/useOceanStore.ts` (slim down to ocean controls only)
- Modify: 15+ component files to update imports

**Store split:**

`useAuthStore.ts` (~60 lines):
- State: `user`, `token`, `authLoading`, `currentPage`
- Actions: `setPage`, `signupWithEmail`, `loginWithEmail`, `loginWithGoogle`, `loginWithGithub`, `handleOAuthToken`, `restoreSession`, `logout`
- Helpers: `loadPersistedAuth()`, `persistAuth()`

`useDataStore.ts` (~80 lines):
- State: `meta`, `field`, `fieldLoading`, `fieldError`, `bathymetry`, `floats`, `floatDetail`, `floatDetailLoading`, `profilePanelOpen`, `selectedFloatId`
- Actions: `loadMeta`, `loadField`, `loadFloats`, `loadBathymetry`, `loadFloatDetail`, `selectFloat`, `closeProfilePanel`

`useUploadStore.ts` (~50 lines):
- State: `userDatasets`, `userDataOpen`, `userDataLoading`, `userDataError`
- Actions: `openUserData`, `closeUserData`, `uploadUserData`, `deleteUserData`, `loadUserField`

`useOceanStore.ts` (~80 lines):
- State: `variable`, `depth`, `timeIndex`, `colorscale`, `opacity`, `showFloats`, `compareModel`
- Actions: `setVariable`, `setDepth`, `setTimeIndex`, `setColorscale`, `setOpacity`, `setShowFloats`, `setCompareModel`

**Component import updates:**
- `App.tsx` → `useAuthStore`
- `DashboardPage.tsx` → `useAuthStore` + `useDataStore`
- `LoginPage.tsx`, `SignUpPage.tsx` → `useAuthStore`
- `TopBar.tsx` → `useDataStore` + `useAuthStore`
- `Footer.tsx` → `useDataStore`
- `ControlPanel.tsx` → `useUploadStore`
- `Legend.tsx` → `useDataStore` + `useOceanStore`
- `DepthProfilePanel.tsx` → `useDataStore` + `useOceanStore`
- `FloatInfoCard.tsx` → `useDataStore` + `useOceanStore`
- `OceanViewport.tsx` → all four stores
- `UserDataModal.tsx` → `useUploadStore`
- Controls → `useOceanStore`
- `Toggle.tsx` → `useOceanStore`

---

## Task 6: Backend Tests

**Files:**
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_utils.py`
- Create: `backend/tests/test_auth.py`
- Create: `backend/tests/test_routes.py`
- Modify: `backend/requirements.txt` (add pytest)

**Tests:**
- `test_utils.py`: sanitize NaN, Inf, numpy types, nested lists, clean data passthrough
- `test_auth.py`: JWT encode/decode round-trip, expired token rejection, password hash/verify, OAuth state issue/verify/consume
- `test_routes.py`: FastAPI TestClient for GET /api/variables, GET /api/meta, GET /api/field (valid + invalid), GET /api/bathymetry, GET /api/floats, GET /api/floats/{id}, POST /api/auth/signup, POST /api/auth/login

---

## Task 7: Makefile (single command)

**Files:**
- Create: `Makefile` (project root)

```makefile
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
```

---

## Task 8: `.kiro/steering/`

**Files:**
- Create: `.kiro/steering/standards.md`
- Create: `.kiro/steering/project.md`

---

## Execution Order

**Wave 1 (parallel):** Tasks 1, 2, 3, 7, 8
**Wave 2 (sequential):** Task 6 → Task 5
**Wave 3 (sequential):** Task 4
**Final:** Whole-branch review
