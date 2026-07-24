"""
add_optional_trivia_and_secret_character_columns.py — One-time script to:
  1. Drop the NOT NULL constraint on characters.trivia_option_c/d (same
     approach used for organizations.theme_mode and admin_users.is_active),
     so 2- and 3-option trivia questions can leave them blank.
  2. Add a nullable characters.is_secret boolean column (default false) for
     bonus/secret characters that don't count toward hunt completion.

Run from the project root:
    python backend/add_optional_trivia_and_secret_character_columns.py

Idempotent — safe to re-run.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import text
from app.database import engine

if __name__ == "__main__":
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE characters ALTER COLUMN trivia_option_c DROP NOT NULL;"))
        conn.execute(text("ALTER TABLE characters ALTER COLUMN trivia_option_d DROP NOT NULL;"))
        conn.execute(text(
            "ALTER TABLE characters ADD COLUMN IF NOT EXISTS is_secret BOOLEAN NOT NULL DEFAULT false;"
        ))
    print("[DONE] characters.trivia_option_c/d are nullable and characters.is_secret is present.")
