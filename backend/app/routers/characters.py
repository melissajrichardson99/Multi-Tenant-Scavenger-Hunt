import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import func
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..models import Character, Hunt, PlayerSession, Scan, AdminUser
from ..auth import get_current_admin
from ..qr_codes import generate_unique_qr_code, generate_and_upload_qr_image, normalize_code
from ..storage import (
    ALLOWED_IMAGE_CONTENT_TYPES,
    MAX_UPLOAD_BYTES,
    QR_CODES_BUCKET,
    delete_local_object,
    upload_character_image,
    public_url,
)

router = APIRouter(prefix="/api/admin/characters", tags=["Admin Characters"])
public_router = APIRouter(prefix="/api/characters", tags=["Characters"])


def _parse_uuid(value, not_found_detail):
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail=not_found_detail)


def _scoped_hunt(db: DBSession, admin: AdminUser, hunt_id) -> Hunt:
    """
    Returns the hunt if it exists and the admin may manage it, else 404.
    Same rule as the hunt routes in hunts.py: an organization-scoped admin
    only sees their own organization's hunts; a super-admin
    (organization_id is None) sees every organization's.
    """
    query = db.query(Hunt).filter(Hunt.id == _parse_uuid(hunt_id, "Hunt not found"))
    if admin.organization_id:
        query = query.filter(Hunt.organization_id == admin.organization_id)
    hunt = query.first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")
    return hunt


def _scoped_character(db: DBSession, admin: AdminUser, character_id) -> Character:
    """Returns the character if its hunt belongs to an organization the admin may manage, else 404."""
    query = (
        db.query(Character)
        .join(Hunt, Character.hunt_id == Hunt.id)
        .filter(Character.id == _parse_uuid(character_id, "Character not found"))
    )
    if admin.organization_id:
        query = query.filter(Hunt.organization_id == admin.organization_id)
    character = query.first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character


def _serialize_character(character: Character) -> dict:
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


def _owned_trivia_character(db: DBSession, character_id: str, device_token: str) -> Character:
    """
    Ownership gate shared by both trivia endpoints, same pattern as the
    revisit endpoint above: requires a matching Scan row for this device,
    and raises a generic 404 for any failure (unowned character, nonexistent
    character, or a character with no trivia_question set) so a guest can't
    probe for character IDs, other sessions' finds, or which characters
    happen to have trivia configured.
    """
    not_found = HTTPException(status_code=404, detail="Trivia not found")
    try:
        character_uuid = uuid.UUID(character_id)
    except (ValueError, TypeError):
        raise not_found

    session = (
        db.query(PlayerSession)
        .filter(PlayerSession.device_token == device_token)
        .first()
    )
    if not session:
        raise not_found

    character = (
        db.query(Character)
        .filter(Character.id == character_uuid, Character.hunt_id == session.hunt_id)
        .first()
    )
    if not character:
        raise not_found

    scan = (
        db.query(Scan)
        .filter(Scan.session_id == session.id, Scan.character_id == character.id)
        .first()
    )
    if not scan or not character.trivia_question:
        raise not_found

    return character


@public_router.get("/{character_id}/trivia")
def get_character_trivia(character_id: str, device_token: str, db: DBSession = Depends(get_db)):
    """
    Public trivia question for the "Fun Fact" mini-game. Returns the question
    and options only — the correct answer and the fact stay hidden until the
    guest submits an answer to the endpoint below.
    """
    character = _owned_trivia_character(db, character_id, device_token)

    return {
        "id": str(character.id),
        "trivia_question": character.trivia_question,
        "trivia_option_a": character.trivia_option_a,
        "trivia_option_b": character.trivia_option_b,
        "trivia_option_c": character.trivia_option_c,
        "trivia_option_d": character.trivia_option_d,
    }


@public_router.post("/{character_id}/trivia/answer")
def answer_character_trivia(character_id: str, payload: dict, db: DBSession = Depends(get_db)):
    """
    Checks a guest's answer and reveals the correct option plus the fun-fact
    description (shown whether or not they got it right).
    """
    character = _owned_trivia_character(db, character_id, payload.get("device_token"))

    answer = payload.get("answer")
    options = {
        "a": character.trivia_option_a,
        "b": character.trivia_option_b,
        "c": character.trivia_option_c,
        "d": character.trivia_option_d,
    }
    if answer not in options or not options[answer]:
        raise HTTPException(status_code=400, detail="answer must be one of the question's options")

    return {
        "correct": answer == character.trivia_correct_answer,
        "correct_answer": character.trivia_correct_answer,
        "trivia_description": character.trivia_description,
    }


@router.post("/upload-image")
async def upload_admin_character_image(
    file: UploadFile = File(...),
    admin: AdminUser = Depends(get_current_admin),
):
    """
    Uploads a character image file to the "character-images" bucket and
    returns its public URL, for the admin form to drop into the character's
    image_url field. Doesn't read or write any organization's data, so it
    needs an authenticated admin but no organization scoping.
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
    """List characters the admin may manage, optionally filtered by hunt_id."""
    query = db.query(Character)
    if hunt_id:
        hunt = _scoped_hunt(db, admin, hunt_id)
        query = query.filter(Character.hunt_id == hunt.id)
    elif admin.organization_id:
        query = (
            query.join(Hunt, Character.hunt_id == Hunt.id)
            .filter(Hunt.organization_id == admin.organization_id)
        )
    characters = query.order_by(Character.sort_order).all()
    return [_serialize_character(c) for c in characters]


@router.post("")
def create_admin_character(payload: dict, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    """
    Create a new character in a hunt the admin may manage.  Automatically
    generates a unique, human-friendly qr_code_value (e.g. K7XQ-2M9P-T4RN)
    and stores a QR code PNG in the "qr-codes" bucket.  Returns the created
    character including qr_code_image_url.
    """
    hunt_id = payload.get("hunt_id")
    name = payload.get("name")

    if not hunt_id:
        raise HTTPException(status_code=400, detail="hunt_id is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    hunt = _scoped_hunt(db, admin, hunt_id)

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

    # Generate the QR image and store it
    try:
        generate_and_upload_qr_image(qr_code_value)
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))

    character = Character(
        hunt_id=hunt.id,
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

    return _serialize_character(character)


@router.patch("")
def update_admin_character(payload: dict, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    """Update mutable fields on a character the admin may manage (does not regenerate QR code)."""
    character_id = payload.get("id")
    if not character_id:
        raise HTTPException(status_code=400, detail="id is required")

    character = _scoped_character(db, admin, character_id)

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

    # hunt_id is deliberately not updatable, so a character can't be moved
    # into another organization's hunt.
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

    return _serialize_character(character)


@router.delete("")
def delete_admin_character(character_id: str, db: DBSession = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    """Delete a character the admin may manage, by ID."""
    character = _scoped_character(db, admin, character_id)

    delete_local_object(QR_CODES_BUCKET, f"{character.qr_code_value}.png")

    db.delete(character)
    db.commit()
    return {"success": True, "deleted_id": character_id}
