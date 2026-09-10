"""Auth configuration — read from environment variables.

OAuth client credentials are optional. When the client IDs are missing the
frontend disables the corresponding buttons and the backend returns a 501
from the OAuth start endpoints, so the app never crashes without them.
"""
import logging
import os

logger = logging.getLogger("brineview.auth")

DEV_JWT_SECRET = "brineview-dev-secret-change-in-production"

JWT_SECRET = os.environ.get("JWT_SECRET", DEV_JWT_SECRET)
JWT_ALGORITHM = "HS256"
JWT_ISSUER = "brineview"
JWT_TTL_SECONDS = 7 * 24 * 60 * 60  # 7 days — "remember me"

GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET", "")
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID", "")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET", "")

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
BACKEND_URL = os.environ.get("BACKEND_URL", "http://localhost:8000")

GOOGLE_OAUTH_AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_OAUTH_TOKEN = "https://oauth2.googleapis.com/token"
GOOGLE_USERINFO = "https://www.googleapis.com/oauth2/v3/userinfo"

GITHUB_OAUTH_AUTHORIZE = "https://github.com/login/oauth/authorize"
GITHUB_OAUTH_TOKEN = "https://github.com/login/oauth/access_token"
GITHUB_API = "https://api.github.com"

if JWT_SECRET == DEV_JWT_SECRET:
    logger.warning(
        "JWT_SECRET is not set in the environment — using the development default. "
        "Set JWT_SECRET to a strong secret in production."
    )