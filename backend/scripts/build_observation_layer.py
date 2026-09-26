"""Build (or rebuild) the observation layer for the demo dataset.

Reproduces floats.json with:
  - finite observed profiles (model value + measurement noise) on the same
    depth levels as the committed dataset, truncated at the local sea floor
  - a short surface trajectory per float (positions per time step) so the
    frontend can animate floats with the time slider

And creates gliders.json: deterministic glider missions (loop tracks) with
CTD observation stations, each matched against the analytic model.

Fully offline and deterministic — safe to re-run at any time.

Usage:
    python scripts/build_observation_layer.py
"""
import json
from pathlib import Path

import numpy as np
import xarray as xr

DATA = Path(__file__).resolve().parent.parent / "data"
DEPTH_LEVELS = [0, 10, 25, 50, 100, 200, 500, 1000]
N_TIME = 8
T_NOISE = 0.25  # °C — floats.json measurement uncertainty (matches build_real_dataset)
S_NOISE = 0.04  # PSU
G_T_NOISE = 0.12
G_S_NOISE = 0.02


def _load_nc(name: str):
    for engine in ("netcdf4", "h5netcdf"):
        try:
            return xr.open_dataset(str(DATA / name), engine=engine)
        except Exception:
            continue
    raise FileNotFoundError(f"could not open {name}")


def _sea_floor(bathy, lat: float, lon: float) -> float | None:
    if bathy is None:
        return None
    val = float(
        bathy["bathymetry"].sel(lat=lat, lon=lon, method="nearest").values
    )
    return val if np.isfinite(val) else None


def _build_floats(ds, bathy):
    with open(DATA / "floats.json") as f:
        floats = json.load(f)

    depths = ds.depth.values
    for i, fl in enumerate(floats):
        rng = np.random.default_rng(1000 + i)
        floor = _sea_floor(bathy, fl["lat"], fl["lon"])
        profile = []
        for d in depths:
            if floor is not None and int(d) > -floor:
                break
            t_mod = float(
                ds["temperature"].isel(time=0).sel(
                    lat=fl["lat"], lon=fl["lon"], depth=d, method="nearest"
                ).values
            )
            s_mod = float(
                ds["salinity"].isel(time=0).sel(
                    lat=fl["lat"], lon=fl["lon"], depth=d, method="nearest"
                ).values
            )
            if not np.isfinite(t_mod) or not np.isfinite(s_mod):
                break
            profile.append({
                "depth": int(d),
                "temperature": round(float(t_mod) + rng.normal(0, T_NOISE), 3),
                "salinity": round(float(s_mod) + rng.normal(0, S_NOISE), 3),
            })

        # Plant one deterministic sensor anomaly (wire-bend/tilt) at a fixed
        # record so the AI anomaly detector has a real, findable case. The
        # detector is not told which float — it must find it from residual
        # statistics. Marked as provenance for the demonstration.
        if i == 7:
            for p in profile:
                if p["depth"] in (50, 100, 200):
                    p["temperature"] = round(p["temperature"] + 2.2, 3)
                elif p["depth"] == 25:
                    p["temperature"] = round(p["temperature"] + 1.2, 3)
            fl["mode_anomaly"] = "planted_wire_bend"

        # short surface drift per time step (lat/lon random walk, bounded)
        drift_lat = np.cumsum(rng.normal(0, 0.12, N_TIME))
        drift_lon = np.cumsum(rng.normal(0, 0.12, N_TIME))
        lat_min, lat_max = float(ds.lat.min()), float(ds.lat.max())
        lon_min, lon_max = float(ds.lon.min()), float(ds.lon.max())
        lat0 = fl["lat"]
        lon0 = fl["lon"]
        trajectory = []
        for t in range(N_TIME):
            lat = np.clip(lat0 + drift_lat[t], lat_min, lat_max)
            lon = np.clip(lon0 + drift_lon[t], lon_min, lon_max)
            trajectory.append({
                "t": t,
                "lat": round(float(lat), 4),
                "lon": round(float(lon), 4),
            })

        fl["trajectory"] = trajectory
        fl["profile"] = profile

    with open(DATA / "floats.json", "w") as f:
        json.dump(floats, f, indent=2, allow_nan=False)
    print(f"floats.json: {len(floats)} records, trajectories + finite profiles")


TRACKS = [
    # (id_num, name, lat0, lon0, rlat, rlon, phase, max_depth)
    (1, "SeaExplorer SG-01", 4.8, 94.6, 1.1, 0.9, 0.0, 1000),
    (2, "SeaExplorer SG-02", 1.6, 95.2, 0.9, 1.2, 1.3, 1000),
    (3, "Slocum G2 SG-03", 8.6, 94.1, 0.8, 0.7, 2.6, 1000),
    (4, "SeaGlider SG-04", 2.9, 96.8, 0.7, 0.5, 0.7, 500),
    (5, "Slocum G2 SG-05", 10.8, 96.5, 0.6, 0.6, 1.9, 500),
    (6, "SeaExplorer SG-06", 6.2, 98.6, 0.5, 0.8, 3.3, 1000),
]


def _build_gliders(ds, bathy):
    depths = ds.depth.values
    gliders = []
    for (num, name, lat0, lon0, rlat, rlon, phase, max_depth) in TRACKS:
        rng = np.random.default_rng(2000 + num)
        gid = f"GLIDER-{num:02d}"
        track = []
        for t in range(N_TIME):
            a = 2.0 * np.pi * (t / (N_TIME - 1)) + phase
            lat = float(np.clip(lat0 + rlat * np.sin(a), ds.lat.min(), ds.lat.max()))
            lon = float(np.clip(lon0 + rlon * np.cos(a), ds.lon.min(), ds.lon.max()))
            track.append({"t": t, "lat": round(lat, 4), "lon": round(lon, 4)})

        # 4 CTD observation stations along the loop
        station_idx = [1, 3, 5, 7]
        stations = []
        for si in station_idx:
            loc = track[si]
            floor = _sea_floor(bathy, loc["lat"], loc["lon"])
            depth_prof = []
            for d in depths:
                if int(d) > max_depth:
                    continue
                if floor is not None and int(d) > -floor:
                    continue
                t_mod = float(
                    ds["temperature"].isel(time=0).sel(
                        lat=loc["lat"], lon=loc["lon"], depth=d, method="nearest"
                    ).values
                )
                s_mod = float(
                    ds["salinity"].isel(time=0).sel(
                        lat=loc["lat"], lon=loc["lon"], depth=d, method="nearest"
                    ).values
                )
                if not np.isfinite(t_mod) or not np.isfinite(s_mod):
                    continue
                depth_prof.append({
                    "depth": int(d),
                    "temperature": round(float(t_mod) + rng.normal(0, G_T_NOISE), 3),
                    "salinity": round(float(s_mod) + rng.normal(0, G_S_NOISE), 3),
                })
            if depth_prof:
                stations.append({"t": loc["t"], "lat": loc["lat"], "lon": loc["lon"],
                                 "profile": depth_prof})

        gliders.append({
            "id": gid,
            "name": name,
            "max_depth": max_depth,
            "track": track,
            "stations": stations,
        })
        print(f"  {gid} {name}: track {len(track)} pts, {len(stations)} stations")

    with open(DATA / "gliders.json", "w") as f:
        json.dump(gliders, f, indent=2, allow_nan=False)
    print(f"gliders.json: {len(gliders)} missions")


def main() -> None:
    ds = _load_nc("ocean_demo.nc")
    bathy = None
    try:
        bathy = _load_nc("bathymetry.nc")
    except FileNotFoundError:
        print("bathymetry.nc missing — stations will not be sea-floor-truncated")
    _build_floats(ds, bathy)
    _build_gliders(ds, bathy)


if __name__ == "__main__":
    main()