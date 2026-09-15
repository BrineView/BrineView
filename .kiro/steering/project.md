# BrineView Project Context

## Overview
BrineView is a browser-native 3D ocean data visualization platform built for
Smart India Hackathon 2026 (Problem Statement 26067). It visualizes ocean
parameters (temperature, salinity, currents, chlorophyll) across depth and
time for the Indian Ocean region (Andaman Sea + Sumatra Trench).

## Key Features
- 3D terrain and surface visualization with Three.js
- Real Argo float observation comparisons against model data
- User data upload (NetCDF/CSV) with live preview
- Email + Google/GitHub OAuth authentication
- Interactive depth profiles with Chart.js

## Data Sources
- `ocean_demo.nc` (13MB) — 4D ocean fields: 8 time × 8 depth × 151 lat × 141 lon
- `bathymetry.nc` (1.3MB) — GMRT sea floor terrain
- `floats.json` (28KB) — 36 Argo float positions + profiles

## Running
- `make dev` — starts both backend (port 8000) and frontend (port 5173)
- Backend only: `cd backend && python -m uvicorn app.main:app --reload`
- Frontend only: `cd frontend && npm run dev`

## Environment Variables
See `.env.sample` at project root for all configuration options.
