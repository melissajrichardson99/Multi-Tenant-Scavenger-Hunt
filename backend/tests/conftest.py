"""
Test setup. Every setting is explicit and set *before* the app is imported:
APP_ENV=test means the app never reads a .env file, storage goes to a temp
directory, and the database is a fresh temporary SQLite file unless
TEST_DATABASE_URL points at a throwaway Postgres instead.
"""

import os
import tempfile
import uuid
from pathlib import Path

_TMP_DIR = Path(tempfile.mkdtemp(prefix="scavenger-hunt-tests-"))

for _name in ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CORS_ALLOWED_ORIGINS", "ENV_FILE"):
    os.environ.pop(_name, None)
os.environ.update({
    "APP_ENV": "test",
    "DATABASE_URL": os.getenv("TEST_DATABASE_URL") or f"sqlite:///{(_TMP_DIR / 'test.db').as_posix()}",
    "JWT_SECRET_KEY": "test-only-jwt-secret-not-used-anywhere-else",
    "PUBLIC_BASE_URL": "http://hunt.test",
    "UPLOADS_DIR": str(_TMP_DIR / "uploads"),
})

import pytest
from fastapi.testclient import TestClient

from app.auth import create_access_token, hash_password
from app.database import Base, SessionLocal, engine
from app.main import app
from app.models import AdminUser, Character, Hunt, Organization
from app.qr_codes import generate_short_code

Base.metadata.create_all(engine)


def _delete_all_rows():
    with engine.begin() as conn:
        for table in reversed(Base.metadata.sorted_tables):
            conn.execute(table.delete())


@pytest.fixture(autouse=True)
def _clean_tables():
    _delete_all_rows()
    yield
    _delete_all_rows()


@pytest.fixture
def db():
    session = SessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client():
    with TestClient(app) as test_client:
        yield test_client


def make_org(db, slug, theme_mode="dark"):
    org = Organization(name=f"Org {slug}", slug=slug, theme_primary="#123456", theme_secondary="#abcdef", theme_mode=theme_mode)
    db.add(org)
    db.commit()
    return org


def make_hunt(db, org, is_active=True):
    hunt = Hunt(organization_id=org.id, name=f"{org.slug} hunt", is_active=is_active)
    db.add(hunt)
    db.commit()
    return hunt


def make_character(db, hunt, name, **fields):
    character = Character(hunt_id=hunt.id, name=name, qr_code_value=generate_short_code(), **fields)
    db.add(character)
    db.commit()
    return character


def make_admin(db, org=None):
    admin = AdminUser(
        email=f"admin-{uuid.uuid4().hex[:8]}@example.com",
        password_hash=hash_password("correct-horse-battery"),
        organization_id=org.id if org else None,
    )
    db.add(admin)
    db.commit()
    return admin


def auth_header(admin):
    return {"Authorization": f"Bearer {create_access_token(admin)}"}
