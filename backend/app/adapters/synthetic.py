"""Synthetic data adapter — reads local NetCDF + floats.json."""
import json
from pathlib import Path
from typing import Any

import numpy as np
import xarray as xr

from ..utils import sanitize
from .base import DataAdapter

_BATHY_FILE = "bathymetry.nc"

# Resolve data directory relative to this file
_DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"


class SyntheticAdapter(DataAdapter):
    """Reads from a locally generated NetCDF file + floats.json."""

    def __init__(
        self,
        nc_path: str | Path | None = None,
        floats_path: str | Path | None = None,
        bathy_path: str | Path | None = None,
    ):
        nc = Path(nc_path) if nc_path else _DATA_DIR / "ocean_demo.nc"
        fp = Path(floats_path) if floats_path else _DATA_DIR / "floats.json"
        bp = Path(bathy_path) if bathy_path else _DATA_DIR / _BATHY_FILE

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

        self._bathy: xr.Dataset | None = None
        if bp.exists():
            try:
                self._bathy = xr.open_dataset(str(bp), engine="netcdf4")
            except Exception:
                try:
                    self._bathy = xr.open_dataset(str(bp), engine="h5netcdf")
                except Exception:
                    self._bathy = None

        self._float_map: dict[str, dict] = {fl["id"]: fl for fl in self._floats}

        gliders_file = _DATA_DIR / "gliders.json"
        self._gliders: list[dict] = []
        if gliders_file.exists():
            with open(gliders_file, "r") as f:
                self._gliders = json.load(f)
        self._glider_map: dict[str, dict] = {g["id"]: g for g in self._gliders}

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
        values = sanitize(da.values)
        flat_vals = [v for row in values for v in row if v is not None]
        vmin = min(flat_vals) if flat_vals else 0.0
        vmax = max(flat_vals) if flat_vals else 1.0

        return {
            "variable": variable,
            "depth": resolved_depth,
            "time": self._times[time_index],
            "lat": sanitize(self._lats.tolist()),
            "lon": sanitize(self._lons.tolist()),
            "values": values,
            "min": vmin,
            "max": vmax,
        }

    def get_bathymetry(self) -> dict[str, Any]:
        """Sea-floor terrain on the same (lat, lon) grid as ``get_field``.

        The raw GMRT grid (0.025 deg) is nearest-neighbour-sampled onto the
        field grid so the frontend can displace its existing surface mesh
        vertex-for-vertex. Elevation is metres relative to sea level (negative
        below water). Cells with no data come back as ``None``.
        """
        if self._bathy is None:
            return {
                "units": "m",
                "lat": [],
                "lon": [],
                "values": [],
                "min": 0,
                "max": 1,
            }

        da = self._bathy["bathymetry"]
        bathy_on_field = da.sel(
            lat=self._lats, lon=self._lons, method="nearest"
        )
        values = sanitize(bathy_on_field.values)
        flat = [v for row in values for v in row if v is not None]
        zmin = min(flat) if flat else 0.0
        zmax = max(flat) if flat else 1.0
        return {
            "units": "m",
            "lat": sanitize(self._lats.tolist()),
            "lon": sanitize(self._lons.tolist()),
            "values": values,
            "min": zmin,
            "max": zmax,
        }

    def list_floats(self) -> list[dict[str, Any]]:
        return [
            {
                "id": fl["id"],
                "lat": fl["lat"],
                "lon": fl["lon"],
                "trajectory": fl.get("trajectory", []),
            }
            for fl in self._floats
        ]

    def get_float(self, float_id: str) -> dict[str, Any]:
        if float_id not in self._float_map:
            raise KeyError(f"Float not found: {float_id}")

        fl = self._float_map[float_id]
        # Build model profile from the same dataset at the float's lat/lon.
        # Seabed-masked cells come back as None (never a fabricated 0.0).
        model_profile = []
        for d in self._depths:
            t_val = float(self._ds["temperature"].isel(time=0).sel(
                lat=fl["lat"], lon=fl["lon"], depth=d, method="nearest"
            ).values)
            s_val = float(self._ds["salinity"].isel(time=0).sel(
                lat=fl["lat"], lon=fl["lon"], depth=d, method="nearest"
            ).values)
            t_sane = sanitize(t_val)
            s_sane = sanitize(s_val)
            model_profile.append({
                "depth": int(d),
                "temperature": None if t_sane is None else round(t_sane, 3),
                "salinity": None if s_sane is None else round(s_sane, 3),
            })

        return {
            "id": fl["id"],
            "lat": fl["lat"],
            "lon": fl["lon"],
            "trajectory": fl.get("trajectory", []),
            "profile": fl["profile"],
            "model_profile": model_profile,
        }

    def list_gliders(self) -> list[dict[str, Any]]:
        out = []
        for g in self._gliders:
            track = g.get("track", [])
            head = track[0] if track else {}
            out.append({
                "id": g["id"],
                "name": g.get("name", g["id"]),
                "max_depth": g.get("max_depth"),
                "lat": head.get("lat"),
                "lon": head.get("lon"),
                "track": track,
            })
        return out

    def get_glider(self, glider_id: str) -> dict[str, Any]:
        if glider_id not in self._glider_map:
            raise KeyError(f"Glider not found: {glider_id}")

        g = self._glider_map[glider_id]
        track = g.get("track", [])
        head = track[-1] if track else {}
        stations = []
        for st in g.get("stations", []):
            obs = st.get("profile", [])
            obs_by_depth = {p["depth"]: p for p in obs}
            model_profile = []
            for d in self._depths:
                t_val = float(self._ds["temperature"].isel(time=0).sel(
                    lat=st["lat"], lon=st["lon"], depth=d, method="nearest"
                ).values)
                s_val = float(self._ds["salinity"].isel(time=0).sel(
                    lat=st["lat"], lon=st["lon"], depth=d, method="nearest"
                ).values)
                t_sane = sanitize(t_val)
                s_sane = sanitize(s_val)
                model_profile.append({
                    "depth": int(d),
                    "temperature": None if t_sane is None else round(t_sane, 3),
                    "salinity": None if s_sane is None else round(s_sane, 3),
                })
            stations.append({
                "t": st.get("t"),
                "lat": st["lat"],
                "lon": st["lon"],
                "profile": obs,
                "model_profile": model_profile,
            })

        return {
            "id": g["id"],
            "name": g.get("name", g["id"]),
            "max_depth": g.get("max_depth"),
            "track": track,
            "lat": head.get("lat"),
            "lon": head.get("lon"),
            "stations": stations,
        }
