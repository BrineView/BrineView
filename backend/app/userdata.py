"""In-memory store + parsing for user-uploaded ocean datasets (demo scope).

A minimal, dependency-light ingestion path so the frontend can add its own
NetCDF or CSV data and preview it on the 3D surface without touching the
committed bundle or the main `DataAdapter` contract.
"""
import csv
import io
import tempfile
from dataclasses import dataclass
from typing import Any

import numpy as np
import xarray as xr

from .utils import sanitize

MAX_UPLOAD_BYTES = 50 * 1024 * 1024

LAT_COLUMNS = ("latitude", "lat", "Latitude", "Lat")
LON_COLUMNS = ("longitude", "lon", "Longitude", "Lon")


@dataclass
class UserDataset:
    index: int
    name: str
    source: str
    ds: xr.Dataset
    variables: list[dict[str, Any]]
    meta: dict[str, Any]


_repo: dict[int, UserDataset] = {}
_next_index = 1


def _read_coord(ds: xr.Dataset, name: str) -> np.ndarray | None:
    lower = {c.lower(): c for c in ds.coords}
    key = lower.get(name) or lower.get(f"{name}itude")
    if key and ds.coords[key].ndim == 1:
        return np.asarray(ds.coords[key].values)
    return None


def _coordinate(ds: xr.Dataset, candidates: tuple[str, ...]) -> str | None:
    lower = {c.lower(): c for c in ds.coords}
    for cand in candidates:
        key = lower.get(cand.lower())
        if key and ds.coords[key].ndim == 1:
            return key
    return None


def _var_info(ds: xr.Dataset, name: str) -> dict[str, Any]:
    da = ds[name]
    dims = list(da.dims)
    has_spatial = {"lat", "lon"} <= {d.lower() for d in dims}
    return {
        "name": name,
        "long_name": da.attrs.get("long_name") or name,
        "standard_name": da.attrs.get("standard_name", ""),
        "units": da.attrs.get("units", ""),
        "ndim": da.ndim,
        "shape": list(da.shape),
        "dims": dims,
        "has_lat_lon": has_spatial,
    }


def _time_strings(values: np.ndarray) -> list[str]:
    try:
        return [
            np.datetime_as_string(t, unit="s", timezone="UTC") for t in values
        ]
    except (TypeError, ValueError):
        return [str(t) for t in values]


def _dataset_meta(ds: xr.Dataset) -> dict[str, Any]:
    lat = _read_coord(ds, "lat")
    lon = _read_coord(ds, "lon")
    depth = _read_coord(ds, "depth")
    time = _read_coord(ds, "time")

    depths = [float(v) for v in depth] if depth is not None else [0.0]
    times = _time_strings(time) if time is not None else ["now"]
    if not times:
        times = ["now"]

    lat_range = [0, 0]
    lon_range = [0, 0]
    if lat is not None and lat.size:
        lat_range = [float(lat.min()), float(lat.max())]
    if lon is not None and lon.size:
        lon_range = [float(lon.min()), float(lon.max())]

    return {
        "depths": depths,
        "times": times,
        "lat_range": lat_range,
        "lon_range": lon_range,
    }


# ---------------------------------------------------------------------------
# Loaders
# ---------------------------------------------------------------------------


def _open_netcdf(data: bytes) -> xr.Dataset:
    """Open an uploaded NetCDF, loading eagerly so it survives the temp file."""
    with tempfile.NamedTemporaryFile(suffix=".nc") as tmp:
        tmp.write(data)
        tmp.flush()
        try:
            ds = xr.open_dataset(tmp.name, engine="netcdf4").load()
        except Exception:
            ds = xr.open_dataset(tmp.name, engine="h5netcdf").load()
    return ds


def _open_csv(data: bytes) -> xr.Dataset:
    """Parse a lat/lon + columns CSV into a 2D grid dataset."""
    text = data.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    try:
        header = [h.strip() for h in next(reader)]
    except StopIteration:
        raise ValueError("CSV is empty")

    rows = list(reader)
    if not header:
        raise ValueError("CSV must include a header row")

    lat_idx = next((i for i, h in enumerate(header) if h.strip() in LAT_COLUMNS), None)
    lon_idx = next((i for i, h in enumerate(header) if h.strip() in LON_COLUMNS), None)
    if lat_idx is None or lon_idx is None:
        raise ValueError('CSV needs "latitude"/"lat" and "longitude"/"lon" columns')

    lat_vals, lon_vals = [], []
    by_col: dict[str, list[Any]] = {h: [] for h in header if h not in (header[lat_idx], header[lon_idx])}
    for r in rows:
        if len(r) < len(header):
            continue
        try:
            la, lo = float(r[lat_idx].strip()), float(r[lon_idx].strip())
        except (ValueError, IndexError):
            continue
        lat_vals.append(la)
        lon_vals.append(lo)
        for i, h in enumerate(header):
            if h in by_col:
                try:
                    by_col[h].append(float(r[i].strip()))
                except (ValueError, IndexError):
                    by_col[h].append(float("nan"))

    if not lat_vals:
        raise ValueError("CSV contains no valid lat/lon rows")

    lat_grid = np.unique(np.asarray(lat_vals, dtype=float))
    lon_grid = np.unique(np.asarray(lon_vals, dtype=float))
    lat_map = {float(v): i for i, v in enumerate(lat_grid)}
    lon_map = {float(v): j for j, v in enumerate(lon_grid)}

    data_vars: dict[str, xr.DataArray] = {}
    for h, col_vals in by_col.items():
        grid = np.full((lat_grid.size, lon_grid.size), np.nan)
        for la, lo, v in zip(lat_vals, lon_vals, col_vals):
            grid[lat_map[la], lon_map[lo]] = v
        data_vars[h] = xr.DataArray(
            grid,
            dims=("lat", "lon"),
            coords={"lat": lat_grid, "lon": lon_grid},
        )

    if not data_vars:
        raise ValueError("CSV must contain at least one numeric value column after lat/lon")

    return xr.Dataset(data_vars)


def _store(ds: xr.Dataset, name: str, source: str) -> UserDataset:
    global _next_index
    variables = [
        _var_info(ds, v) for v in ds.data_vars
        if {"lat", "lon"} <= {d.lower() for d in ds[v].dims}
    ] or [_var_info(ds, v) for v in ds.data_vars]

    meta = _dataset_meta(ds)
    idx = _next_index
    _next_index += 1
    entry = UserDataset(index=idx, name=name, source=source, ds=ds, variables=variables, meta=meta)
    _repo[idx] = entry
    return entry


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def store_upload(filename: str, data: bytes) -> dict[str, Any]:
    if len(data) > MAX_UPLOAD_BYTES:
        raise ValueError(f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB)")
    if not filename:
        raise ValueError("No file provided")

    lower = filename.lower()
    if lower.endswith((".nc", ".nc4", ".cdf", ".netcdf")):
        ds = _open_netcdf(data)
        source = "netcdf"
    elif lower.endswith(".csv"):
        ds = _open_csv(data)
        source = "csv"
    else:
        raise ValueError("Unsupported file type — upload NetCDF (.nc/.nc4) or CSV (.csv)")

    try:
        entry = _store(ds, filename, source)
    except Exception:
        ds.close() if hasattr(ds, "close") else None
        raise

    return {
        "index": entry.index,
        "name": entry.name,
        "source": entry.source,
        "variables": entry.variables,
        "meta": entry.meta,
    }


def list_datasets() -> list[dict[str, Any]]:
    return [
        {
            "index": e.index,
            "name": e.name,
            "source": e.source,
            "variables": e.variables,
            "meta": e.meta,
        }
        for e in sorted(_repo.values(), key=lambda e: e.index)
    ]


def get_dataset(index: int) -> UserDataset:
    entry = _repo.get(index)
    if entry is None:
        raise KeyError(f"User dataset {index} not found")
    return entry


def delete_dataset(index: int) -> None:
    entry = _repo.pop(index, None)
    if entry is None:
        raise KeyError(f"User dataset {index} not found")
    if hasattr(entry.ds, "close"):
        entry.ds.close()


def field_for(index: int, variable: str, depth: float, time_index: int) -> dict[str, Any]:
    """Slice a 2D (lat, lon) field off an uploaded dataset — FieldResponse shape."""
    entry = get_dataset(index)
    if variable not in entry.ds.data_vars:
        raise KeyError(f"Unknown variable: {variable}")

    da = entry.ds[variable]
    if "time" in {d.lower() for d in da.dims}:
        time_dim = next(d for d in da.dims if d.lower() == "time")
        n_time = da.sizes[time_dim]
        ti = max(0, min(time_index, n_time - 1)) if n_time else 0
        da = da.isel({time_dim: ti})
    if "depth" in {d.lower() for d in da.dims}:
        depth_dim = next(d for d in da.dims if d.lower() == "depth")
        try:
            da = da.sel({depth_dim: depth}, method="nearest")
        except Exception:
            da = da.isel({depth_dim: 0})

    # Reduce any leftover dims (z, level, ...) to their first slice.
    lat_d = next((d for d in da.dims if d.lower() == "lat"), None)
    lon_d = next((d for d in da.dims if d.lower() == "lon"), None)
    if lat_d is None or lon_d is None:
        raise KeyError(f"Variable {variable} has no lat/lon dimensions")

    for extra in [d for d in da.dims if d not in (lat_d, lon_d)]:
        da = da.isel({extra: 0})

    da = da.transpose(lat_d, lon_d)
    values = sanitize(da.values)
    flat = [v for row in values for v in row if v is not None]
    vmin = min(flat) if flat else 0.0
    vmax = max(flat) if flat else 1.0

    lat = sanitize(np.asarray(da[lat_d].values).tolist())
    lon = sanitize(np.asarray(da[lon_d].values).tolist())
    depth_meta = entry.meta.get("depths", [])
    resolved_depth = float(depth) if depth_meta else 0.0
    time_meta = entry.meta.get("times", [])
    resolved_time = time_meta[min(time_index, len(time_meta) - 1)] if time_meta else "now"

    return {
        "variable": variable,
        "depth": resolved_depth,
        "time": resolved_time,
        "lat": lat,
        "lon": lon,
        "values": values,
        "min": vmin,
        "max": vmax,
    }