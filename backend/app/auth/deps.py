"""FastAPI dependencies for authentication."""
from fastapi import Header, HTTPException

from .security import decode_token
from .storage import get_user_by_id


def _bearer_token(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1].strip()


def get_current_user(
    authorization: str | None = Header(default=None),
) -> dict:
    """Require a valid JWT and return the matching user record."""
    try:
        payload = decode_token(_bearer_token(authorization))
    except ValueError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = get_user_by_id(payload["sub"])
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User no longer exists",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


def get_optional_user(
    authorization: str | None = Header(default=None),
) -> dict | None:
    """Return the user for a valid JWT, or None without raising."""
    if not authorization:
        return None
    try:
        payload = decode_token(_bearer_token(authorization))
    except ValueError:
        return None
    return get_user_by_id(payload["sub"])