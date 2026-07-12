from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
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
    admin
)

# Initialize FastAPI
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

# Root/Health Check endpoint
@app.get("/api/health")
def health_check(db: Session = Depends(get_db)):
    try:
        # Test the DB connection
        db.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as e:
        db_status = f"error: {str(e)}"
    
    return {
        "status": "ok",
        "database": db_status
    }

# Register Routers
app.include_router(organizations.router)
app.include_router(hunts.router)
app.include_router(characters.router)
app.include_router(sessions.router)
app.include_router(scans.router)
app.include_router(progress.router)
app.include_router(admin.router)
