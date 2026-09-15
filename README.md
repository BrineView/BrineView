# BrineView

Smart India Hackathon 2026 · Problem Statement 26067 — **Web-Based Interactive 3D Ocean Data Visualization Platform**

Browser-native 3D workspace for the Indian Ocean (Andaman Sea + Sumatra Trench) showing model fields (temperature, salinity, currents, chlorophyll) on top of the **real GMRT sea floor**, together with real point observations (Argo floats), across depth and time.

---

## Run it 

### Terminal 1 — Backend

```bash
## Windows
cd BrineView
cd Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload


## Linux
cd BrineView
cd Backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

> The bundled dataset (`bathymetry.nc`, `ocean_demo.nc`, `floats.json`) is already
> committed, so the demo runs fully offline. To regenerate it from the live
> GMRT / Argo sources (internet + ~2 min), run `python scripts/build_real_dataset.py`.

> No Python 3.11? Any 3.11+ works (3.12/3.13/3.14 all tested on Windows).

### Terminal 2 — Frontend

```bash
cd BrineView
cd frontend
npm install
npm run dev                                     # app at http://localhost:5173
```

That's it. The Vite dev server proxies `/api` → `localhost:8000`, so there is **no internet dependency** — everything runs on the committed local dataset (real GMRT bathymetry + real Argo positions + analytic fields).

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

- **Frontend:** React (Vite) + TypeScript, Three.js (OrbitControls, CanvasTexture surface, displaced GMRT seabed terrain, InstancedMarker-style raycasting), Chart.js (react-chartjs-2 depth-profile), Zustand.
- **Backend:** FastAPI + Uvicorn, xarray + netCDF4, NaN-safe JSON serialization, dependency-injected adapter.
- **Data:** real GMRT bathymetry (CC-BY 4.0, Andaman Sea + Sumatra Trench, ~1 km source meshed to 0.025°) with analytic 4D ocean fields masked to the real sea floor (lat −4–15°N, lon 92–106°E, 8 depths, 8 times) + real Argo float positions whose observed profiles come from the Ifremer GDAC where reachable.

---

## To the judges — what this MVP does and does NOT yet do (say this honestly)

> "The sea floor is real GMRT bathymetry and the float positions are real Argo floats from the
> Ifremer GDAC (with observed profiles where reachable). The ocean *fields* themselves are
> analytic — built to the same (time, depth, lat, lon) NetCDF structure as real INCOIS model
> output — and flow through a swappable `DataAdapter`, so the next step is plugging in the live
> INCOIS model output without touching the frontend or API contract."

User validation is an early, small (n=7), mostly-student survey used to sanity-check feature priority — not a validated study, and not yet tested with an actual oceanographer or forecaster.

Cut scope (future work): live NetCDF ingestion pipelines and INCOIS/Argo live feeds, OGC WMS/WCS servers, CF-convention validation tooling, real-time blending of successive Argo cycles, current arrow overlays from the live model, Cesium-level georeferencing.

---

## Project layout

```
backend/
  app/
    main.py                 # FastAPI app + CORS
    deps.py                 # adapter DI (one-line swap)
    adapters/base.py        # DataAdapter ABC
    adapters/synthetic.py   # reads ocean_demo.nc + bathymetry.nc + floats.json
    routes/api.py           # the 6 endpoints
  scripts/build_real_dataset.py   # one-time: GMRT bathy + Argo + fields → .nc + .json
  data/                     # committed bundle (no internet needed to demo):
                            #   ocean_demo.nc  bathymetry.nc  floats.json  users.json
frontend/
  src/
    App.tsx                 # routing shell
    state/useOceanStore.ts  # Zustand UI/data store
    api/client.ts           # typed fetch wrappers
    lib/                    # colormaps, depth bands, formatting
    components/             # panels, controls, 3D scene, charts
```
