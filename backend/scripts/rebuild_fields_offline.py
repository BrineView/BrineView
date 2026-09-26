"""Regenerate the analytic 4D ocean fields with a correctly aligned sea-floor mask.

The bundled generation script had a reversed mask sign — deep water was masked
instead of shallow water + land. This rebuilds ``ocean_demo.nc`` fully offline
from the correct, committed ``bathymetry.nc`` using the same analytic builders,
so the demo dataset is self-consistent.

Usage:
    python scripts/rebuild_fields_offline.py
"""
from pathlib import Path

import numpy as np
import xarray as xr

from build_real_dataset import (  # noqa: F401  (reuses analytic builders + CF attrs)
    BATHY_RES,
    CF_VAR_ATTRS,
    DEPTH_LEVELS,
    FIELD_RES,
    LAT0,
    LAT1,
    LON0,
    LON1,
    N_TIME,
    REGION_NAME,
    T_STEP,
    build_fields,
)

DATA = Path(__file__).resolve().parent.parent / "data"
OUT_DIR = DATA


def _seafloor_from_committed() -> np.ndarray:
    b = None
    for engine in ("netcdf4", "h5netcdf"):
        try:
            b = xr.open_dataset(str(DATA / "bathymetry.nc"), engine=engine)
            break
        except Exception:
            continue
    if b is None:
        raise FileNotFoundError("bathymetry.nc not readable")

    sf = b.get("bathymetry", b).values
    n_raw_lat = int(round((LAT1 - LAT0) / BATHY_RES)) + 1
    n_raw_lon = int(round((LON1 - LON0) / BATHY_RES)) + 1

    if sf.shape[0] != n_raw_lat or sf.shape[1] != n_raw_lon:
        raise ValueError(
            f"bathymetry shape {sf.shape} unexpected "
            f"(expected ({n_raw_lat},{n_raw_lon}) = lat-major at {BATHY_RES} deg)"
        )
    return sf


def main() -> None:
    print(f"Offline field rebuild — {REGION_NAME}")
    seafloor = _seafloor_from_committed()
    print(f"seafloor loaded: {seafloor.shape}, deep={np.nanmin(seafloor):.0f}m "
          f"high={np.nanmax(seafloor):.0f}m")
    ds = build_fields(seafloor)
    ds.close()
    print(f"\nDone: {OUT_DIR / 'ocean_demo.nc'}")


if __name__ == "__main__":
    main()