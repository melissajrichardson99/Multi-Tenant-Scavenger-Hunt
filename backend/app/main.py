import os
from pathlib import Path
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy import text
from .database import engine, Base, get_db
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

# ── QR codes directory setup ──────────────────────────────────────────────────
# Lives at <project-root>/qr_codes/ (one level above the backend/ package).
PROJECT_ROOT = Path(__file__).resolve().parents[2]
QR_CODES_DIR = PROJECT_ROOT / "qr_codes"
QR_CODES_DIR.mkdir(parents=True, exist_ok=True)

# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="Cobb's Scavenger Hunt API",
    description="Backend API for multi-property scavenger hunts",
    version="1.0.0"
)

# Enable CORS for local Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated QR code images at /qr_codes/<filename>.png
app.mount("/qr_codes", StaticFiles(directory=str(QR_CODES_DIR)), name="qr_codes")

# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "database": db_status
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
