"""Synthetic data adapter — reads local NetCDF + floats.json."""
import json
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr

from .base import DataAdapter

# Resolve data directory relative to this file
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


def _sanitize(arr: Any) -> Any:
    """Replace NaN/Inf with None for safe JSON serialization."""
    if isinstance(arr, np.ndarray):
        return _sanitize(arr.tolist())
    if isinstance(arr, list):
        return [_sanitize(x) for x in arr]
    if isinstance(arr, float) and (np.isnan(arr) or np.isinf(arr)):
        return None
    if isinstance(arr, (np.floating, np.integer)):
        v = float(arr)
        if np.isnan(v) or np.isinf(v):
            return None
        return v
    return arr


class SyntheticAdapter(DataAdapter):
    """Reads from a locally generated NetCDF file + floats.json."""

    def __init__(self, nc_path: str | Path | None = None, floats_path: str | Path | None = None):
        nc = Path(nc_path) if nc_path else _DATA_DIR / "ocean_demo.nc"
        fp = Path(floats_path) if floats_path else _DATA_DIR / "floats.json"

        if not nc.exists():
            raise FileNotFoundError(f"NetCDF not found: {nc}")
        if not fp.exists():
            raise FileNotFoundError(f"Floats JSON not found: {fp}")

        try:
            self._ds = xr.open_dataset(str(nc), engine="netcdf4")
        except Exception:
            self._ds = xr.open_dataset(str(nc), engine="h5netcdf")

        with open(fp, "r") as f:
            self._floats: list[dict] = json.load(f)

        self._float_map: dict[str, dict] = {fl["id"]: fl for fl in self._floats}
        self._depths: list[float] = self._ds.depth.values.tolist()
        self._lats: np.ndarray = self._ds.lat.values
        self._lons: np.ndarray = self._ds.lon.values
        self._times: list[str] = [
            np.datetime_as_string(t, unit="s", timezone="UTC")
            for t in self._ds.time.values
        ]

    def get_variables(self) -> list[str]:
        return list(self._ds.data_vars)

    def get_meta(self) -> dict[str, Any]:
        return {
            "depths": self._depths,
            "times": self._times,
            "lat_range": [float(self._lats[0]), float(self._lats[-1])],
            "lon_range": [float(self._lons[0]), float(self._lons[-1])],
        }

    def get_field(self, variable: str, depth: float, time_index: int) -> dict[str, Any]:
        if variable not in self._ds.data_vars:
            raise KeyError(f"Unknown variable: {variable}")
        if time_index < 0 or time_index >= len(self._times):
            raise KeyError(f"time_index {time_index} out of range 0..{len(self._times)-1}")

        da = self._ds[variable].isel(time=time_index).sel(depth=depth, method="nearest")
        resolved_depth = float(da.depth.values)
        values = _sanitize(da.values)
        flat_vals = [v for row in values for v in row if v is not None]
        vmin = min(flat_vals) if flat_vals else 0.0
        vmax = max(flat_vals) if flat_vals else 1.0

        return {
            "variable": variable,
            "depth": resolved_depth,
            "time": self._times[time_index],
            "lat": _sanitize(self._lats.tolist()),
            "lon": _sanitize(self._lons.tolist()),
            "values": values,
            "min": vmin,
            "max": vmax,
        }

    def list_floats(self) -> list[dict[str, Any]]:
        return [{"id": fl["id"], "lat": fl["lat"], "lon": fl["lon"]} for fl in self._floats]

    def get_float(self, float_id: str) -> dict[str, Any]:
        if float_id not in self._float_map:
            raise KeyError(f"Float not found: {float_id}")

        fl = self._float_map[float_id]
        # Build model profile from the same dataset at the float's lat/lon
        model_profile = []
        for d in self._depths:
            t_val = float(self._ds["temperature"].isel(time=0).sel(
                lat=fl["lat"], lon=fl["lon"], depth=d, method="nearest"
            ).values)
            s_val = float(self._ds["salinity"].isel(time=0).sel(
                lat=fl["lat"], lon=fl["lon"], depth=d, method="nearest"
            ).values)
            model_profile.append({
                "depth": int(d),
                "temperature": round(_sanitize(t_val) or 0.0, 3),
                "salinity": round(_sanitize(s_val) or 0.0, 3),
            })

        return {
            "id": fl["id"],
            "lat": fl["lat"],
            "lon": fl["lon"],
            "profile": fl["profile"],
            "model_profile": model_profile,
        }
