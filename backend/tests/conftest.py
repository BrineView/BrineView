"""Shared test fixtures."""
import sys
from pathlib import Path

import pytest

# Ensure backend/app is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app


@pytest.fixture
def client():
    """FastAPI test client."""
    from fastapi.testclient import TestClient
    return TestClient(app)
