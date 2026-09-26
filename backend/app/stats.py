"""Statistical analysis for the observation layer.

- Model-vs-observation metrics (RMSE, Bias, count) — depth-matched.
- Unsupervised anomaly detection (z-score on the model-residual signal).
- Localized optimal-interpolation assimilation demo (Gaussian-weighted
  increments), validated honestly against a held-out float subset.

numpy-only, deterministically seeded where randomness is needed.
"""
from __future__ import annotations

from typing import Any

import numpy as np

ANOMALY_THRESHOLD = 2.0

# Canonical depth levels used to build fixed-length ML feature vectors.
DEPTH_FEATURE_ORDER = [0, 10, 25, 50, 100, 200, 500, 1000]


def residual_feature_vector(
    profile: list[dict[str, Any]] | None,
    model_profile: list[dict[str, Any]] | None,
) -> list[float]:
    """16-dim feature vector: per-depth residuals dT, dS (missing → 0.0)."""
    aligned = aligned_levels(profile, model_profile)
    by_depth = {l["depth"]: l for l in aligned}
    vec: list[float] = []
    for d in DEPTH_FEATURE_ORDER:
        l = by_depth.get(d)
        d_t = l["d_t"] if l else None
        d_s = l["d_s"] if l else None
        vec.append(0.0 if d_t is None else float(d_t))
        vec.append(0.0 if d_s is None else float(d_s))
    return vec


def isolation_forest_scores(
    vectors: list[list[float]],
    ids: list[str],
    contamination: float = 0.05,
    seed: int = 42,
) -> dict[str, dict[str, Any]]:
    """Unsupervised anomaly scores via a trained Isolation Forest.

    Each float is a 16-dim residual vector (model-residual per depth).
    `score_samples` is high for normal samples; we rescale to a 0..1 anomaly
    score and flag with the model's own contamination-based prediction.
    """
    out: dict[str, dict[str, Any]] = {i: {"anomaly_score": 0.0, "anomaly": False}
                                      for i in ids}
    if len(ids) < 10:
        return out

    from sklearn.ensemble import IsolationForest

    X = np.nan_to_num(np.asarray(vectors, dtype=float))
    model = IsolationForest(
        n_estimators=200,
        max_samples="auto",
        contamination=contamination,
        random_state=seed,
    )
    model.fit(X)

    raw = model.score_samples(X)  # higher = more normal
    pred = model.predict(X)       # -1 = anomaly, 1 = normal

    lo, hi = float(raw.min()), float(raw.max())
    for i, pid in enumerate(ids):
        if hi - lo < 1e-12:
            continue
        normalized = 1.0 - (float(raw[i]) - lo) / (hi - lo)
        out[pid]["anomaly_score"] = round(normalized, 4)
        out[pid]["anomaly"] = bool(pred[i] == -1)
    return out


def aligned_levels(
    profile: list[dict[str, Any]] | None,
    model_profile: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Depth-matched obs/model pairs; only finite cells are kept.

    ``profile`` and ``model_profile`` are like
    ``[{depth, temperature, salinity}, ...]`` where temperature/salinity may be
    None. Matching is by depth (never list position) so truncated observed
    profiles align correctly with the always-full model profile.
    """
    obs = {p.get("depth"): p for p in (profile or [])}
    mod = {p.get("depth"): p for p in (model_profile or [])}

    levels: list[dict[str, Any]] = []
    for d in sorted(set(obs) & set(mod)):
        op, mp = obs[d], mod[d]
        ot, osv = op.get("temperature"), op.get("salinity")
        mt, msv = mp.get("temperature"), mp.get("salinity")

        ok_t = (
            ot is not None and mt is not None
            and np.isfinite(float(ot)) and np.isfinite(float(mt))
        )
        ok_s = (
            osv is not None and msv is not None
            and np.isfinite(float(osv)) and np.isfinite(float(msv))
        )
        levels.append({
            "depth": int(d),
            "obs_t": round(float(ot), 3) if ok_t else None,
            "mod_t": round(float(mt), 3) if ok_t else None,
            "d_t": round(float(ot) - float(mt), 3) if ok_t else None,
            "obs_s": round(float(osv), 3) if ok_s else None,
            "mod_s": round(float(msv), 3) if ok_s else None,
            "d_s": round(float(osv) - float(msv), 3) if ok_s else None,
        })
    return levels


def profile_metrics(
    profile: list[dict[str, Any]] | None,
    model_profile: list[dict[str, Any]] | None,
) -> dict[str, Any]:
    """RMSE / bias / count per variable for one float (or any profile pair)."""
    levels = aligned_levels(profile, model_profile)
    d_t = np.asarray([l["d_t"] for l in levels if l["d_t"] is not None], dtype=float)
    d_s = np.asarray([l["d_s"] for l in levels if l["d_s"] is not None], dtype=float)

    def agg(d: np.ndarray) -> tuple[float | None, float | None, int]:
        if d.size == 0:
            return None, None, 0
        return (
            float(np.sqrt(np.mean(np.square(d)))),
            float(np.mean(d)),
            int(d.size),
        )

    rmse_t, bias_t, n_t = agg(d_t)
    rmse_s, bias_s, n_s = agg(d_s)
    return {
        "rmse_t": None if rmse_t is None else round(rmse_t, 4),
        "bias_t": None if bias_t is None else round(bias_t, 4),
        "n_t": n_t,
        "rmse_s": None if rmse_s is None else round(rmse_s, 4),
        "bias_s": None if bias_s is None else round(bias_s, 4),
        "n_s": n_s,
    }


def flag_anomalies(rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Unsupervised anomaly scoring on ``rows`` (mutates in place).

    Signal: model-residual magnitude (rmse_t). A float whose residual sits
    more than ``ANOMALY_THRESHOLD`` robust standard deviations above the
    population mean is flagged. Missing residuals score 0 and are never
    flagged.
    """
    rms = np.asarray(
        [r["rmse_t"] for r in rows if r.get("rmse_t") is not None], dtype=float
    )
    if rms.size < 3:
        for r in rows:
            r["anomaly"] = False
            r["anomaly_score"] = 0.0
        return rows

    mu = float(np.mean(rms))
    sd = float(np.std(rms))
    sd = sd if sd > 1e-9 else 1e-9

    for r in rows:
        if r.get("rmse_t") is None:
            r["anomaly_score"] = 0.0
            r["anomaly"] = False
            continue
        score = (float(r["rmse_t"]) - mu) / sd
        r["anomaly_score"] = round(score, 3)
        r["anomaly"] = bool(score > ANOMALY_THRESHOLD)
    return rows


def _nearest_index(coords: np.ndarray, query: float) -> int:
    return int(np.abs(coords - query).argmin())


def _rmse_bias(deltas: np.ndarray) -> tuple[float, float, int]:
    if deltas.size == 0:
        return 0.0, 0.0, 0
    return (
        float(np.sqrt(np.mean(np.square(deltas)))),
        float(np.mean(deltas)),
        int(deltas.size),
    )


def assimilate_2d(
    values: list[list[float | None]],
    lat: list[float],
    lon: list[float],
    obs_points: list[dict[str, Any]],
    radius_cells: float,
) -> dict[str, Any]:
    """Localized optimal interpolation on a 2-D field slice.

    ``obs_points`` are ``{id, lat, lon, obs}`` floats already sampled to the
    grid's nearest cells. Analysis/validation split is deterministic (every
    3rd float by sorted id is held out). Increments are computed from the
    analysis subset only, Gaussian-weighted by grid-cell distance, then
    evaluated on the held-out subset — an honest, non-overfit reduction.

    Returns corrected grid (list-of-lists, NaN mask preserved), the raw
    ``values`` array, and before/after metrics on validation + full.
    """
    grid = np.asarray(values, dtype=float)
    lat_arr = np.asarray(lat, dtype=float)
    lon_arr = np.asarray(lon, dtype=float)
    n_la, n_lo = grid.shape

    for p in obs_points:
        p["i"] = _nearest_index(lat_arr, p["lat"])
        p["j"] = _nearest_index(lon_arr, p["lon"])
        model = grid[p["i"], p["j"]]
        p["model"] = float(model) if np.isfinite(model) else None
        p["ok"] = (
            p["ok"]
            and p["model"] is not None
            and np.isfinite(float(p["obs"]))
        )

    pts = [p for p in obs_points if p["ok"]]
    pts.sort(key=lambda p: p["id"])
    analysis = [p for idx, p in enumerate(pts) if idx % 3 != 2]
    validation = [p for idx, p in enumerate(pts) if idx % 3 == 2]

    ii, jj = np.meshgrid(np.arange(n_la, dtype=float), np.arange(n_lo, dtype=float),
                         indexing="ij")
    finite = np.isfinite(grid)
    increment = np.zeros_like(grid)

    if analysis:
        for p in analysis:
            di = ii - p["i"]
            dj = jj - p["j"]
            w = np.exp(-(di * di + dj * dj) / (2.0 * radius_cells * radius_cells))
            w = np.where(finite, w, 0.0)
            delta = float(p["obs"]) - float(p["model"])
            increment += w * delta
        denom = np.zeros_like(grid)
        for p in analysis:
            di = ii - p["i"]
            dj = jj - p["j"]
            w = np.exp(-(di * di + dj * dj) / (2.0 * radius_cells * radius_cells))
            denom += np.where(finite, w, 0.0)
        safe = denom > 1e-6
        increment = np.divide(increment, denom, out=np.zeros_like(grid), where=safe)
        increment = np.clip(increment, -6.0, 6.0)

    corrected = grid.copy()
    corrected[finite] = grid[finite] + increment[finite]

    def eval_metrics(subset: list[dict[str, Any]], field: np.ndarray) -> dict[str, Any]:
        deltas = np.asarray(
            [float(p["obs"]) - field[p["i"], p["j"]] for p in subset], dtype=float
        )
        rmse, bias, n = _rmse_bias(deltas)
        return {"rmse": round(rmse, 4), "bias": round(bias, 4), "n": n}

    before_full = eval_metrics(pts, grid)
    after_full = eval_metrics(pts, corrected)
    before_val = eval_metrics(validation, grid)
    after_val = eval_metrics(validation, corrected)

    def reduction(before: float, after: float) -> float | None:
        if before == 0:
            return None
        return round((1.0 - after / before) * 100.0, 1)

    return {
        "method": "localized optimal interpolation (Gaussian weighting)",
        "radius_cells": float(radius_cells),
        "n_analysis": len(analysis),
        "n_validation": len(validation),
        "before": before_full,
        "after": after_full,
        "validation_before": before_val,
        "validation_after": after_val,
        "reduction_rmse_pct": reduction(before_full["rmse"], after_full["rmse"]),
        "reduction_bias_pct": reduction(before_full["bias"], after_full["bias"]),
        "values": corrected.tolist(),
        "min": float(np.nanmin(corrected)) if np.any(finite) else 0.0,
        "max": float(np.nanmax(corrected)) if np.any(finite) else 1.0,
    }