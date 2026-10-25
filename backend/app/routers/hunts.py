from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Organization, Hunt, Character, PlayerSession, Scan, AdminUser
from ..auth import get_current_admin
from ..pdf_generation import build_qr_code_pdf, safe_filename_stem

router = APIRouter(tags=["Hunts"])

# Public Endpoints
@router.get("/api/hunts")
def list_active_hunts(db: Session = Depends(get_db)):
    rows = (
        db.query(Hunt, Organization)
        .join(Organization, Hunt.organization_id == Organization.id)
        .filter(Hunt.is_active == True)
        .order_by(Organization.name, Hunt.name)
        .all()
    )

    character_counts = dict(
        db.query(Character.hunt_id, func.count(Character.id))
        .filter(
            Character.hunt_id.in_([hunt.id for hunt, _ in rows]),
            Character.is_secret == False,
        )
        .group_by(Character.hunt_id)
        .all()
    )

    return [
        {
            "hunt_id": str(hunt.id),
            "name": hunt.name,
            "organization": {
                "name": organization.name,
                "slug": organization.slug,
                "theme_primary": organization.theme_primary,
                "theme_secondary": organization.theme_secondary,
                "theme_mode": organization.theme_mode,
                "logo_url": organization.logo_url,
            },
            "total_characters": character_counts.get(hunt.id, 0),
        }
        for hunt, organization in rows
    ]

@router.get("/api/hunts/{slug}")
def get_public_hunt(slug: str, db: Session = Depends(get_db)):
    organization = db.query(Organization).filter(Organization.slug == slug).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Hunt not found")

    hunt = (
        db.query(Hunt)
        .filter(Hunt.organization_id == organization.id, Hunt.is_active == True)
        .first()
    )
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")

    total_characters = (
        db.query(Character)
        .filter(Character.hunt_id == hunt.id, Character.is_secret == False)
        .count()
    )

    return {
        "hunt_id": str(hunt.id),
        "name": hunt.name,
        "organization": {
            "name": organization.name,
            "slug": organization.slug,
            "theme_primary": organization.theme_primary,
            "theme_secondary": organization.theme_secondary,
            "theme_mode": organization.theme_mode,
            "logo_url": organization.logo_url,
        },
        "total_characters": total_characters,
        "is_active": hunt.is_active,
    }

# Admin Endpoints
def _serialize_hunt(hunt: Hunt) -> dict:
    return {
        "id": str(hunt.id),
        "organization_id": str(hunt.organization_id),
        "name": hunt.name,
        "description": hunt.description,
        "is_active": hunt.is_active,
        "start_date": hunt.start_date,
        "end_date": hunt.end_date,
    }


@router.get("/api/admin/hunts")
def get_admin_hunts(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    query = db.query(Hunt)
    if admin.organization_id:
        query = query.filter(Hunt.organization_id == admin.organization_id)
    hunts = query.order_by(Hunt.created_at.desc()).all()
    return [_serialize_hunt(hunt) for hunt in hunts]

@router.post("/api/admin/hunts")
def create_admin_hunt(payload: dict, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    name = payload.get("name")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    # Only super-admins (organization_id is None) may create new hunts.
    if admin.organization_id:
        raise HTTPException(status_code=403, detail="Only super-admins can create hunts")

    organization_id = payload.get("organization_id")
    if not organization_id:
        raise HTTPException(status_code=400, detail="organization_id is required")

    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    hunt = Hunt(
        organization_id=organization_id,
        name=name,
        description=payload.get("description"),
        is_active=payload.get("is_active", True),
        start_date=payload.get("start_date"),
        end_date=payload.get("end_date"),
    )
    db.add(hunt)
    db.commit()
    db.refresh(hunt)

    return _serialize_hunt(hunt)

@router.patch("/api/admin/hunts")
def update_admin_hunt(payload: dict, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    hunt_id = payload.get("id")
    if not hunt_id:
        raise HTTPException(status_code=400, detail="id is required")

    query = db.query(Hunt).filter(Hunt.id == hunt_id)
    if admin.organization_id:
        query = query.filter(Hunt.organization_id == admin.organization_id)
    hunt = query.first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")

    for field in ("name", "description", "is_active", "start_date", "end_date"):
        if field in payload:
            setattr(hunt, field, payload[field])

    db.commit()
    db.refresh(hunt)

    return _serialize_hunt(hunt)

@router.get("/api/admin/hunts/{hunt_id}/stats")
def get_hunt_stats(hunt_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    query = db.query(Hunt).filter(Hunt.id == hunt_id)
    if admin.organization_id:
        query = query.filter(Hunt.organization_id == admin.organization_id)
    hunt = query.first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")

    total_sessions = (
        db.query(func.count(PlayerSession.id))
        .filter(PlayerSession.hunt_id == hunt_id)
        .scalar()
    )

    # Secret characters never count toward the completion denominator —
    # finding all of them should never be required for 100% completion.
    total_characters = (
        db.query(func.count(Character.id))
        .filter(Character.hunt_id == hunt_id, Character.is_secret == False)
        .scalar()
    )

    completion_rate = 0.0
    if total_sessions and total_characters:
        completed_sessions = (
            db.query(Scan.session_id)
            .join(PlayerSession, Scan.session_id == PlayerSession.id)
            .join(Character, Scan.character_id == Character.id)
            .filter(PlayerSession.hunt_id == hunt_id, Character.is_secret == False)
            .group_by(Scan.session_id)
            .having(func.count(Scan.character_id) == total_characters)
            .count()
        )
        completion_rate = completed_sessions / total_sessions

    character_stats = (
        db.query(Character.name, func.count(Scan.id).label("scan_count"))
        .outerjoin(Scan, Scan.character_id == Character.id)
        .filter(Character.hunt_id == hunt_id)
        .group_by(Character.id, Character.name)
        .order_by(Character.sort_order)
        .all()
    )

    return {
        "total_sessions": total_sessions,
        "completion_rate": completion_rate,
        "character_stats": [
            {"name": name, "scan_count": scan_count}
            for name, scan_count in character_stats
        ],
    }


@router.get("/api/admin/hunts/{hunt_id}/print-qr-codes")
def print_hunt_qr_codes(hunt_id: str, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    """
    Generates a downloadable PDF with two sections: guest-facing signs
    (QR code + plain numeric index only, no spoiler content) meant to be
    printed/cut/posted in the park, and a staff-only reference sheet
    mapping each index to the character's name/hint/area.
    """
    query = db.query(Hunt).filter(Hunt.id == hunt_id)
    if admin.organization_id:
        query = query.filter(Hunt.organization_id == admin.organization_id)
    hunt = query.first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")

    characters = (
        db.query(Character)
        .filter(Character.hunt_id == hunt_id)
        .order_by(Character.sort_order)
        .all()
    )

    character_data = [
        {
            "name": character.name,
            "hint": character.hint,
            "area": character.area,
            "qr_code_value": character.qr_code_value,
        }
        for character in characters
    ]

    pdf_bytes = build_qr_code_pdf(hunt.name, character_data)
    filename = f"{safe_filename_stem(hunt.name)}_qr_codes.pdf"

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
