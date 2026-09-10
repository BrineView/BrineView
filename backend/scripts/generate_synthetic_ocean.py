"""
Generate synthetic but realistic ocean NetCDF data + mock Argo floats JSON.
Output: backend/data/ocean_demo.nc and backend/data/floats.json
"""
import json
from pathlib import Path

import numpy as np
import xarray as xr

# --- deterministic RNG ---
rng = np.random.default_rng(42)

# --- output directory ---
out_dir = Path(__file__).resolve().parent.parent / "data"
out_dir.mkdir(parents=True, exist_ok=True)

# --- grid ---
depth_levels = np.array([0, 10, 25, 50, 100, 200, 500, 1000], dtype=float)
lat = np.arange(0.0, 25.001, 1.0)  # 26 points
lon = np.arange(60.0, 95.001, 1.0)  # 36 points
base_t0 = np.datetime64("2026-09-10T00:00:00")
times = base_t0 + np.arange(8) * np.timedelta64(3, "h")
n_time, n_depth, n_lat, n_lon = len(times), len(depth_levels), len(lat), len(lon)

print(f"Grid: {n_time} times x {n_depth} depths x {n_lat} lats x {n_lon} lons = {n_time*n_depth*n_lat*n_lon} cells")


# --- analytic field generators ---

def thermal_profile(d: np.ndarray) -> np.ndarray:
    """Temperature vs depth (°C): warm surface ~29°C, thermocline curve."""
    return 29.0 - 16.0 * np.tanh(d / 110.0)


def surf_temperature(lat_arr: np.ndarray, lon_arr: np.ndarray) -> np.ndarray:
    """Spatial temperature pattern at the surface."""
    LON, LAT = np.meshgrid(lon_arr, lat_arr)
    return (
        28.5
        + 1.6 * np.sin(np.pi * LAT / 25) * np.cos(1.3 * np.pi * LON / 35)
        + 0.7 * np.cos(1.7 * np.pi * LAT / 25)
        + 0.4 * np.sin(2.1 * np.pi * LON / 35)
    )


def make_temperature(depth_levels, lat, lon):
    """4D temperature array (time, depth, lat, lon)."""
    # Base profile: ~29°C surface, ~13°C at 1000m
    tp = thermal_profile(depth_levels)[:, None, None]  # (D,1,1)
    # Spatial variation at surface, decaying with depth
    st = surf_temperature(lat, lon)[None, :, :]  # (1,Ly,Lx)
    depth_decay = np.exp(-depth_levels / 400)[:, None, None]  # (D,1,1)
    # Temperature = profile + scaled spatial anomaly
    T = tp + (st - 28.5) * depth_decay  # spatial anomaly around 28.5 baseline
    T = T + rng.normal(0, 0.03, T.shape)
    return np.broadcast_to(T[None, :, :, :], (n_time, n_depth, n_lat, n_lon)).copy()


def make_salinity(depth_levels, lat, lon):
    """4D salinity array."""
    LON, LAT = np.meshgrid(lon, lat)
    base = 34.8 + 0.9 * np.cos(np.pi * LAT / 25) * np.sin(np.pi * LON / 35)
    depth_term = (0.5 + 0.4 * np.sin(LON / 8)) * np.exp(-depth_levels[:, None, None] / 200)
    S = base[None, None, :, :] + depth_term
    S = S + rng.normal(0, 0.02, S.shape)
    return np.broadcast_to(S, (n_time, n_depth, n_lat, n_lon)).copy()


def make_u_current(depth_levels, lat, lon):
    """4D u-current array."""
    LON, LAT = np.meshgrid(lon, lat)
    u = 0.35 * np.sin(np.pi * LON / 35) * np.cos(np.pi * LAT / 25) * np.exp(-depth_levels[:, None, None] / 150)
    u = u + rng.normal(0, 0.01, u.shape)
    return np.broadcast_to(u, (n_time, n_depth, n_lat, n_lon)).copy()


def make_v_current(depth_levels, lat, lon):
    """4D v-current array."""
    LON, LAT = np.meshgrid(lon, lat)
    v = -0.22 * np.cos(np.pi * LON / 35) * np.sin(2 * np.pi * LAT / 25) * np.exp(-depth_levels[:, None, None] / 150)
    v = v + rng.normal(0, 0.01, v.shape)
    return np.broadcast_to(v, (n_time, n_depth, n_lat, n_lon)).copy()


def make_chlorophyll(depth_levels, lat, lon):
    """4D chlorophyll array — higher near coasts, decaying with depth."""
    LON, LAT = np.meshgrid(lon, lat)
    dist_to_edge_lon = np.minimum(LON - 60.0, 95.0 - LON)
    dist_to_edge_lat = np.minimum(LAT - 0.0, 25.0 - LAT)
    coast = np.exp(-np.minimum(dist_to_edge_lon, dist_to_edge_lat) / 4.0)
    chl = (0.15 + 1.6 * coast) * np.exp(-depth_levels[:, None, None] / 60) * (0.7 + 0.3 * np.sin(LON / 6) * np.cos(LAT / 9))
    chl = chl + rng.normal(0, 0.02, chl.shape)
    chl = np.clip(chl, 0.05, None)
    return np.broadcast_to(chl, (n_time, n_depth, n_lat, n_lon)).copy()


# --- build arrays ---
print("Generating temperature...")
temperature = make_temperature(depth_levels, lat, lon)
print("Generating salinity...")
salinity = make_salinity(depth_levels, lat, lon)
print("Generating u_current...")
u_current = make_u_current(depth_levels, lat, lon)
print("Generating v_current...")
v_current = make_v_current(depth_levels, lat, lon)
print("Generating chlorophyll...")
chlorophyll = make_chlorophyll(depth_levels, lat, lon)

# --- xarray Dataset ---
ds = xr.Dataset(
    {
        "temperature": xr.DataArray(
            temperature,
            dims=("time", "depth", "lat", "lon"),
            coords={"time": times, "depth": depth_levels, "lat": lat, "lon": lon},
            attrs={"units": "degC", "long_name": "Sea Water Temperature"},
        ),
        "salinity": xr.DataArray(
            salinity,
            dims=("time", "depth", "lat", "lon"),
            coords={"time": times, "depth": depth_levels, "lat": lat, "lon": lon},
            attrs={"units": "PSU", "long_name": "Sea Water Salinity"},
        ),
        "u_current": xr.DataArray(
            u_current,
            dims=("time", "depth", "lat", "lon"),
            coords={"time": times, "depth": depth_levels, "lat": lat, "lon": lon},
            attrs={"units": "m/s", "long_name": "Eastward Sea Water Velocity"},
        ),
        "v_current": xr.DataArray(
            v_current,
            dims=("time", "depth", "lat", "lon"),
            coords={"time": times, "depth": depth_levels, "lat": lat, "lon": lon},
            attrs={"units": "m/s", "long_name": "Northward Sea Water Velocity"},
        ),
        "chlorophyll": xr.DataArray(
            chlorophyll,
            dims=("time", "depth", "lat", "lon"),
            coords={"time": times, "depth": depth_levels, "lat": lat, "lon": lon},
            attrs={"units": "mg/m^3", "long_name": "Chlorophyll Concentration"},
        ),
    }
)

# --- save ---
nc_path = out_dir / "ocean_demo.nc"
try:
    ds.to_netcdf(nc_path, engine="netcdf4")
except Exception:
    ds.to_netcdf(nc_path, engine="h5netcdf")

# --- print stats ---
for var_name in ["temperature", "salinity", "u_current", "v_current", "chlorophyll"]:
    arr = ds[var_name].values
    print(f"  {var_name:12s}  shape={arr.shape}  min={np.nanmin(arr):.3f}  max={np.nanmax(arr):.3f}")

print(f"Data written to: {nc_path}")
print(f"File size: {nc_path.stat().st_size / 1024:.1f} KB")

# --- mock Argo floats ---
float_positions = []
n_floats = 20
float_lats = rng.uniform(1.0, 24.0, n_floats)
float_lons = rng.uniform(62.0, 93.0, n_floats)

# reference the dataset values for consistent profiles
T_ds = ds["temperature"].isel(time=0)
S_ds = ds["salinity"].isel(time=0)

floats_data = []
for i in range(n_floats):
    f_lat = float_lats[i]
    f_lon = float_lons[i]
    profile = []
    model_profile = []
    for d_idx, d_val in enumerate(depth_levels):
        t_val = float(T_ds.sel(lat=f_lat, lon=f_lon, depth=d_val, method="nearest").values)
        s_val = float(S_ds.sel(lat=f_lat, lon=f_lon, depth=d_val, method="nearest").values)
        # model profile is exact grid value
        model_profile.append({"depth": int(d_val), "temperature": round(t_val, 3), "salinity": round(s_val, 3)})
        # observed profile adds instrument noise
        t_obs = t_val + float(rng.normal(0, 0.25))
        s_obs = s_val + float(rng.normal(0, 0.04))
        profile.append({"depth": int(d_val), "temperature": round(t_obs, 3), "salinity": round(s_obs, 3)})

    floats_data.append({
        "id": f"ARGO-{i+1:03d}",
        "lat": round(float(f_lat), 4),
        "lon": round(float(f_lon), 4),
        "profile": profile,
    })

floats_path = out_dir / "floats.json"
with open(floats_path, "w") as f:
    json.dump(floats_data, f, indent=2)

print(f"Floats written: {floats_path}  ({len(floats_data)} floats)")
