from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError, StatementError
from sqlalchemy.orm import Session
from sqlalchemy import text
from .config import CORS_ALLOWED_ORIGINS, USE_SUPABASE_STORAGE, UPLOADS_DIR
from .database import engine, get_db
from .storage import BUCKETS, LOCAL_URL_PREFIX
from .routers import (
    organizations,
    hunts,
    characters,
    sessions,
    scans,
    progress,
    admin,
    proxy
)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cobb's Scavenger Hunt API",
    description="Backend API for multi-property scavenger hunts",
    version="1.0.0"
)

# Explicit origins only (CORS_ALLOWED_ORIGINS, see config.py). Admin auth is a
# Bearer header and guests pass device_token explicitly, so no cookies or
# other credentials ever need to cross origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ALLOWED_ORIGINS,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Local-disk storage (development/test): serve uploaded character images and
# QR PNGs at /uploads/<bucket>/<object>. With Supabase Storage configured,
# files are served by Supabase instead and nothing is mounted here.
if not USE_SUPABASE_STORAGE:
    for bucket in BUCKETS:
        (UPLOADS_DIR / bucket).mkdir(parents=True, exist_ok=True)
    app.mount(LOCAL_URL_PREFIX, StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.exception_handler(StatementError)
def handle_statement_error(request: Request, exc: StatementError):
    # A malformed id (e.g. "abc" where a UUID is expected) fails while
    # binding query parameters; treat it like any other unknown id.
    if isinstance(exc.orig, ValueError):
        return JSONResponse(status_code=404, content={"detail": "Not found"})
    raise exc


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    # Never echo the driver's error text: it can include hostnames or usernames.
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except SQLAlchemyError:
        db_status = "unavailable"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "database": db_status,
        "database_type": engine.dialect.name,
    }

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(organizations.router)
app.include_router(hunts.router)
app.include_router(characters.router)
app.include_router(characters.public_router)
app.include_router(sessions.router)
app.include_router(scans.router)
app.include_router(progress.router)
app.include_router(admin.router)
app.include_router(proxy.router)
