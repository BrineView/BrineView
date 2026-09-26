"""Unit tests for app.stats — metrics, anomaly detection, assimilation core."""
import numpy as np
import pytest

from app import stats


def _profile(levels, temp_off=0.0, sal_off=0.0):
    return [
        {"depth": d, "temperature": (20.0 + d * 0.01) + temp_off,
         "salinity": (34.0 + d * 0.001) + sal_off}
        for d in levels
    ]


def test_profile_metrics_perfect_model():
    prof = _profile([0, 10, 25])
    m = stats.profile_metrics(prof, _profile([0, 10, 25]))
    assert m["rmse_t"] == pytest.approx(0.0, abs=1e-6)
    assert m["bias_t"] == pytest.approx(0.0, abs=1e-6)
    assert m["n_t"] == 3
    assert m["n_s"] == 3


def test_profile_metrics_known_offset():
    prof = _profile([0, 10, 25, 50], temp_off=1.0, sal_off=0.5)
    m = stats.profile_metrics(prof, _profile([0, 10, 25, 50]))
    assert m["rmse_t"] == pytest.approx(1.0, abs=1e-6)
    assert m["bias_t"] == pytest.approx(1.0, abs=1e-6)
    assert m["rmse_s"] == pytest.approx(0.5, abs=1e-6)


def test_depth_mismatch_ignored():
    # model has more levels than obs; matching must be by depth, not index
    obs = _profile([0, 50])
    mod = _profile([0, 10, 25, 50, 100])
    m = stats.profile_metrics(obs, mod)
    assert m["n_t"] == 2  # only depths present in both


def test_nan_cells_excluded():
    obs = [
        {"depth": 0, "temperature": 20.0, "salinity": 34.0},
        {"depth": 10, "temperature": None, "salinity": 34.1},
    ]
    mod = [
        {"depth": 0, "temperature": 20.2, "salinity": 34.0},
        {"depth": 10, "temperature": 20.1, "salinity": 34.1},
    ]
    m = stats.profile_metrics(obs, mod)
    assert m["n_t"] == 1
    assert m["rmse_t"] == pytest.approx(0.2, abs=1e-6)


def test_anomaly_flags_isolates_outlier():
    rows = [
        {"id": str(i), "rmse_t": 0.25, "bias_t": 0.0, "n_t": 5} for i in range(20)
    ]
    rows[3]["rmse_t"] = 1.4
    flagged = [r["id"] for r in stats.flag_anomalies(rows) if r["anomaly"]]
    assert "3" in flagged
    assert all(id_ != "3" or id_ in flagged for id_ in ["1", "2", "4"])


def test_assimilate_reduces_validation_rmse():
    n = 21
    lat = [-4.0 + 0.1 * i for i in range(n)]
    lon = [92.0 + 0.1 * j for j in range(n)]
    rng = np.random.default_rng(3)
    # smooth truth field
    base = np.zeros((n, n), dtype=float)
    for i in range(n):
        for j in range(n):
            base[i, j] = 20.0 + 0.05 * i + 0.03 * j
    # observations at random spots: value + noise
    pts = []
    for k in range(18):
        i = int(rng.integers(0, n))
        j = int(rng.integers(0, n))
        pts.append({
            "id": f"F{k:02d}", "lat": lat[i], "lon": lon[j],
            "obs": float(base[i, j] + rng.normal(0, 0.2)), "ok": True,
        })

    values = base.tolist()
    out = stats.assimilate_2d(values, lat, lon, pts, radius_cells=2.0)
    grid = np.asarray(out["values"], dtype=float)

    pre = np.asarray([p["obs"] - base[p["i"], p["j"]] for p in pts])
    post = np.asarray([p["obs"] - grid[p["i"], p["j"]] for p in pts])
    pre_rmse = float(np.sqrt(np.mean(pre ** 2)))
    post_rmse = float(np.sqrt(np.mean(post ** 2)))
    assert post_rmse < pre_rmse
    assert post_rmse > 0.0


def test_assimilate_keeps_land_mask():
    values = [[np.nan, 5.0, 5.0], [np.nan, 5.0, np.nan]]
    lat = [0.0, 1.0]
    lon = [0.0, 1.0, 2.0]
    pts = [{"id": "A", "lat": 0.7, "lon": 1.4, "obs": 6.0, "ok": True}]
    out = stats.assimilate_2d(values, lat, lon, pts, radius_cells=1.0)
    g = np.asarray(out["values"], dtype=float)
    assert np.isnan(g[0, 0]) and np.isnan(g[1, 0]) and np.isnan(g[1, 2])
    assert np.isfinite(g[0, 1]) and np.isfinite(g[1, 1])
    assert "values" in out and "method" in out