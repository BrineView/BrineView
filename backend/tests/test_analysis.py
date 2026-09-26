"""Endpoint tests for the analysis router (metrics, anomalies, assimilate, gliders)."""

from app import stats


def test_float_metrics_shape(client):
    r = client.get("/api/floats/metrics")
    assert r.status_code == 200
    rows = r.json()
    assert isinstance(rows, list) and len(rows) > 0
    for row in rows:
        assert row["id"].startswith("ARGO-")
        assert row["rmse_t"] is not None
        assert row["bias_t"] is not None
        assert row["n_t"] >= 1
        assert "anomaly" in row and "anomaly_score" in row
        assert 0.0 <= row["anomaly_score"] <= 1.0


def test_planted_anomaly_is_detected(client):
    r = client.get("/api/floats/metrics")
    rows = r.json()
    flagged = {row["id"] for row in rows if row["anomaly"]}
    assert len(flagged) >= 1
    # the planted offset profile (index 7) must be found by the detector
    ids = [row["id"] for row in rows]
    planted = ids[7]
    assert planted in flagged
    planted_row = next(row for row in rows if row["id"] == planted)
    assert planted_row["anomaly_score"] > 0.5
    assert planted_row["rmse_t"] > 1.0  # ~2.2 offset driven


def test_anomalies_endpoint(client):
    r = client.get("/api/floats/anomalies")
    assert r.status_code == 200
    data = r.json()
    assert "Isolation Forest" in data["method"]
    assert data["count"] == len(data["anomalies"])
    assert data["count"] >= 1
    for a in data["anomalies"]:
        assert 0.0 <= a["anomaly_score"] <= 1.0


def test_float_metrics_by_id(client):
    r = client.get("/api/floats/metrics")
    fid = r.json()[0]["id"]
    r2 = client.get(f"/api/floats/{fid}/metrics")
    assert r2.status_code == 200
    data = r2.json()
    assert data["id"] == fid
    assert len(data["levels"]) == data["n_t"]
    assert data["levels"][0]["depth"] is not None


def test_float_metrics_unknown_404(client):
    r = client.get("/api/floats/ARGO-9999999/metrics")
    assert r.status_code == 404


def test_assimilate_temperature(client):
    r = client.post(
        "/api/assimilate",
        json={"variable": "temperature", "depth": 50, "time_index": 0, "radius_cells": 6.0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["method"].startswith("localized")
    assert data["before"]["n"] > 0 and data["validation_before"]["n"] > 0
    assert data["after"]["rmse"] <= data["before"]["rmse"] + 1e-9
    assert len(data["values"]) == len(data["lat"])
    assert all(len(row) == len(data["lon"]) for row in data["values"])


def test_assimilate_validates_split(client):
    r = client.post(
        "/api/assimilate",
        json={"variable": "salinity", "depth": 25, "time_index": 1, "radius_cells": 4.0},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["n_analysis"] > data["n_validation"] > 0
    assert abs(data["n_analysis"] % 3) in (0, 1)
    assert data["reduction_rmse_pct"] is not None


def test_assimilate_rejects_currents(client):
    r = client.post(
        "/api/assimilate",
        json={"variable": "u_current", "depth": 50, "time_index": 0},
    )
    assert r.status_code == 400
    assert "temperature/salinity" in r.json()["detail"]


def test_list_gliders(client):
    r = client.get("/api/gliders")
    assert r.status_code == 200
    gliders = r.json()
    assert isinstance(gliders, list) and len(gliders) >= 6
    for g in gliders:
        assert g["id"].startswith("GLIDER-")
        assert len(g["track"]) >= 4


def test_glider_detail(client):
    r = client.get("/api/gliders")
    gid = r.json()[0]["id"]
    r2 = client.get(f"/api/gliders/{gid}")
    assert r2.status_code == 200
    data = r2.json()
    assert data["id"] == gid
    assert len(data["stations"]) >= 1
    st = data["stations"][0]
    assert len(st["profile"]) >= 1
    # observed levels ⊆ model levels (model has every canonical depth)
    assert len(st["model_profile"]) >= len(st["profile"])


def test_glider_404(client):
    r = client.get("/api/gliders/GLIDER-99")
    assert r.status_code == 404