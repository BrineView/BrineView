"""User storage — a small JSON-file-backed store.

Users are persisted to ``backend/data/users.json`` so sessions survive
server restarts (no database in this project). Reads and writes are
protected by a process-level lock and writes are atomic (temp file +
``os.replace``), which is sufficient for a single dev worker.
"""
import json
import os
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

USERS_FILE = (
    Path(__file__).resolve().parent.parent.parent / "data" / "users.json"
)

_lock = threading.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load() -> dict[str, dict]:
    if not USERS_FILE.exists():
        return {}
    try:
        with open(USERS_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except (json.JSONDecodeError, OSError):
        return {}


def _save(data: dict[str, dict]) -> None:
    USERS_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = USERS_FILE.with_suffix(".json.tmp")
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    os.replace(tmp, USERS_FILE)


def find_user_by_email(email: str) -> dict | None:
    """Look up a user by normalized (lowercased) email."""
    key = (email or "").strip().lower()
    with _lock:
        return _load().get(key)


def get_user_by_id(user_id: str) -> dict | None:
    """Look up a user by id."""
    with _lock:
        for user in _load().values():
            if user.get("id") == user_id:
                return user
    return None


def create_user(
    name: str,
    email: str,
    provider: str,
    password_hash: str | None = None,
) -> dict:
    """Create and persist a new user record.

    Args:
        name: display name.
        email: normalized to lowercase; used as the unique key.
        provider: "email", "google", or "github".
        password_hash: PBKDF2 hash; required for provider "email".

    Returns the stored user record.
    """
    key = email.strip().lower()
    user = {
        "id": uuid.uuid4().hex,
        "name": name.strip(),
        "email": key,
        "provider": provider,
        "password_hash": password_hash,
        "created_at": _now_iso(),
    }
    with _lock:
        data = _load()
        data[key] = user
        _save(data)
    return user