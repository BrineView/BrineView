# BrineView

Smart India Hackathon 2026 · Problem Statement 26067 — **Web-Based Interactive 3D Ocean Data Visualization Platform**

Browser-native 3D workspace for the Indian Ocean (Andaman Sea + Sumatra Trench) showing model fields (temperature, salinity, currents, chlorophyll) on top of the **real GMRT sea floor**, together with real point observations (Argo floats), across depth and time.

---

## Quick Start

```bash
./dev.sh
```

That's it. Installs deps, starts both servers, and handles clean shutdown on Ctrl+C.

- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:8000

Or use `make dev` (same thing).

> **Windows:** Use `dev.sh` from Git Bash, WSL, or MSYS2. From PowerShell/CMD, use the manual commands below or install [Make for Windows](https://gnuwin32.sourceforge.net/packages/make.htm).

### Manual startup (if you prefer two terminals)

```bash
# Terminal 1 — Backend
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --reload       # API at http://localhost:8000

# Terminal 2 — Frontend
cd frontend
npm install
npm run dev                                     # app at http://localhost:5173
```

> **Windows (PowerShell):** Replace `python` with `py -3.11` (or `py -3.12`/`py -3.13` if needed). The venv setup is optional — just `pip install -r requirements.txt` in the backend folder.

> The bundled dataset (`bathymetry.nc`, `ocean_demo.nc`, `floats.json`) is already
> committed, so the demo runs fully offline. To regenerate it from the live
> GMRT / Argo sources (internet + ~2 min), run `python scripts/build_real_dataset.py`.

---

## What you can do in the demo (click-through order)

1. **Rotate / pan / zoom** the 3D ocean view (hold left-drag to rotate, right-drag to pan, scroll to zoom) — note the **real seabed terrain** and the **islands** (Andaman Is., Sumatra) rising from the GMRT elevation model.
2. **Switch variables** — Temperature / Salinity / U Current / V Current / Chlorophyll (left panel buttons).
3. **Drag the Depth slider** — note the plain-language band labels ("50 m — Thermocline") under the thumb; the surface recolors.
4. **Drag the Time slider** — 8 time steps through the day; the timestamp updates top-right and in the footer.
5. **Change the Color Scale** — 5 palettes; min/max legend updates in the top bar.
6. **Adjust Opacity** — watch the variable surface turn translucent and reveal the real trench + shelf beneath.
7. **Toggle Argo float markers** (real float positions) on/off.
8. **Click any float marker** — the depth-profile panel opens on the right with **observed** (solid) vs **model** (dashed) temperature and salinity curves.
9. **Flip the "Compare Model vs Observation" toggle** — the dashed model curves appear/disappear, and the float info card shows mean |ΔT| / |ΔS|.
10. **Hover the surface** — readout of lat, lon, depth and value bottom-left.

---

## API contract (6 endpoints, Swagger at `http://localhost:8000/docs`)

| Endpoint | Returns |
|---|---|
| `GET /api/variables` | `["temperature","salinity","u_current","v_current","chlorophyll"]` |
| `GET /api/meta` | `{ depths, times, lat_range, lon_range }` |
| `GET /api/field?variable=&depth=&time_index=` | `{ variable, depth, time, lat[], lon[], values[][], min, max }` — `null` cells allowed for no-data (below the real sea floor / on land) |
| `GET /api/bathymetry` | `{ units, lat[], lon[], values[][], min, max }` — real GMRT sea floor (m, −ve below sea level), same grid as `/api/field` |
| `GET /api/floats` | `[ { id, lat, lon } ]` |
| `GET /api/floats/{id}` | `{ id, lat, lon, profile[], model_profile[] }` — observed + nearest-model depth profiles |

All data flows through the **`DataAdapter`** interface (`backend/app/adapters/base.py`). Today `SyntheticAdapter` reads the committed local files (`ocean_demo.nc` + `bathymetry.nc` + `floats.json`); a future `INCOISAdapter` or `ArgoLiveAdapter` drops in behind `deps.py` without changing the API contract or the frontend.

---

## Architecture

```
Frontend (React + Three.js + Chart.js)  ──HTTP/JSON──▶  Backend (FastAPI + xarray + numpy)
  · 3D ocean scene (seabed terrain +       · /api/variables, /meta, /field, /bathymetry
    variable surface + islands)            · /api/floats, /api/floats/{id}
  · Control panel (variable/depth/time/    · DataAdapter → SyntheticAdapter
    scale/opacity/floats)                  ─▶ ocean_demo.nc + bathymetry.nc + floats.json
  · Argo marker layer
  · Depth-profile chart (model vs obs)
```

- **Frontend:** React (Vite) + TypeScript, Three.js (OrbitControls, CanvasTexture surface, displaced GMRT seabed terrain), Chart.js (react-chartjs-2 depth-profile), Zustand (4 domain stores).
- **Backend:** FastAPI + Uvicorn, xarray + netCDF4, NaN-safe JSON serialization, dependency-injected adapter.
- **Data:** real GMRT bathymetry (CC-BY 4.0, Andaman Sea + Sumatra Trench, ~1 km source meshed to 0.025°) with analytic 4D ocean fields masked to the real sea floor (lat −4–15°N, lon 92–106°E, 8 depths, 8 times) + real Argo float positions whose observed profiles come from the Ifremer GDAC where reachable.

---

## Testing

```bash
# Backend (30 tests)
cd backend && python -m pytest tests/ -v

# Frontend (lint + typecheck + build)
cd frontend && npm run verify
```

---

## Project layout

```
BrineView/
  dev.sh                          # one-command startup (./dev.sh or make dev)
  Makefile                        # make dev, make test, make clean
  .env.sample                     # all env vars documented
  .kiro/steering/                 # project standards + context

  backend/
    app/
      main.py                     # FastAPI app + CORS
      deps.py                     # adapter DI (one-line swap)
      utils.py                    # shared sanitize() for NaN/Inf → None
      adapters/
        base.py                   # DataAdapter ABC
        synthetic.py              # reads ocean_demo.nc + bathymetry.nc + floats.json
      routes/
        api.py                    # 6 ocean data endpoints
        auth.py                   # signup/login/OAuth
        upload.py                 # user data upload
      auth/
        config.py                 # env var config + startup validation
        security.py               # JWT (HS256) + PBKDF2 hashing
        storage.py                # JSON-file user persistence
        deps.py                   # FastAPI auth dependencies
    tests/                        # pytest suite (30 tests)
      test_utils.py               # sanitize edge cases
      test_auth.py                # JWT, passwords, OAuth state
      test_routes.py              # all API + auth endpoints
    data/                         # committed bundle (offline demo):
                                  #   ocean_demo.nc  bathymetry.nc  floats.json

  frontend/
    src/
      App.tsx                     # hash router + ErrorBoundary
      state/
        useAuthStore.ts           # auth + routing
        useOceanStore.ts          # ocean controls (variable/depth/time/scale)
        useDataStore.ts           # data cache (field/floats/bathymetry)
        useUploadStore.ts         # user data uploads
      api/
        client.ts                 # typed fetch wrappers
        auth.ts                   # auth API calls
      components/
        three/
          OceanScene.ts           # orchestrator (310 lines, down from 874)
          helpers.ts              # pure functions + constants
          terrain.ts              # bathymetry mesh creation
          environment.ts          # sky, sea, graticule, container
          markers.ts              # float marker management
          surface.ts              # field surface mesh
        controls/                 # variable/depth/time/scale/opacity/toggles
        ErrorBoundary.tsx         # React error boundary
        ...                       # TopBar, Footer, Legend, Tooltip, etc.
      pages/                      # Landing, Login, SignUp, Dashboard, About
      lib/                        # colormaps, depth bands, formatting, router
```

---

