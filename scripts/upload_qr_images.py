# Re-renders every character's QR code PNG from its existing qr_code_value and stores it (e.g. after changing PUBLIC_BASE_URL).
"""
QR images encode {PUBLIC_BASE_URL}/scan?code=..., so they need re-rendering
whenever PUBLIC_BASE_URL changes (for example when moving from local
development to a real domain). qr_code_value itself is left untouched, so
already-recorded scans and the codes guests type in by hand keep working.

Writes to Supabase Storage when SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY are
set (the "qr-codes" bucket must exist with public read access), otherwise
to local disk under uploads/qr-codes/. Safe to re-run: existing images are
overwritten.

Run from the project root:
    python scripts/upload_qr_images.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.database import SessionLocal
from app.models import Character
from app.qr_codes import generate_and_upload_qr_image


def upload_all():
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
    upload_all()
