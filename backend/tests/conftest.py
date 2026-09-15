"""Shared test fixtures."""
import json
import sys
from pathlib import Path

import pytest

# Ensure backend/app is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.auth.storage import USERS_FILE
from app.main import app


@pytest.fixture(autouse=True)
def _clean_users_json():
    """Reset users.json before each test so auth tests don't collide."""
    if USERS_FILE.exists():
        backup = USERS_FILE.read_text()
        USERS_FILE.write_text("{}")
        yield
        USERS_FILE.write_text(backup)
    else:
        yield


@pytest.fixture
def client():
    """FastAPI test client."""
    from fastapi.testclient import TestClient
    return TestClient(app)
