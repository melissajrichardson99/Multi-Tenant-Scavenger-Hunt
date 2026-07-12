import os
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Locate the root directory containing .env
# Project layout:
# /workspace
#   /.env
#   /backend
#     /app
#       /database.py
current_dir = Path(__file__).resolve().parent
root_dir = current_dir.parent.parent
env_path = root_dir / ".env"

if env_path.exists():
    load_dotenv(dotenv_path=env_path)
else:
    load_dotenv()  # Fallback to standard searching

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    # Use a dummy SQLite in-memory DB or raise an error.
    # The spec says DATABASE_URL should be in .env. We fallback safely if not found.
    DATABASE_URL = "sqlite:///:memory:"

# SQLAlchemy engine and session setup
# If using Postgres, we don't need check_same_thread. For SQLite (fallback) we do.
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
