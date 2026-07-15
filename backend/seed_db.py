"""
seed_db.py — One-time script to insert a placeholder Organization and Hunt
into the Supabase Postgres database for development/testing.

Run from the project root:
    python backend/seed_db.py

Prints the inserted IDs so you can reference them in Supabase.
"""

import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.models import Organization, Hunt


def seed():
    db = SessionLocal()
    try:
        # Check for existing seed data (idempotent — won't duplicate)
        existing_org = db.query(Organization).filter(Organization.slug == "cobbs").first()
        if existing_org:
            print(f"[SKIP] Organization 'cobbs' already exists — id={existing_org.id}")
            org = existing_org
        else:
            org = Organization(
                name="Cobb's Adventure Park",
                slug="cobbs",
                theme_primary="#1a7f37",   # Cobb's green
                theme_secondary="#ffffff",
            )
            db.add(org)
            db.flush()  # get the generated ID before commit
            print(f"[CREATED] Organization: id={org.id}  slug=cobbs  name=\"Cobb's Adventure Park\"")

        existing_hunt = (
            db.query(Hunt)
            .filter(Hunt.organization_id == org.id, Hunt.name == "Cobb's Summer Hunt 2026")
            .first()
        )
        if existing_hunt:
            print(f"[SKIP] Hunt already exists — id={existing_hunt.id}")
        else:
            hunt = Hunt(
                organization_id=org.id,
                name="Cobb's Summer Hunt 2026",
                description="Find all the hidden characters around the park and unlock prizes!",
                is_active=True,
            )
            db.add(hunt)
            db.flush()
            print(f"[CREATED] Hunt: id={hunt.id}  name=\"Cobb's Summer Hunt 2026\"")

        db.commit()
        print("\n✅ Seed complete. Copy the IDs above into your .env or tests as needed.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Seed failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
