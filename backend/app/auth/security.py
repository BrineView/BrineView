"""Security helpers — JWT (HS256) and PBKDF2 password hashing.

Implemented with the Python standard library only: `hmac`, `hashlib`,
`base64`, `json`, `time`, and `secrets`. No third-party dependencies required.
"""
import base64
import hashlib
import hmac
import json
import secrets
import threading
import time

from .config import JWT_ALGORITHM, JWT_ISSUER, JWT_SECRET, JWT_TTL_SECONDS

_PBKDF2_ITERATIONS = 200_000
_OAUTH_STATE_TTL_SECONDS = 10 * 60

# In-memory OAuth CSRF state store: state -> (provider, created_at).
# Single-process dev server only; fine for this project.
_oauth_states: dict[str, tuple[str, float]] = {}
_oauth_lock = threading.Lock()


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(part: str) -> str:
    padding = "=" * (-len(part) % 4)
    return base64.urlsafe_b64decode(part + padding).decode("utf-8")


def hash_password(password: str) -> str:
    """Hash a password with PBKDF2-SHA256 and a random salt.

    Returns a string of the form ``salt_hex:key_hex``.
    """
    salt = secrets.token_bytes(16)
    key = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return f"{salt.hex()}:{key.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Verify a password against a stored ``salt_hex:key_hex`` hash."""
    try:
        salt_hex, key_hex = stored.split(":", 1)
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(key_hex)
    except (ValueError, AttributeError):
        return False
    actual = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS
    )
    return hmac.compare_digest(actual, expected)


def _sign(header_b64: str, payload_b64: str) -> str:
    message = f"{header_b64}.{payload_b64}".encode("ascii")
    digest = hmac.new(
        JWT_SECRET.encode("utf-8"), message, hashlib.sha256
    ).digest()
    return _b64url_encode(digest)


def create_token(user: dict) -> str:
    """Create a signed HS256 JWT for the given user record.

    The token carries ``sub`` (user id), ``email``, ``name``, ``iat``,
    ``exp`` and ``iss`` claims and doubles as the "remember me" session
    (7-day expiry).
    """
    now = int(time.time())
    header = {"alg": JWT_ALGORITHM, "typ": "JWT"}
    payload = {
        "sub": user["id"],
        "email": user["email"],
        "name": user["name"],
        "iat": now,
        "exp": now + JWT_TTL_SECONDS,
        "iss": JWT_ISSUER,
    }
    header_b64 = _b64url_encode(
        json.dumps(header, separators=(",", ":")).encode("utf-8")
    )
    payload_b64 = _b64url_encode(
        json.dumps(payload, separators=(",", ":")).encode("utf-8")
    )
    return f"{header_b64}.{payload_b64}.{_sign(header_b64, payload_b64)}"


def decode_token(token: str) -> dict:
    """Verify a JWT and return its payload, or raise ValueError.

    Raises ``ValueError`` for a malformed token, a bad signature, a
    non-brineview issuer, or an expired token.
    """
    try:
        header_b64, payload_b64, signature = token.split(".")
    except ValueError:
        raise ValueError("Malformed token")

    expected = _sign(header_b64, payload_b64)
    if not hmac.compare_digest(signature, expected):
        raise ValueError("Invalid token signature")

    header = json.loads(_b64url_decode(header_b64))
    payload = json.loads(_b64url_decode(payload_b64))

    if header.get("alg") != JWT_ALGORITHM:
        raise ValueError("Unexpected token algorithm")
    if payload.get("iss") != JWT_ISSUER:
        raise ValueError("Unexpected token issuer")
    if int(payload.get("exp", 0)) < int(time.time()):
        raise ValueError("Token expired")

    return payload


# --- OAuth CSRF state ---


def issue_oauth_state(provider: str) -> str:
    """Create a short-lived state value bound to an OAuth provider."""
    state = secrets.token_urlsafe(32)
    with _oauth_lock:
        _prune_oauth_states()
        _oauth_states[state] = (provider, time.time())
    return state


def verify_oauth_state(state: str, provider: str) -> bool:
    """Consume and validate a state value for the given provider."""
    with _oauth_lock:
        entry = _oauth_states.pop(state, None)
    if entry is None:
        return False
    stored_provider, created_at = entry
    return (
        stored_provider == provider
        and (time.time() - created_at) < _OAUTH_STATE_TTL_SECONDS
    )


def _prune_oauth_states() -> None:
    now = time.time()
    expired = [
        s for s, (_, created) in _oauth_states.items()
        if (now - created) >= _OAUTH_STATE_TTL_SECONDS
    ]
    for s in expired:
        del _oauth_states[s]