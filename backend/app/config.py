"""
Central settings, read once from the environment at import time.

The app refuses to start (SystemExit with a readable message) when a
required setting is missing, instead of silently falling back to an
in-memory database or a hard-coded JWT secret.

APP_ENV controls which defaults are allowed:
  - development (default): localhost defaults for CORS and PUBLIC_BASE_URL,
    local-disk file storage when Supabase Storage isn't configured.
  - test: same as development, but never reads a .env file, so the test
    suite only ever sees the settings it sets explicitly.
  - production: no localhost defaults; CORS_ALLOWED_ORIGINS,
    PUBLIC_BASE_URL and Supabase Storage must all be set.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[2]

APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
if APP_ENV not in ("development", "test", "production"):
    sys.exit(f"[config] APP_ENV must be development, test or production (got '{APP_ENV}').")

# .env lives at the project root (one level above backend/); ENV_FILE
# points somewhere else. Variables already set in the environment win.
if APP_ENV != "test":
    load_dotenv(dotenv_path=os.getenv("ENV_FILE") or PROJECT_ROOT / ".env")

IS_PRODUCTION = APP_ENV == "production"

DEV_CORS_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
DEV_PUBLIC_BASE_URL = "http://localhost:3000"


def _require(name: str, hint: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        sys.exit(f"[config] {name} is not set. {hint} See .env.example.")
    return value


DATABASE_URL = _require(
    "DATABASE_URL",
    "Use a Postgres URL, or sqlite:///./dev.db for local development.",
)
JWT_SECRET_KEY = _require(
    "JWT_SECRET_KEY",
    'Generate one with: python -c "import secrets; print(secrets.token_urlsafe(48))"',
)

_cors_raw = os.getenv("CORS_ALLOWED_ORIGINS", "").strip()
if _cors_raw:
    CORS_ALLOWED_ORIGINS = [o.strip().rstrip("/") for o in _cors_raw.split(",") if o.strip()]
elif IS_PRODUCTION:
    sys.exit("[config] CORS_ALLOWED_ORIGINS is required when APP_ENV=production.")
else:
    CORS_ALLOWED_ORIGINS = DEV_CORS_ORIGINS
if "*" in CORS_ALLOWED_ORIGINS:
    sys.exit("[config] CORS_ALLOWED_ORIGINS must list explicit origins, not '*'.")

_base_raw = os.getenv("PUBLIC_BASE_URL", "").strip()
if _base_raw:
    PUBLIC_BASE_URL = _base_raw.rstrip("/")
elif IS_PRODUCTION:
    sys.exit("[config] PUBLIC_BASE_URL is required when APP_ENV=production (it's encoded in every QR code).")
else:
    PUBLIC_BASE_URL = DEV_PUBLIC_BASE_URL

SUPABASE_URL = os.getenv("SUPABASE_URL", "").strip().rstrip("/") or None
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip() or None
USE_SUPABASE_STORAGE = bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)
if IS_PRODUCTION and not USE_SUPABASE_STORAGE:
    sys.exit("[config] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when APP_ENV=production.")

# Local-disk storage (development/test only): files are written here and
# served by the backend at /uploads/<bucket>/<object>.
UPLOADS_DIR = Path(os.getenv("UPLOADS_DIR") or PROJECT_ROOT / "uploads").resolve()
