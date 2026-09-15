"""Tests for backend/app/auth/security.py — JWT and password hashing."""
import time
import pytest
from app.auth.security import (
    create_token,
    decode_token,
    hash_password,
    verify_password,
    issue_oauth_state,
    verify_oauth_state,
)


class TestPasswordHashing:
    def test_hash_and_verify(self):
        hashed = hash_password("mypassword123")
        assert verify_password("mypassword123", hashed) is True

    def test_wrong_password(self):
        hashed = hash_password("mypassword123")
        assert verify_password("wrongpassword", hashed) is False

    def test_different_hashes(self):
        h1 = hash_password("same_password")
        h2 = hash_password("same_password")
        assert h1 != h2  # different salts
        assert verify_password("same_password", h1) is True
        assert verify_password("same_password", h2) is True


class TestJWT:
    def test_round_trip(self):
        user = {"id": "user123", "email": "test@example.com", "name": "Test"}
        token = create_token(user)
        payload = decode_token(token)
        assert payload["sub"] == "user123"
        assert payload["email"] == "test@example.com"

    def test_invalid_token(self):
        with pytest.raises(ValueError, match="Malformed"):
            decode_token("not.a.valid.token")

    def test_bad_signature(self):
        user = {"id": "user123", "email": "test@example.com", "name": "Test"}
        token = create_token(user)
        parts = token.split(".")
        # Tamper with signature
        tampered = parts[0] + "." + parts[1] + ".badsig"
        with pytest.raises(ValueError, match="Invalid"):
            decode_token(tampered)


class TestOAuthState:
    def test_issue_and_verify(self):
        state = issue_oauth_state("google")
        assert verify_oauth_state(state, "google") is True

    def test_wrong_provider(self):
        state = issue_oauth_state("google")
        assert verify_oauth_state(state, "github") is False

    def test_consume_once(self):
        state = issue_oauth_state("google")
        assert verify_oauth_state(state, "google") is True
        assert verify_oauth_state(state, "google") is False  # consumed

    def test_invalid_state(self):
        assert verify_oauth_state("nonexistent-state", "google") is False
