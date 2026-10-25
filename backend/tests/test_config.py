"""Startup configuration: missing secrets fail fast, CORS and QR URLs come from settings."""

import os
import subprocess
import sys
from pathlib import Path

import pytest

from app.qr_codes import scan_url_for

BACKEND_DIR = Path(__file__).resolve().parents[1]

BASE_ENV = {
    "APP_ENV": "development",
    # A path that doesn't exist, so the real .env is never read.
    "ENV_FILE": str(BACKEND_DIR / "tests" / "no-such.env"),
    "DATABASE_URL": "sqlite:///:memory:",
    "JWT_SECRET_KEY": "test-only-jwt-secret",
}


def _import_app(**overrides):
    env = {k: v for k, v in os.environ.items() if k in ("PATH", "SYSTEMROOT", "TEMP", "TMP", "UPLOADS_DIR")}
    env.update(BASE_ENV)
    for key, value in overrides.items():
        if value is None:
            env.pop(key, None)
        else:
            env[key] = value
    return subprocess.run(
        [sys.executable, "-c", "import app.main"],
        cwd=BACKEND_DIR, env=env, capture_output=True, text=True,
    )


@pytest.mark.parametrize("missing", ["JWT_SECRET_KEY", "DATABASE_URL"])
def test_startup_fails_fast_without_required_setting(missing):
    result = _import_app(**{missing: None})
    assert result.returncode != 0
    assert f"{missing} is not set" in result.stderr


def test_startup_succeeds_with_required_settings():
    assert _import_app().returncode == 0


def test_wildcard_cors_origin_is_rejected():
    result = _import_app(CORS_ALLOWED_ORIGINS="*")
    assert result.returncode != 0
    assert "not '*'" in result.stderr


def test_production_has_no_localhost_defaults():
    result = _import_app(APP_ENV="production", CORS_ALLOWED_ORIGINS="https://hunt.example.com")
    assert result.returncode != 0
    assert "PUBLIC_BASE_URL is required" in result.stderr


def test_cors_allows_only_configured_origins(client):
    def preflight(origin):
        return client.options(
            "/api/hunts",
            headers={"Origin": origin, "Access-Control-Request-Method": "GET"},
        )

    allowed = preflight("http://localhost:3000")
    assert allowed.headers.get("access-control-allow-origin") == "http://localhost:3000"
    assert "access-control-allow-credentials" not in allowed.headers
    assert "access-control-allow-origin" not in preflight("https://evil.example").headers


def test_qr_codes_encode_public_base_url():
    assert scan_url_for("ABCD-EFGH-JKMN") == "http://hunt.test/scan?code=ABCD-EFGH-JKMN"
