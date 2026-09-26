"""Analysis endpoints — model-vs-obs metrics, AI anomaly detection,
localized-OI assimilation demo, and the glider layer."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from .. import stats
from ..adapters.base import DataAdapter
from ..deps import get_adapter

router = APIRouter(prefix="/api", tags=["analysis"])

ASSIMILABLE = {"temperature", "salinity"}


def _adapter() -> DataAdapter:
    return get_adapter()


@router.get("/floats/metrics")
def float_metrics(adapter: DataAdapter = Depends(_adapter)) -> list[dict[str, Any]]:
    """Per-float RMSE/Bias + AI anomaly flags (trained Isolation Forest)."""
    rows: list[dict[str, Any]] = []
    vectors: list[list[float]] = []
    for fl in adapter.list_floats():
        detail = adapter.get_float(fl["id"])
        metrics = stats.profile_metrics(detail.get("profile"), detail.get("model_profile"))
        rows.append({
            "id": fl["id"],
            "lat": fl["lat"],
            "lon": fl["lon"],
            **metrics,
        })
        vectors.append(
            stats.residual_feature_vector(detail.get("profile"), detail.get("model_profile"))
        )

    ids = [row["id"] for row in rows]
    score_map = stats.isolation_forest_scores(vectors, ids)
    for row in rows:
        s = score_map.get(row["id"], {})
        row["anomaly_score"] = s.get("anomaly_score", 0.0)
        row["anomaly"] = s.get("anomaly", False)
    return rows


@router.get("/floats/anomalies")
def float_anomalies(
    adapter: DataAdapter = Depends(_adapter),
) -> dict[str, Any]:
    """Only the floats flagged by the AI anomaly detector."""
    rows = float_metrics(adapter)
    flagged = [
        {k: r[k] for k in ("id", "lat", "lon", "anomaly_score", "rmse_t", "bias_t", "n_t")}
        for r in rows if r["anomaly"]
    ]
    return {
        "method": "trained Isolation Forest (unsupervised, deterministic)",
        "count": len(flagged),
        "anomalies": flagged,
    }


@router.get("/floats/{float_id}/metrics")
def float_metrics_by_id(
    float_id: str,
    adapter: DataAdapter = Depends(_adapter),
) -> dict[str, Any]:
    try:
        detail = adapter.get_float(float_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))
    metrics = stats.profile_metrics(detail.get("profile"), detail.get("model_profile"))
    metrics["id"] = float_id
    metrics["lat"] = detail["lat"]
    metrics["lon"] = detail["lon"]
    metrics["levels"] = stats.aligned_levels(detail.get("profile"), detail.get("model_profile"))
    return metrics


class AssimilateRequest(BaseModel):
    variable: str
    depth: float = Field(default=50.0, ge=0.0)
    time_index: int = Field(default=0, ge=0)
    radius_cells: float = Field(default=6.0, gt=0.0, le=30.0)


@router.post("/assimilate")
def assimilate(
    req: AssimilateRequest,
    adapter: DataAdapter = Depends(_adapter),
) -> dict[str, Any]:
    """Localized optimal-interpolation assimilation on a field slice.

    Observation increments (float profiles) are applied to the requested
    variable/depth/time with Gaussian distance weights. Metrics are reported on
    a held-out float subset so the RMSE/bias reduction is not overfit.
    """
    if req.variable not in ASSIMILABLE:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Assimilation is demonstrated for temperature/salinity "
                f"(got '{req.variable}'). Currents and chlorophyll have no float obs."
            ),
        )

    try:
        field = adapter.get_field(req.variable, req.depth, req.time_index)
    except KeyError as e:
        raise HTTPException(status_code=400, detail=str(e))

    resolved_depth = float(field["depth"])
    depth_levels = [float(d) for d in adapter.get_meta()["depths"]]
    canonical = min(depth_levels, key=lambda d: abs(d - resolved_depth))

    obs_points: list[dict[str, Any]] = []
    for fl in adapter.list_floats():
        detail = adapter.get_float(fl["id"])
        obs_by_depth = {p["depth"]: p for p in detail.get("profile", [])}
        p = obs_by_depth.get(int(canonical))
        if p is None:
            continue
        obs_val = p.get(req.variable)
        obs_points.append({
            "id": fl["id"],
            "lat": fl["lat"],
            "lon": fl["lon"],
            "obs": obs_val,
            "ok": obs_val is not None,
        })

    result = stats.assimilate_2d(
        field["values"],
        field["lat"],
        field["lon"],
        obs_points,
        req.radius_cells,
    )
    return {
        "variable": req.variable,
        "depth": resolved_depth,
        "time": field["time"],
        "method": result["method"],
        "radius_cells": result["radius_cells"],
        "obs_level": canonical,
        "n_analysis": result["n_analysis"],
        "n_validation": result["n_validation"],
        "before": result["before"],
        "after": result["after"],
        "validation_before": result["validation_before"],
        "validation_after": result["validation_after"],
        "reduction_rmse_pct": result["reduction_rmse_pct"],
        "reduction_bias_pct": result["reduction_bias_pct"],
        "lat": field["lat"],
        "lon": field["lon"],
        "values": result["values"],
        "min": result["min"],
        "max": result["max"],
    }


@router.get("/gliders")
def list_gliders(adapter: DataAdapter = Depends(_adapter)) -> list[dict[str, Any]]:
    return adapter.list_gliders()


@router.get("/gliders/{glider_id}")
def get_glider(
    glider_id: str,
    adapter: DataAdapter = Depends(_adapter),
) -> dict[str, Any]:
    try:
        return adapter.get_glider(glider_id)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e))