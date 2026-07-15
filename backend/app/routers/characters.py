import uuid
import os
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..models import Character

try:
    import qrcode
    from qrcode.image.pure import PyPNGImage
    QR_AVAILABLE = True
except ImportError:
    QR_AVAILABLE = False

router = APIRouter(prefix="/api/admin/characters", tags=["Admin Characters"])

# Directory where QR code images are stored (relative to project root).
# main.py creates this directory on startup and mounts it as static files.
QR_CODES_DIR = Path(__file__).resolve().parents[3] / "qr_codes"


def _generate_qr_image(qr_code_value: str) -> str:
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


@router.get("")
def get_admin_characters(hunt_id: str = None, db: DBSession = Depends(get_db)):
    """List all characters, optionally filtered by hunt_id."""
    query = db.query(Character)
    if hunt_id:
        query = query.filter(Character.hunt_id == hunt_id)
    characters = query.order_by(Character.sort_order).all()
    return [
        {
            "id": str(c.id),
            "hunt_id": str(c.hunt_id),
            "name": c.name,
            "description": c.description,
            "image_url": c.image_url,
            "points": c.points,
            "qr_code_value": c.qr_code_value,
            "sort_order": c.sort_order,
            "qr_code_image_url": f"/qr_codes/{c.qr_code_value}.png",
        }
        for c in characters
    ]


@router.post("")
def create_admin_character(payload: dict, db: DBSession = Depends(get_db)):
    """
    Create a new character.  Automatically generates a unique qr_code_value
    (UUID) and saves a QR code PNG to disk.  Returns the created character
    including qr_code_image_url.
    """
    hunt_id = payload.get("hunt_id")
    name = payload.get("name")

    if not hunt_id:
        raise HTTPException(status_code=400, detail="hunt_id is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Generate a unique QR code value
    qr_code_value = str(uuid.uuid4())

    # Generate and persist the QR image
    try:
        qr_filename = _generate_qr_image(qr_code_value)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    character = Character(
        hunt_id=hunt_id,
        name=name,
        description=payload.get("description"),
        image_url=payload.get("image_url"),
        points=payload.get("points", 10),
        qr_code_value=qr_code_value,
        sort_order=payload.get("sort_order", 0),
    )
    db.add(character)
    db.commit()
    db.refresh(character)

    return {
        "id": str(character.id),
        "hunt_id": str(character.hunt_id),
        "name": character.name,
        "description": character.description,
        "image_url": character.image_url,
        "points": character.points,
        "qr_code_value": character.qr_code_value,
        "sort_order": character.sort_order,
        "qr_code_image_url": f"/qr_codes/{qr_filename}",
    }


@router.patch("")
def update_admin_character(payload: dict, db: DBSession = Depends(get_db)):
    """Update mutable fields on a character (does not regenerate QR code)."""
    character_id = payload.get("id")
    if not character_id:
        raise HTTPException(status_code=400, detail="id is required")

    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    updatable = ["name", "description", "image_url", "points", "sort_order"]
    for field in updatable:
        if field in payload:
            setattr(character, field, payload[field])

    db.commit()
    db.refresh(character)

    return {
        "id": str(character.id),
        "hunt_id": str(character.hunt_id),
        "name": character.name,
        "description": character.description,
        "image_url": character.image_url,
        "points": character.points,
        "qr_code_value": character.qr_code_value,
        "sort_order": character.sort_order,
        "qr_code_image_url": f"/qr_codes/{character.qr_code_value}.png",
    }


@router.delete("")
def delete_admin_character(character_id: str, db: DBSession = Depends(get_db)):
    """Delete a character by ID."""
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Optionally remove the QR image file from disk
    qr_file = QR_CODES_DIR / f"{character.qr_code_value}.png"
    if qr_file.exists():
        qr_file.unlink()

    db.delete(character)
    db.commit()
    return {"success": True, "deleted_id": character_id}
