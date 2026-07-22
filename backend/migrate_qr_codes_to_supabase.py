"""
migrate_qr_codes_to_supabase.py — One-time script to move every existing
Character's QR code image from local disk (backend/qr_codes/) to the
"qr-codes" Supabase Storage bucket.

qr_code_image_url is not a stored database column — it's computed on the
fly from qr_code_value (see routers/characters.py), so this script does not
touch the database. It only re-renders each character's QR PNG from its
existing qr_code_value (the code itself is left untouched) and uploads it
to Supabase under {qr_code_value}.png, matching the same deterministic
naming the API now uses to build qr_code_image_url.

Safe to re-run: uploads use upsert, so re-running just re-uploads the same
image over itself.

Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment, and
the "qr-codes" bucket to already exist with public read access.

Run from the project root:
    python backend/migrate_qr_codes_to_supabase.py
"""

import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.models import Character
from app.qr_codes import generate_and_upload_qr_image


def migrate():
    db = SessionLocal()
    try:
        characters = db.query(Character).order_by(Character.sort_order).all()
        if not characters:
            print("No characters found — nothing to do.")
            return

        succeeded = 0
        failed = 0

        for character in characters:
            try:
                image_url = generate_and_upload_qr_image(character.qr_code_value)
                print(f"[OK] {character.name} ({character.qr_code_value}) -> {image_url}")
                succeeded += 1
            except RuntimeError as e:
                print(f"[FAILED] {character.name} ({character.qr_code_value}): {e}", file=sys.stderr)
                failed += 1

        print(f"\nDone. {succeeded} uploaded, {failed} failed.")
        if failed:
            sys.exit(1)

    finally:
        db.close()


if __name__ == "__main__":
    migrate()
