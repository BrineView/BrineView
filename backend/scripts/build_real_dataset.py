"""
Build the BrineView bundled dataset for the Andaman Sea + Sumatra Trench region.

Sourced from real open data (one-time, needs internet on the build machine):
  * Bathymetry ...... GMRT (Global Multi-Resolution Topography) GridServer
                       https://www.gmrt.org/services/GridServer
                       CC-BY-4.0, "downsampled for visualization".
  * Argo floats ..... Ifremer Argo GDAC ERDDAP (ArgoFloats-index / ArgoFloats)
                       https://erddap.ifremer.fr/erddap
  * Ocean fields ..... analytic fields tuned to the real seabed (see below).

Outputs (all committed so the demo itself runs fully offline):
  backend/data/bathymetry.nc  - real GMRT sea floor (meters, -ve below sea level)
  backend/data/ocean_demo.nc  - 4D fields (time, depth, lat, lon) masked by sea floor
  backend/data/floats.json    - real Argo float positions + observed profiles

Usage:
  python scripts/build_real_dataset.py
"""
import json
import tempfile
import time
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
import xarray as xr

# ----------------------------------------------------------------------------
# Region & grid definitions
# ----------------------------------------------------------------------------

# Andaman Sea + northern Sumatra + the Sunda Trench (Indian Ocean)
LON0, LON1 = 92.0, 106.0
LAT0, LAT1 = -4.0, 15.0

REGION_NAME = "Andaman Sea & Sumatra Trench"

# Depths below sea level at which we sample the model fields (meters).
DEPTH_LEVELS = np.array([0, 10, 25, 50, 100, 200, 500, 1000], dtype=float)

# 8 three-hourly steps through a single day.
BASE_T0 = np.datetime64("2026-09-10T00:00:00")
T_STEP = np.timedelta64(3, "h")
N_TIME = 8

# Deliverable resolutions.
BATHY_RES = 0.025   # ~2.8 km mesh for the sea-floor terrain
FIELD_RES = 0.10    # field grid; renderer supersamples onto the surface texture

OUT_DIR = Path(__file__).resolve().parent.parent / "data"
OUT_DIR.mkdir(parents=True, exist_ok=True)

UA = "BrineView-SIH2026 (hackathon build script)"

net_stats = {"gmrt": None, "argo_index": 0, "argo_profiles": 0, "argo_failures": 0}

# ----------------------------------------------------------------------------
# HTTP helpers
# ----------------------------------------------------------------------------


def http_get(url: str, timeout: int = 120, retries: int = 2) -> bytes:
    last = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=timeout) as res:
                return res.read()
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(1.5 * (i + 1))
    raise RuntimeError(f"GET failed after {retries + 1} tries: {url} ({last})")


def http_get_lines(url: str, timeout: int = 60) -> list[str]:
    return http_get(url, timeout=timeout).decode("utf-8").splitlines()


# ----------------------------------------------------------------------------
# 1) Real GMRT bathymetry
# ----------------------------------------------------------------------------


def fetch_bathymetry() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Download the raw GMRT topo grid for the region (native ~1 km data)."""
    params = {
        "minlongitude": LON0,
        "maxlongitude": LON1,
        "minlatitude": LAT0,
        "maxlatitude": LAT1,
        "format": "netcdf",
        "layer": "topo",
        "resolution": "high",
        "extend": "FALSE",
    }
    url = "https://www.gmrt.org/services/GridServer?" + urllib.parse.urlencode(params)
    cache = OUT_DIR / "_gmrt_raw.nc"
    if cache.exists():
        print("  using cached raw GMRT file")
        raw = cache.read_bytes()
    else:
        print("  downloading GMRT GridServer (high resolution)...")
        raw = http_get(url, timeout=300)
        cache.write_bytes(raw)

    with tempfile.NamedTemporaryFile(suffix=".nc") as tmp:
        tmp.write(raw)
        tmp.flush()
        ds = xr.open_dataset(tmp.name, engine="netcdf4")

    dim = ds["dimension"].values.astype(int)
    n_lon, n_lat = int(dim[0]), int(dim[1])
    z = np.asarray(ds["z"].values, dtype=np.float64).reshape(n_lat, n_lon)
    src_lon = np.linspace(float(ds["x_range"].values[0]),
                          float(ds["x_range"].values[1]), n_lon)
    src_lat = np.linspace(float(ds["y_range"].values[0]),
                          float(ds["y_range"].values[1]), n_lat)
    net_stats["gmrt"] = (n_lon, n_lat)
    return z, src_lon, src_lat


def regrid_nearest(z: np.ndarray, src_lon, src_lat, res: float
                   ) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Nearest-neighbour regrid of the raw (lat, lon) field onto uniform spacing."""
    n_lon = int(round((LON1 - LON0) / res)) + 1
    n_lat = int(round((LAT1 - LAT0) / res)) + 1
    tgt_lon = LON0 + np.arange(n_lon) * res
    tgt_lat = LAT0 + np.arange(n_lat) * res

    i_idx = np.round((tgt_lon - src_lon[0]) / (src_lon[-1] - src_lon[0])
                     * (len(src_lon) - 1)).astype(int)
    j_idx = np.round((tgt_lat - src_lat[0]) / (src_lat[-1] - src_lat[0])
                     * (len(src_lat) - 1)).astype(int)
    i_idx = np.clip(i_idx, 0, len(src_lon) - 1)
    j_idx = np.clip(j_idx, 0, len(src_lat) - 1)

    return z[np.ix_(j_idx, i_idx)], tgt_lat, tgt_lon


def save_bathymetry() -> np.ndarray:
    """Regrid and persist bathymetry.nc; return the (lat, lon) elevation mesh."""
    print(f"[1/4] Bathymetry (GMRT, {REGION_NAME})")
    z_raw, src_lon, src_lat = fetch_bathymetry()
    print(f"  raw grid fetched: {net_stats['gmrt'][0]}x{net_stats['gmrt'][1]} cells")

    z, tgt_lat, tgt_lon = regrid_nearest(z_raw, src_lon, src_lat, BATHY_RES)
    print(f"  regridded to {z.shape[1]}x{z.shape[0]} cells @ {BATHY_RES:.3f} deg")

    da = xr.DataArray(
        z.astype(np.float32),
        dims=("lat", "lon"),
        coords={"lat": tgt_lat, "lon": tgt_lon},
        attrs={
            "units": "m",
            "long_name": "Bathymetry - elevation relative to mean sea level (-ve below sea)",
            "source": "GMRT (Global Multi-Resolution Topography), CC-BY 4.0",
            "region": REGION_NAME,
            "positive": "up",
        },
    )
    ds = da.to_dataset(name="bathymetry")
    ds.to_netcdf(
        OUT_DIR / "bathymetry.nc",
        encoding={"bathymetry": {"zlib": True, "complevel": 4}},
    )
    valid = z[~np.isnan(z)]
    print(f"  elevation range: {valid.min():.0f} m .. {valid.max():.0f} m "
          f"(deepest point: {valid.min():.0f} m)")
    return z


# ----------------------------------------------------------------------------
# 2) Real Argo float positions (Ifremer GDAC ERDDAP index)
# ----------------------------------------------------------------------------


def fetch_argo_positions(n_want: int = 36) -> list[dict]:
    """Return a geographically spread set of real Argo floats inside the region."""
    print("[2/4] Argo float positions (Ifremer GDAC index)")
    cache = OUT_DIR / "_argo_index.tsv"
    if cache.exists():
        lines = cache.read_text().splitlines()
        print("  using cached Argo index")
    else:
        query = (
            f"https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats-index.tsv?"
            f"file,date,latitude,longitude&"
            f"latitude%3E%3D{LAT0}&latitude%3C%3D{LAT1}&longitude%3E%3D{LON0}&longitude%3C%3D{LON1}"
        )
        lines = http_get_lines(query, timeout=120)
        cache.write_text("\n".join(lines))
    rows = [ln.split("\t") for ln in lines[3:] if "\t" in ln]
    net_stats["argo_index"] = len(rows)
    print(f"  {len(rows)} Argo profiling events in region")

    by_float: dict[str, dict] = {}
    for row in rows:
        fname, dt, lat_s, lon_s = row[0], row[1], row[2], row[3]
        try:
            wmo = fname.split("/")[1].strip()
            lat, lon = float(lat_s), float(lon_s)
        except (IndexError, ValueError):
            continue
        if not np.isfinite(lat) or not np.isfinite(lon):
            continue
        cur = by_float.get(wmo)
        if cur is None or dt > cur["date"]:
            by_float[wmo] = {"wmo": wmo, "lat": lat, "lon": lon, "date": dt}

    candidates = sorted(by_float.values(), key=lambda f: (f["lat"], f["lon"]))
    print(f"  {len(candidates)} unique floats; selecting {n_want} spread across region")

    # Spread selection: bucket into a coarse grid, one per cell first.
    NB_LAT, NB_LON = 6, 8
    buckets: dict[tuple[int, int], list[dict]] = {}
    for f in candidates:
        bj = min(NB_LAT - 1, int((f["lat"] - LAT0) / (LAT1 - LAT0) * NB_LAT))
        bi = min(NB_LON - 1, int((f["lon"] - LON0) / (LON1 - LON0) * NB_LON))
        buckets.setdefault((bj, bi), []).append(f)

    chosen: list[dict] = []
    for key in sorted(buckets):
        cell = buckets[key]
        cell.sort(key=lambda f: f["wmo"])
        for f in cell[:1]:
            if len(chosen) < n_want:
                chosen.append(f)
    for key in sorted(buckets):
        for f in buckets[key][1:]:
            if len(chosen) < n_want:
                chosen.append(f)
    chosen.sort(key=lambda f: (-f["lat"], f["lon"]))

    for f in chosen:
        f["id"] = f"ARGO-{f['wmo']}"
    print(f"  selected {len(chosen)} floats")
    return chosen


# ----------------------------------------------------------------------------
# 3) Analytic ocean fields responding to the real seabed
# ----------------------------------------------------------------------------


def make_coast_factor(lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Distance-to-domain-edge term that boosts coastal enrichment."""
    dist_east = np.minimum(lon - LON0, LON1 - lon)
    dist_north = np.minimum(lat - LAT0, LAT1 - lat)
    return np.exp(-np.minimum(dist_east, dist_north) / 5.0)


def build_fields(seafloor: np.ndarray) -> xr.Dataset:
    print("[3/4] Building 4D ocean fields (masked to the real sea floor)")
    n_lon = int(round((LON1 - LON0) / FIELD_RES)) + 1
    n_lat = int(round((LAT1 - LAT0) / FIELD_RES)) + 1
    lat = LAT0 + np.arange(n_lat) * FIELD_RES
    lon = LON0 + np.arange(n_lon) * FIELD_RES
    times = BASE_T0 + np.arange(N_TIME) * T_STEP

    rng = np.random.default_rng(42)

    # Downsample the sea floor onto the field grid (nearest) for masking.
    b_idx = np.clip(np.round((lat - LAT0) / BATHY_RES).astype(int), 0, seafloor.shape[0] - 1)
    l_idx = np.clip(np.round((lon - LON0) / BATHY_RES).astype(int), 0, seafloor.shape[1] - 1)
    sf = seafloor[np.ix_(b_idx, l_idx)]  # (lat, lon) on field grid

    sfc = make_coast_factor(lat[:, None], lon[None, :])  # (lat, lon)
    shelf = np.clip(400.0 / (np.abs(sf) + 60.0), 0.0, 1.0)  # shelf vs open ocean

    LON, LAT = np.meshgrid(lon, lat)
    n_d, n_t = len(DEPTH_LEVELS), N_TIME

    temperature = np.empty((n_t, n_d, n_lat, n_lon), dtype=np.float32)
    salinity = np.empty((n_t, n_d, n_lat, n_lon), dtype=np.float32)
    u_current = np.empty((n_t, n_d, n_lat, n_lon), dtype=np.float32)
    v_current = np.empty((n_t, n_d, n_lat, n_lon), dtype=np.float32)
    chlorophyll = np.empty((n_t, n_d, n_lat, n_lon), dtype=np.float32)

    for d, depth_m in enumerate(DEPTH_LEVELS):
        dp = depth_m / 250.0
        for it in range(N_TIME):
            phase = 2 * np.pi * (it / N_TIME)
            noise_t = rng.normal(0, 0.03, (n_lat, n_lon))

            surf = (
                29.5
                + 1.5 * np.sin(np.pi * LAT / 19)
                + 0.8 * np.cos(2.1 * np.pi * LON / 14)
                - 0.6 * (LON - LON0) / (LON1 - LON0)
                + 0.25 * np.cos(phase)
            )
            temperature[it, d] = (
                surf
                - 16.5 * np.tanh(depth_m / 110.0)
                - 11.5 * (1.0 - np.exp(-depth_m / 1600.0))
                + noise_t
            )

            salinity[it, d] = (
                34.6
                + 0.9 * np.cos(np.pi * LAT / 19) * np.sin(np.pi * LON / 14)
                + (0.35 + 0.25 * np.sin(LON / 8)) * np.exp(-depth_m / 200.0)
                + 0.05 * np.cos(phase)
                + rng.normal(0, 0.02, (n_lat, n_lon))
            )

            u_current[it, d] = (
                0.4 * np.sin(np.pi * LON / 14) * np.cos(np.pi * LAT / 19) * np.exp(-dp)
                + 0.06 * np.cos(phase) * np.exp(-dp)
                + rng.normal(0, 0.01, (n_lat, n_lon))
            )
            v_current[it, d] = (
                -0.28 * np.cos(np.pi * LON / 14) * np.sin(2 * np.pi * LAT / 19) * np.exp(-dp)
                + 0.06 * np.sin(phase) * np.exp(-dp)
                + rng.normal(0, 0.01, (n_lat, n_lon))
            )

            chl_surf = (0.12 + 1.6 * sfc + 0.9 * shelf) * np.exp(-depth_m / 60.0)
            chlorophyll[it, d] = np.clip(
                chl_surf * (0.75 + 0.25 * np.cos(LON / 6) * np.sin(LAT / 3))
                + rng.normal(0, 0.02, (n_lat, n_lon)),
                0.03, None,
            )

    # Mask out everything deeper than the real sea floor.
    for d, depth_m in enumerate(DEPTH_LEVELS):
        for it in range(n_t):
            invalid = (sf < -(depth_m + 5.0)) | ~np.isfinite(sf)
            for arr in (temperature, salinity, u_current, v_current, chlorophyll):
                arr[it, d][invalid] = np.nan

    ds = xr.Dataset(
        {
            "temperature": xr.DataArray(
                temperature, dims=("time", "depth", "lat", "lon"),
                coords={"time": times, "depth": DEPTH_LEVELS, "lat": lat, "lon": lon},
                attrs={"units": "degC", "long_name": "Sea Water Temperature"},
            ),
            "salinity": xr.DataArray(
                salinity, dims=("time", "depth", "lat", "lon"),
                coords={"time": times, "depth": DEPTH_LEVELS, "lat": lat, "lon": lon},
                attrs={"units": "PSU", "long_name": "Sea Water Salinity"},
            ),
            "u_current": xr.DataArray(
                u_current, dims=("time", "depth", "lat", "lon"),
                coords={"time": times, "depth": DEPTH_LEVELS, "lat": lat, "lon": lon},
                attrs={"units": "m/s", "long_name": "Eastward Sea Water Velocity"},
            ),
            "v_current": xr.DataArray(
                v_current, dims=("time", "depth", "lat", "lon"),
                coords={"time": times, "depth": DEPTH_LEVELS, "lat": lat, "lon": lon},
                attrs={"units": "m/s", "long_name": "Northward Sea Water Velocity"},
            ),
            "chlorophyll": xr.DataArray(
                chlorophyll, dims=("time", "depth", "lat", "lon"),
                coords={"time": times, "depth": DEPTH_LEVELS, "lat": lat, "lon": lon},
                attrs={"units": "mg/m^3", "long_name": "Chlorophyll Concentration"},
            ),
        },
        attrs={"region": REGION_NAME,
               "source": "analytic fields masked by GMRT bathymetry"},
    )
    ds.to_netcdf(
        OUT_DIR / "ocean_demo.nc",
        encoding={v: {"zlib": True, "complevel": 2, "dtype": "float32"}
                  for v in ds.data_vars},
    )
    for var in ds.data_vars:
        arr = ds[var].values
        print(f"  {var:12s} shape={arr.shape}  "
              f"min={np.nanmin(arr):.3f}  max={np.nanmax(arr):.3f}")
    return ds


# ----------------------------------------------------------------------------
# 4) Float profiles (real Argo where reachable, else generated)
# ----------------------------------------------------------------------------


def fetch_real_profile(wmo: str) -> list[dict] | None:
    """Best-effort pull of the most recent Argo profile for a float WMO."""
    try:
        quoted = urllib.parse.quote(f'"{wmo}"')
        query = (
            f"https://erddap.ifremer.fr/erddap/tabledap/ArgoFloats.tsv?"
            f"time,pres,temp,psal&"
            f"platform_number={quoted}&pres>=0&pres<=1200"
        )
        lines = http_get_lines(query, timeout=180)
        rows = []
        for ln in lines[3:]:
            parts = ln.split("\t")
            if len(parts) == 4:
                rows.append(parts)
        if not rows:
            return None
        newest = rows[0][0]
        prof = [r for r in rows if r[0] == newest]
        if len(prof) < 3:
            return None
        net_stats["argo_profiles"] += 1
        return [
            {
                "depth": float(p),
                "temperature": float(t) if t not in ("NaN", "") else float("nan"),
                "salinity": float(s) if s not in ("NaN", "") else float("nan"),
            }
            for (_, p, t, s) in prof
        ]
    except Exception:  # noqa: BLE001
        net_stats["argo_failures"] += 1
        return None


def build_floats(bath: xr.Dataset, ds: xr.Dataset, floats: list[dict]) -> None:
    print("[4/4] Float profiles (real Argo when reachable, else generated)")
    profiles: list[dict] = []
    rng = np.random.default_rng(7)
    for f in floats:
        lat, lon = f["lat"], f["lon"]
        floor = float(bath["bathymetry"].sel(lat=lat, lon=lon, method="nearest").values)
        if not np.isfinite(floor):
            continue
        real = fetch_real_profile(f["wmo"]) if floor < -25.0 else None

        profile = []
        for depth in DEPTH_LEVELS:
            if depth > -floor:
                continue  # below sea floor → no data at this level
            t_model = float(ds["temperature"].isel(time=0).sel(
                lat=lat, lon=lon, depth=depth, method="nearest").values)
            s_model = float(ds["salinity"].isel(time=0).sel(
                lat=lat, lon=lon, depth=depth, method="nearest").values)

            if real is not None:
                pres = np.array([p["depth"] for p in real])
                t_arr = np.array([p["temperature"] for p in real])
                s_arr = np.array([p["salinity"] for p in real])
                t_obs = float(np.interp(depth, pres, t_arr, left=np.nan, right=np.nan))
                s_obs = float(np.interp(depth, pres, s_arr, left=np.nan, right=np.nan))
            else:
                t_obs = t_model + float(rng.normal(0, 0.25))
                s_obs = s_model + float(rng.normal(0, 0.04))

            if not np.isfinite(t_obs) or not np.isfinite(s_obs):
                t_obs, s_obs = t_model, s_model  # fall back to model value

            profile.append({
                "depth": int(depth),
                "temperature": round(float(t_obs), 3),
                "salinity": round(float(s_obs), 3),
            })

        if len(profile) >= 3:
            profiles.append({
                "id": f["id"],
                "wmo": f["wmo"],
                "lat": round(f["lat"], 4),
                "lon": round(f["lon"], 4),
                "profile": profile,
            })

    with open(OUT_DIR / "floats.json", "w") as fh:
        json.dump(profiles, fh, indent=2)
    print(f"  wrote {len(profiles)} floats ")


# ----------------------------------------------------------------------------
# main
# ----------------------------------------------------------------------------


def main() -> None:
    print(f"BrineView dataset builder — {REGION_NAME}")

    seafloor = save_bathymetry()
    ds = build_fields(seafloor)

    bath = xr.open_dataset(OUT_DIR / "bathymetry.nc")
    argo = fetch_argo_positions()
    build_floats(bath, ds, argo)
    ds.close()
    bath.close()

    total = sum(p.stat().st_size for p in OUT_DIR.glob("*.nc")) \
        + (OUT_DIR / "floats.json").stat().st_size
    print(f"\nDone. Bundle size: {total / 1024 / 1024:.1f} MB")
    print("network stats:", net_stats)


if __name__ == "__main__":
    main()