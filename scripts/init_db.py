# Creates the database tables: applies backend/schema.sql on Postgres, or builds them from the SQLAlchemy models on SQLite.
"""
Run from the project root after setting DATABASE_URL in .env:
    python scripts/init_db.py

Safe to re-run: schema.sql uses CREATE ... IF NOT EXISTS, and
SQLAlchemy's create_all skips tables that already exist.
"""

import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from app.database import Base, engine
from app import models  # noqa: F401  (registers every table on Base.metadata)


def init_db():
    dialect = engine.dialect.name
    if dialect == "postgresql":
        schema_sql = (BACKEND_DIR / "schema.sql").read_text(encoding="utf-8")
        # Run the whole file as one script on a raw driver cursor (no
        # parameter substitution, so a "%" in a comment is harmless).
        raw_conn = engine.raw_connection()
        try:
            with raw_conn.cursor() as cursor:
                cursor.execute(schema_sql)
            raw_conn.commit()
        finally:
            raw_conn.close()
        print("[DONE] Applied backend/schema.sql")
    else:
        Base.metadata.create_all(engine)
        print(f"[DONE] Created tables from the SQLAlchemy models ({dialect})")


if __name__ == "__main__":
    init_db()
