import uuid
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..models import Character, PlayerSession, Scan, AdminUser
from ..auth import get_current_admin
from ..qr_codes import QR_CODES_DIR, generate_unique_qr_code, generate_qr_image

router = APIRouter(prefix="/api/admin/characters", tags=["Admin Characters"])
public_router = APIRouter(prefix="/api/characters", tags=["Characters"])


@public_router.get("/{character_id}")
def get_character_detail(character_id: str, device_token: str, db: DBSession = Depends(get_db)):
    """
    Public character detail lookup for the "revisit from gallery" flow.
    Requires proof the requesting device already found this character (a
    matching Scan row) — returns a generic 404 for any failure so a guest
    can't probe for character IDs or other sessions' finds.
    """
    try:
        character_uuid = uuid.UUID(character_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Character not found")

    session = (
        db.query(PlayerSession)
        .filter(PlayerSession.device_token == device_token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Character not found")

    character = (
        db.query(Character)
        .filter(Character.id == character_uuid, Character.hunt_id == session.hunt_id)
        .first()
    )
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    scan = (
        db.query(Scan)
        .filter(Scan.session_id == session.id, Scan.character_id == character.id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Character not found")

    return {
        "id": str(character.id),
        "name": character.name,
        "description": character.description,
        "image_url": character.image_url,
        "points": character.points,
    }


@router.get("")
def get_admin_characters(hunt_id: str = None, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
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
def create_admin_character(payload: dict, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    """
    Create a new character.  Automatically generates a unique, human-friendly
    qr_code_value (e.g. K7XQ-2M9P-T4RN) and saves a QR code PNG to disk.
    Returns the created character including qr_code_image_url.
    """
    hunt_id = payload.get("hunt_id")
    name = payload.get("name")

    if not hunt_id:
        raise HTTPException(status_code=400, detail="hunt_id is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Generate a unique QR code value
    qr_code_value = generate_unique_qr_code(db)

    # Generate and persist the QR image
    try:
        qr_filename = generate_qr_image(qr_code_value)
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
def update_admin_character(payload: dict, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
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
def delete_admin_character(character_id: str, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
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
