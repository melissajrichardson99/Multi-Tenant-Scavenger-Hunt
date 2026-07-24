import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..models import Character, PlayerSession, Scan, AdminUser
from ..auth import get_current_admin
from ..qr_codes import QR_CODES_DIR, generate_unique_qr_code, generate_and_upload_qr_image, normalize_code
from ..storage import ALLOWED_IMAGE_CONTENT_TYPES, MAX_UPLOAD_BYTES, QR_CODES_BUCKET, upload_character_image, public_url

router = APIRouter(prefix="/api/admin/characters", tags=["Admin Characters"])
public_router = APIRouter(prefix="/api/characters", tags=["Characters"])


def _validate_trivia_fields(question, description, option_a, option_b, option_c, option_d, correct_answer):
    """
    Trivia is entirely optional per-character (presence of trivia_question is
    what turns the feature on). Once a question is set, require the
    description and at least options a/b — c/d stay optional so 2- or
    3-option questions are allowed — and require trivia_correct_answer to
    point at one of the options that's actually filled in.
    """
    if not question:
        return

    if not description:
        raise HTTPException(status_code=400, detail="trivia_description is required when trivia_question is set")
    if not option_a or not option_b:
        raise HTTPException(status_code=400, detail="trivia_option_a and trivia_option_b are required when trivia_question is set")

    options = {"a": option_a, "b": option_b, "c": option_c, "d": option_d}
    if not correct_answer or correct_answer not in options or not options[correct_answer]:
        raise HTTPException(status_code=400, detail="trivia_correct_answer must point to a filled-in option")


@public_router.get("/lookup-hunt")
def lookup_hunt_by_code(code: str, db: DBSession = Depends(get_db)):
    """
    Public, unauthenticated lookup for routing a guest who scanned a physical
    sign with no active session yet (e.g. via their phone's regular camera
    app, before ever visiting an entrance screen). Returns only the routing
    info needed to send them to the right org's entrance screen — never
    name, description, image, or anything else spoiler-revealing.
    """
    normalized_code = normalize_code(code)
    character = (
        db.query(Character)
        .filter(func.upper(func.replace(Character.qr_code_value, "-", "")) == normalized_code)
        .first()
    )
    if not character:
        raise HTTPException(status_code=404, detail="Code not found")

    return {
        "organization_slug": character.hunt.organization.slug,
        "hunt_id": str(character.hunt_id),
    }


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
        "has_trivia": bool(character.trivia_question),
    }


@public_router.get("/{character_id}/trivia")
def get_character_trivia(character_id: str, device_token: str, db: DBSession = Depends(get_db)):
    """
    Public trivia lookup for the "Fun Fact" mini-game. Same ownership-gated
    pattern as the revisit endpoint above: requires a matching Scan row for
    this device, and returns a generic 404 for any failure (unowned character,
    nonexistent character, or a character with no trivia_question set) so a
    guest can't probe for character IDs, other sessions' finds, or which
    characters happen to have trivia configured.
    """
    try:
        character_uuid = uuid.UUID(character_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Trivia not found")

    session = (
        db.query(PlayerSession)
        .filter(PlayerSession.device_token == device_token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Trivia not found")

    character = (
        db.query(Character)
        .filter(Character.id == character_uuid, Character.hunt_id == session.hunt_id)
        .first()
    )
    if not character:
        raise HTTPException(status_code=404, detail="Trivia not found")

    scan = (
        db.query(Scan)
        .filter(Scan.session_id == session.id, Scan.character_id == character.id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=404, detail="Trivia not found")

    if not character.trivia_question:
        raise HTTPException(status_code=404, detail="Trivia not found")

    return {
        "id": str(character.id),
        "trivia_question": character.trivia_question,
        "trivia_option_a": character.trivia_option_a,
        "trivia_option_b": character.trivia_option_b,
        "trivia_option_c": character.trivia_option_c,
        "trivia_option_d": character.trivia_option_d,
        "trivia_correct_answer": character.trivia_correct_answer,
        "trivia_description": character.trivia_description,
    }


@router.post("/upload-image")
async def upload_admin_character_image(
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
):
    """
    Uploads a character image file to the "character-images" Supabase
    Storage bucket and returns its public URL, for the admin form to drop
    into the character's image_url field. Does not touch the database.
    """
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise HTTPException(
            status_code=400,
            detail="File must be an image (JPEG, PNG, GIF, or WEBP).",
        )

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5MB or smaller.")

    extension = ALLOWED_IMAGE_CONTENT_TYPES[file.content_type]
    object_name = f"{uuid.uuid4()}{extension}"

    try:
        image_url = upload_character_image(object_name, file.content_type, contents)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return {"image_url": image_url}


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
            "hint": c.hint,
            "area": c.area,
            "trivia_question": c.trivia_question,
            "trivia_option_a": c.trivia_option_a,
            "trivia_option_b": c.trivia_option_b,
            "trivia_option_c": c.trivia_option_c,
            "trivia_option_d": c.trivia_option_d,
            "trivia_correct_answer": c.trivia_correct_answer,
            "trivia_description": c.trivia_description,
            "is_secret": c.is_secret,
            "qr_code_image_url": public_url(QR_CODES_BUCKET, f"{c.qr_code_value}.png"),
        }
        for c in characters
    ]


@router.post("")
def create_admin_character(payload: dict, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    """
    Create a new character.  Automatically generates a unique, human-friendly
    qr_code_value (e.g. K7XQ-2M9P-T4RN) and uploads a QR code PNG to the
    "qr-codes" Supabase Storage bucket.  Returns the created character
    including qr_code_image_url.
    """
    hunt_id = payload.get("hunt_id")
    name = payload.get("name")

    if not hunt_id:
        raise HTTPException(status_code=400, detail="hunt_id is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    _validate_trivia_fields(
        payload.get("trivia_question"),
        payload.get("trivia_description"),
        payload.get("trivia_option_a"),
        payload.get("trivia_option_b"),
        payload.get("trivia_option_c"),
        payload.get("trivia_option_d"),
        payload.get("trivia_correct_answer"),
    )

    # Generate a unique QR code value
    qr_code_value = generate_unique_qr_code(db)

    # Generate the QR image and upload it to Supabase Storage
    try:
        qr_code_image_url = generate_and_upload_qr_image(qr_code_value)
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
        hint=payload.get("hint"),
        area=payload.get("area"),
        trivia_question=payload.get("trivia_question"),
        trivia_option_a=payload.get("trivia_option_a"),
        trivia_option_b=payload.get("trivia_option_b"),
        trivia_option_c=payload.get("trivia_option_c"),
        trivia_option_d=payload.get("trivia_option_d"),
        trivia_correct_answer=payload.get("trivia_correct_answer"),
        trivia_description=payload.get("trivia_description"),
        is_secret=payload.get("is_secret", False),
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
        "hint": character.hint,
        "area": character.area,
        "trivia_question": character.trivia_question,
        "trivia_option_a": character.trivia_option_a,
        "trivia_option_b": character.trivia_option_b,
        "trivia_option_c": character.trivia_option_c,
        "trivia_option_d": character.trivia_option_d,
        "trivia_correct_answer": character.trivia_correct_answer,
        "trivia_description": character.trivia_description,
        "is_secret": character.is_secret,
        "qr_code_image_url": qr_code_image_url,
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

    # Validate against the effective post-update state: fields not present in
    # the payload keep their existing value on the character.
    def _effective(field):
        return payload[field] if field in payload else getattr(character, field)

    _validate_trivia_fields(
        _effective("trivia_question"),
        _effective("trivia_description"),
        _effective("trivia_option_a"),
        _effective("trivia_option_b"),
        _effective("trivia_option_c"),
        _effective("trivia_option_d"),
        _effective("trivia_correct_answer"),
    )

    updatable = [
        "name", "description", "image_url", "points", "sort_order", "hint", "area",
        "trivia_question", "trivia_option_a", "trivia_option_b", "trivia_option_c",
        "trivia_option_d", "trivia_correct_answer", "trivia_description", "is_secret",
    ]
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
        "hint": character.hint,
        "area": character.area,
        "trivia_question": character.trivia_question,
        "trivia_option_a": character.trivia_option_a,
        "trivia_option_b": character.trivia_option_b,
        "trivia_option_c": character.trivia_option_c,
        "trivia_option_d": character.trivia_option_d,
        "trivia_correct_answer": character.trivia_correct_answer,
        "trivia_description": character.trivia_description,
        "is_secret": character.is_secret,
        "qr_code_image_url": public_url(QR_CODES_BUCKET, f"{character.qr_code_value}.png"),
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
