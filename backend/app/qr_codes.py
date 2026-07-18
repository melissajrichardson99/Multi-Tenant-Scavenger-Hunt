"""
Shared helpers for generating human-friendly QR code values and the QR
image files that encode them.  Used by the admin character-creation
endpoint (characters.py) and by the one-time regeneration script
(regenerate_qr_codes.py) so both stay in sync.
"""

import re
import random
from pathlib import Path
from sqlalchemy.orm import Session as DBSession

from .models import Character

try:
    import qrcode
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

# Uppercase letters and digits, excluding visually ambiguous characters:
# 0/O, 1/I/L.
CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
CODE_LENGTH = 12
GROUP_SIZE = 4

# Directory where QR code images are stored (relative to project root).
QR_CODES_DIR = Path(__file__).resolve().parents[2] / "qr_codes"


def generate_short_code() -> str:
    """Generate a 12-character code from the safe alphabet, formatted as XXXX-XXXX-XXXX."""
    raw = "".join(random.choices(CODE_ALPHABET, k=CODE_LENGTH))
    groups = [raw[i:i + GROUP_SIZE] for i in range(0, CODE_LENGTH, GROUP_SIZE)]
    return "-".join(groups)


def generate_unique_qr_code(db: DBSession, max_attempts: int = 20) -> str:
    """
    Generate a short code and verify it isn't already in use by another
    character, retrying on the rare chance of a collision.
    """
    for _ in range(max_attempts):
        candidate = generate_short_code()
        exists = db.query(Character.id).filter(Character.qr_code_value == candidate).first()
        if not exists:
            return candidate
    raise RuntimeError("Failed to generate a unique QR code after multiple attempts")


def normalize_code(value: str) -> str:
    """Strip dashes/whitespace and uppercase a submitted code for comparison."""
    return re.sub(r"[\s-]", "", value or "").upper()


def generate_qr_image(qr_code_value: str) -> str:
    """
    Generate a QR code PNG encoding the scan URL and save it to
    qr_codes/{qr_code_value}.png.  Returns the filename (not the full path).
    """
    if not QR_AVAILABLE:
        raise RuntimeError("qrcode library is not installed")

    QR_CODES_DIR.mkdir(parents=True, exist_ok=True)

    scan_url = f"http://localhost:3000/scan?code={qr_code_value}"
    img = qrcode.make(scan_url)
    filename = f"{qr_code_value}.png"
    filepath = QR_CODES_DIR / filename
    img.save(str(filepath))
    return filename
