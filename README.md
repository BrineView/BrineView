# BrineView (OceanLens 3D)

Smart India Hackathon 2026 · Problem Statement 26067 — **Web-Based Interactive 3D Ocean Data Visualization Platform**

Browser-native 3D workspace for Indian Ocean model fields (temperature, salinity, currents, chlorophyll) together with real point observations (Argo floats), across depth and time.

---

## Run it 

### Terminal 1 — Backend

```bash
cd backend
py -3.11 -m venv .venv && .venv\Scripts\activate
pip install -r requirements.txt
python scripts\generate_synthetic_ocean.py      # one-time: builds ocean_demo.nc + floats.json
py -3.11 -m uvicorn app.main:app --reload       # API at http://localhost:8000
```

> No Python 3.11? Any 3.11+ works (3.12/3.13/3.14 all tested on Windows).

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm run dev                                     # app at http://localhost:5173
```

That's it. The Vite dev server proxies `/api` → `localhost:8000`, so there is **no internet dependency** — everything runs on synthetic local data.

---

## What you can do in the demo (click-through order)

1. **Rotate / pan / zoom** the 3D ocean view (hold left-drag to rotate, right-drag to pan, scroll to zoom).
2. **Switch variables** — Temperature / Salinity / U Current / V Current / Chlorophyll (left panel buttons).
3. **Drag the Depth slider** — note the plain-language band labels ("50 m — Thermocline") under the thumb; the surface recolors.
4. **Drag the Time slider** — 8 time steps through the day; the timestamp updates top-right and in the footer.
5. **Change the Color Scale** — 5 palettes; min/max legend updates in the top bar.
6. **Adjust Opacity** — make the surface translucent.
7. **Toggle Argo float markers** on/off.
8. **Click any float marker** — the depth-profile panel opens on the right with **observed** (solid) vs **model** (dashed) temperature and salinity curves.
9. **Flip the "Compare Model vs Observation" toggle** — the dashed model curves appear/disappear, and the float info card shows mean |ΔT| / |ΔS|.
10. **Hover the surface** — readout of lat, lon, depth and value bottom-left.

---

## API contract (5 endpoints, Swagger at `http://localhost:8000/docs`)

| Endpoint | Returns |
|---|---|
| `GET /api/variables` | `["temperature","salinity","u_current","v_current","chlorophyll"]` |
| `GET /api/meta` | `{ depths, times, lat_range, lon_range }` |
| `GET /api/field?variable=&depth=&time_index=` | `{ variable, depth, time, lat[], lon[], values[][], min, max }` — `null` cells allowed for no-data |
| `GET /api/floats` | `[ { id, lat, lon } ]` |
| `GET /api/floats/{id}` | `{ id, lat, lon, profile[], model_profile[] }` — observed + nearest-model depth profiles |

All data flows through the **`DataAdapter`** interface (`backend/app/adapters/base.py`). Today only `SyntheticAdapter` exists (reads local `ocean_demo.nc` + `floats.json`); a future `INCOISAdapter` or `ArgoLiveAdapter` drops in behind `deps.py` without changing the API contract or the frontend.

---

## Architecture

```
Frontend (React + Three.js + Chart.js)  ──HTTP/JSON─▶  Backend (FastAPI + xarray + numpy)
  · 3D ocean scene                                    · /api/variables, /meta, /field
  · Control panel (variable/depth/time/scale/opacity) · /api/floats, /api/floats/{id}
  · Argo marker layer                                · DataAdapter → SyntheticAdapter
  · Depth-profile chart (model vs obs)                  ─▶ ocean_demo.nc + floats.json
```

- **Frontend:** React (Vite) + TypeScript, Three.js (OrbitControls, CanvasTexture surface, InstancedMarker-style raycasting), Chart.js (react-chartjs-2 depth-profile), Zustand.
- **Backend:** FastAPI + Uvicorn, xarray + netCDF4, NaN-safe JSON serialization, dependency-injected adapter.
- **Data:** synthetic Indian Ocean grid (lat 0–25°N, lon 60–95°E, 8 depths, 8 times) + 20 mock Argo floats whose observed profiles are consistent with the model field.

---

## To the judges — what this MVP does NOT yet do (say this honestly)

> "This prototype uses a representative synthetic dataset built to the same structure as real INCOIS/Argo NetCDF data, through a swappable adapter, so the next step is plugging in the live INCOIS model output and the public Argo GDAC feed without touching the frontend or API contract."

User validation is an early, small (n=7), mostly-student survey used to sanity-check feature priority — not a validated study, and not yet tested with an actual oceanographer or forecaster.

Cut scope (future work): live NetCDF ingestion pipelines, OGC WMS/WCS servers, CF-convention validation tooling, land/coast masks, current arrow overlays, live Glider feeds, Cesium-level georeferencing.

---

## Project layout

```
backend/
  app/
    main.py                 # FastAPI app + CORS
    deps.py                 # adapter DI (one-line swap)
    adapters/base.py        # DataAdapter ABC
    adapters/synthetic.py   # synthetic NetCDF + floats reader
    routes/api.py           # the 5 endpoints
  scripts/generate_synthetic_ocean.py
  data/                     # generated (gitignored): ocean_demo.nc, floats.json
frontend/
  src/
    App.tsx                 # layout
    state/useOceanStore.ts  # Zustand UI/data store
    api/client.ts           # typed fetch wrappers
    lib/                    # colormaps, depth bands, formatting
    components/             # panels, controls, 3D scene, charts
```
