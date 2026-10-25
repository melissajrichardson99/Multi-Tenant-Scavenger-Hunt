"""
Shared helpers for generating human-friendly QR code values and the QR
images that encode them.  Used by the admin character-creation endpoint
(characters.py), the demo seed and scripts/upload_qr_images.py so they all
stay in sync.
"""

import io
import re
import random
from sqlalchemy.orm import Session as DBSession

from .config import PUBLIC_BASE_URL
from .models import Character
from .storage import QR_CODES_BUCKET, upload_to_bucket

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


def scan_url_for(qr_code_value: str) -> str:
    """The URL a printed QR code encodes: the guest app's /scan page on PUBLIC_BASE_URL."""
    return f"{PUBLIC_BASE_URL}/scan?code={qr_code_value}"


def generate_qr_image_bytes(qr_code_value: str) -> bytes:
    """Generate a QR code PNG encoding the scan URL and return its raw bytes."""
    if not QR_AVAILABLE:
        raise RuntimeError("qrcode library is not installed")

    img = qrcode.make(scan_url_for(qr_code_value))
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    return buffer.getvalue()


def generate_and_upload_qr_image(qr_code_value: str) -> str:
    """
    Generate a QR code PNG encoding the scan URL and upload it to the
    "qr-codes" bucket (see storage.py) under {qr_code_value}.png.
    Returns the public URL. Raises RuntimeError if generation or upload fails.
    """
    image_bytes = generate_qr_image_bytes(qr_code_value)
    object_name = f"{qr_code_value}.png"
    return upload_to_bucket(QR_CODES_BUCKET, object_name, "image/png", image_bytes)
