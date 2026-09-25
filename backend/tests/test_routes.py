"""Tests for backend/app/routes/ — API and auth endpoints."""
import pytest


class TestOceanAPI:
    def test_root(self, client):
        r = client.get("/")
        assert r.status_code == 200
        if "application/json" in r.headers.get("content-type", ""):
            data = r.json()
            assert data["service"] == "BrineView API"
            assert data["version"] == "0.2.0"
        else:
            assert "BrineView" in r.text

    def test_variables(self, client):
        r = client.get("/api/variables")
        assert r.status_code == 200
        assert isinstance(r.json(), list)
        assert "temperature" in r.json()

    def test_meta(self, client):
        r = client.get("/api/meta")
        assert r.status_code == 200
        data = r.json()
        assert "depths" in data
        assert "times" in data

    def test_field(self, client):
        r = client.get("/api/field?variable=temperature&depth=50&time_index=0")
        assert r.status_code == 200
        data = r.json()
        assert data["variable"] == "temperature"
        assert "values" in data

    def test_field_invalid_variable(self, client):
        r = client.get("/api/field?variable=nonexistent&depth=50&time_index=0")
        assert r.status_code == 400

    def test_bathymetry(self, client):
        r = client.get("/api/bathymetry")
        assert r.status_code == 200
        assert "values" in r.json()

    def test_floats(self, client):
        r = client.get("/api/floats")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_float_not_found(self, client):
        r = client.get("/api/floats/nonexistent-id")
        assert r.status_code == 404

    def test_health(self, client):
        r = client.get("/api/health")
        assert r.status_code == 200
        assert r.json() == {"status": "ok", "version": "0.2.0"}

    def test_diag(self, client):
        r = client.get("/api/diag")
        assert r.status_code == 200
        data = r.json()
        assert data["version"] == "0.2.0"
        assert data["adapter"]["ok"] is True
        assert all(data["data_files"].values())


class TestAuthAPI:
    def test_signup_and_login(self, client):
        # Signup
        r = client.post("/api/auth/signup", json={
            "name": "Test User",
            "email": "test@example.com",
            "password": "password123",
        })
        assert r.status_code == 200
        data = r.json()
        assert "token" in data
        assert data["user"]["email"] == "test@example.com"

        # Login
        r = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123",
        })
        assert r.status_code == 200
        assert "token" in r.json()

    def test_signup_duplicate_email(self, client):
        client.post("/api/auth/signup", json={
            "name": "User",
            "email": "dup@example.com",
            "password": "password123",
        })
        r = client.post("/api/auth/signup", json={
            "name": "User2",
            "email": "dup@example.com",
            "password": "password456",
        })
        assert r.status_code == 409

    def test_login_wrong_password(self, client):
        client.post("/api/auth/signup", json={
            "name": "User",
            "email": "wrong@example.com",
            "password": "password123",
        })
        r = client.post("/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword",
        })
        assert r.status_code == 401

    def test_me_authenticated(self, client):
        r = client.post("/api/auth/signup", json={
            "name": "Auth User",
            "email": "auth@example.com",
            "password": "password123",
        })
        token = r.json()["token"]
        r = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == "auth@example.com"

    def test_me_no_token(self, client):
        r = client.get("/api/auth/me")
        assert r.status_code == 401

    def test_status(self, client):
        r = client.get("/api/auth/status")
        assert r.status_code == 200
        assert "google" in r.json()
        assert "github" in r.json()
