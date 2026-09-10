"""BrineView auth routes — email signup/login + Google & GitHub OAuth.

All OAuth flows use the server-side authorization-code pattern:
the frontend redirects to ``/api/auth/{provider}``, the browser visits the
provider's consent screen, and the provider redirects back to
``/api/auth/{provider}/callback`` which exchanges the code for a token,
creates-or-finds the user, issues a BrineView JWT, and 302-redirects to
``{FRONTEND_URL}/login?token=...`` so the SPA can pick the session up.
"""
import json
import re
import urllib.parse
import urllib.request
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from ..auth import config as cfg
from ..auth.security import (
    create_token,
    hash_password,
    issue_oauth_state,
    verify_oauth_state,
    verify_password,
)
from ..auth.storage import create_user, find_user_by_email
from ..auth.deps import get_current_user

router = APIRouter(prefix="/api/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _public_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "provider": user["provider"],
    }


def _issue_response(user: dict) -> dict:
    return {"token": create_token(user), "user": _public_user(user)}


def _error_redirect(error: str) -> RedirectResponse:
    url = f"{cfg.FRONTEND_URL}/login?error={urllib.parse.quote(error)}"
    return RedirectResponse(url, status_code=302)


def _token_redirect(user: dict) -> RedirectResponse:
    token = create_token(user)
    url = f"{cfg.FRONTEND_URL}/login?token={token}"
    return RedirectResponse(url, status_code=302)


# --- OAuth HTTP helpers (stdlib urllib only) ---


def _post_form(url: str, data: dict[str, str], headers: dict[str, str] | None = None) -> str:
    body = urllib.parse.urlencode(data).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={
            "Content-Type": "application/x-www-form-urlencoded",
            **(headers or {}),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as res:
        return res.read().decode("utf-8")


def _get_json(url: str, headers: dict[str, str]) -> dict[str, Any]:
    request = urllib.request.Request(url, headers=headers, method="GET")
    with urllib.request.urlopen(request, timeout=15) as res:
        return json.loads(res.read().decode("utf-8"))


def _find_or_create_social_user(email: str, name: str, provider: str) -> tuple[dict, None] | tuple[None, str]:
    """Return (user, None) on success or (None, error_code) on conflict."""
    existing = find_user_by_email(email)
    if existing is not None:
        if existing["provider"] == provider:
            return existing, None
        return None, f"account_exists_with_{existing['provider']}"
    created = create_user(name=name or email.split("@")[0], email=email, provider=provider)
    return created, None


# --- Email signup / login (Pydantic models) ---


class SignupRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


@router.post("/signup")
def signup(body: SignupRequest) -> dict:
    name = body.name.strip()
    email = body.email.strip().lower()
    if not name:
        raise HTTPException(status_code=422, detail="Name is required")
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=422, detail="Enter a valid email address")

    existing = find_user_by_email(email)
    if existing is not None:
        if existing["provider"] == "email":
            raise HTTPException(status_code=409, detail="Email already registered")
        raise HTTPException(
            status_code=409,
            detail=f"This email is linked to a {existing['provider']} account. "
            f"Please sign in with {existing['provider'].capitalize()}.",
        )

    user = create_user(
        name=name,
        email=email,
        provider="email",
        password_hash=hash_password(body.password),
    )
    return _issue_response(user)


@router.post("/login")
def login(body: LoginRequest) -> dict:
    email = body.email.strip().lower()
    if not _EMAIL_RE.match(email):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    user = find_user_by_email(email)
    if user is None or user["provider"] != "email":
        raise HTTPException(status_code=401, detail="Invalid email or password")
    if not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return _issue_response(user)


@router.get("/me")
def me(current_user: dict = Depends(get_current_user)) -> dict:
    return {"user": _public_user(current_user)}


@router.get("/status")
def status() -> dict:
    return {
        "google": bool(cfg.GOOGLE_CLIENT_ID),
        "github": bool(cfg.GITHUB_CLIENT_ID),
    }


# --- Google OAuth ---


@router.get("/google")
def google_start() -> RedirectResponse:
    if not cfg.GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=501, detail="Google sign-in not configured")
    params = {
        "client_id": cfg.GOOGLE_CLIENT_ID,
        "redirect_uri": f"{cfg.BACKEND_URL}/api/auth/google/callback",
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "state": issue_oauth_state("google"),
    }
    return RedirectResponse(f"{cfg.GOOGLE_OAUTH_AUTHORIZE}?{urllib.parse.urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str, state: str) -> RedirectResponse:
    if not verify_oauth_state(state, "google"):
        return _error_redirect("oauth_state_mismatch")
    if not cfg.GOOGLE_CLIENT_SECRET:
        return _error_redirect("oauth_not_configured")

    try:
        token_response = json.loads(
            _post_form(
                cfg.GOOGLE_OAUTH_TOKEN,
                {
                    "code": code,
                    "client_id": cfg.GOOGLE_CLIENT_ID,
                    "client_secret": cfg.GOOGLE_CLIENT_SECRET,
                    "redirect_uri": f"{cfg.BACKEND_URL}/api/auth/google/callback",
                    "grant_type": "authorization_code",
                },
            )
        )
        access_token = token_response.get("access_token")
        if not access_token:
            return _error_redirect("oauth_failed")
        profile = _get_json(
            cfg.GOOGLE_USERINFO,
            {"Authorization": f"Bearer {access_token}"},
        )
    except Exception:
        return _error_redirect("oauth_failed")

    email = (profile.get("email") or "").strip().lower()
    if not email or profile.get("email_verified") is not True:
        return _error_redirect("oauth_missing_email")

    user, error = _find_or_create_social_user(email, profile.get("name") or "", "google")
    if error:
        return _error_redirect(error)
    return _token_redirect(user)


# --- GitHub OAuth ---


@router.get("/github")
def github_start() -> RedirectResponse:
    if not cfg.GITHUB_CLIENT_ID:
        raise HTTPException(status_code=501, detail="GitHub sign-in not configured")
    params = {
        "client_id": cfg.GITHUB_CLIENT_ID,
        "redirect_uri": f"{cfg.BACKEND_URL}/api/auth/github/callback",
        "scope": "user:email",
        "state": issue_oauth_state("github"),
    }
    return RedirectResponse(f"{cfg.GITHUB_OAUTH_AUTHORIZE}?{urllib.parse.urlencode(params)}")


@router.get("/github/callback")
def github_callback(code: str, state: str) -> RedirectResponse:
    if not verify_oauth_state(state, "github"):
        return _error_redirect("oauth_state_mismatch")
    if not cfg.GITHUB_CLIENT_SECRET:
        return _error_redirect("oauth_not_configured")

    try:
        token_response = _post_form(
            cfg.GITHUB_OAUTH_TOKEN,
            {
                "client_id": cfg.GITHUB_CLIENT_ID,
                "client_secret": cfg.GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = json.loads(token_response)
        access_token = token_data.get("access_token")
        if not access_token:
            return _error_redirect("oauth_failed")

        auth_header = {"Authorization": f"Bearer {access_token}"}
        profile = _get_json(f"{cfg.GITHUB_API}/user", auth_header)
        emails = _get_json(f"{cfg.GITHUB_API}/user/emails", auth_header)
    except Exception:
        return _error_redirect("oauth_failed")

    email = ""
    for item in emails:
        if item.get("primary") and item.get("verified"):
            email = (item.get("email") or "").strip().lower()
            break
    if not email and profile.get("email"):
        email = (profile.get("email") or "").strip().lower()
    if not email:
        email = f"{profile.get('login', 'user').lower()}@users.noreply.github.com"

    name = profile.get("name") or profile.get("login") or ""
    user, error = _find_or_create_social_user(email, name, "github")
    if error:
        return _error_redirect(error)
    return _token_redirect(user)
