from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.engine import make_url
from sqlalchemy.orm import declarative_base, sessionmaker

from .config import DATABASE_URL, PROJECT_ROOT


def _resolve_database_url(raw_url: str):
    """
    Relative SQLite paths (e.g. sqlite:///./dev.db) are resolved against the
    project root, so the backend (run from backend/) and the scripts (run
    from the project root) always open the same file.
    """
    # Plain postgresql:// URLs (and Supabase-style postgres://) use the
    # psycopg2 driver from requirements.txt. SQLAlchemy 2.1 would otherwise
    # default to psycopg 3, which isn't installed.
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql://" + raw_url[len("postgres://"):]
    url = make_url(raw_url)
    if url.drivername == "postgresql":
        url = url.set(drivername="postgresql+psycopg2")
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        db_path = Path(url.database)
        if not db_path.is_absolute():
            url = url.set(database=str((PROJECT_ROOT / db_path).resolve()))
    return url


database_url = _resolve_database_url(DATABASE_URL)

# SQLite needs check_same_thread=False because FastAPI serves requests from
# a thread pool; Postgres needs no extra connect args.
connect_args = {"check_same_thread": False} if database_url.get_backend_name() == "sqlite" else {}

engine = create_engine(database_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
