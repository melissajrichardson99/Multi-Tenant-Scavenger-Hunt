"""
add_admin_is_active_column.py — One-time script to add admin_users.is_active
via direct SQL against the real Supabase Postgres instance (same approach used
for organizations.theme_mode and the characters trivia columns).

Run from the project root:
    python backend/add_admin_is_active_column.py

Idempotent — safe to re-run (uses IF NOT EXISTS).
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.database import engine

if __name__ == "__main__":
    with engine.begin() as conn:
        conn.execute(text(
            "ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;"
        ))
    print("[DONE] admin_users.is_active column present.")
