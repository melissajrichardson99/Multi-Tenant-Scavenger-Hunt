"""
regenerate_qr_codes.py — One-time script to migrate every existing Character
from a full-UUID qr_code_value to the new short, human-friendly format
(e.g. K7XQ-2M9P-T4RN), and regenerate its QR image file to match.

Character.id (the UUID primary key) is left completely untouched — only
qr_code_value and the QR image on disk are regenerated.

Safe to re-run: characters whose qr_code_value is already in the short
format are skipped.

Run from the project root:
    python backend/regenerate_qr_codes.py
"""

import re
import sys
from pathlib import Path

# Ensure the backend package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.database import SessionLocal
from app.models import Character
from app.qr_codes import CODE_ALPHABET, QR_CODES_DIR, generate_unique_qr_code, generate_qr_image

SHORT_CODE_PATTERN = re.compile(
    rf"^[{CODE_ALPHABET}]{{4}}-[{CODE_ALPHABET}]{{4}}-[{CODE_ALPHABET}]{{4}}$"
)


def regenerate():
    db = SessionLocal()
    try:
        characters = db.query(Character).order_by(Character.sort_order).all()
        if not characters:
            print("No characters found — nothing to do.")
            return

        for character in characters:
            old_value = character.qr_code_value

            if SHORT_CODE_PATTERN.match(old_value or ""):
                print(f"[SKIP] {character.name} - already has a short code ({old_value})")
                continue

            new_value = generate_unique_qr_code(db)
            character.qr_code_value = new_value
            db.commit()
            db.refresh(character)

            new_filename = generate_qr_image(new_value)

            old_qr_file = QR_CODES_DIR / f"{old_value}.png"
            if old_qr_file.exists():
                old_qr_file.unlink()

            print(f"[UPDATED] {character.name}: {old_value} -> {new_value} ({new_filename})")

        print("\nDone. All characters now use the short QR code format.")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Regeneration failed: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    regenerate()
