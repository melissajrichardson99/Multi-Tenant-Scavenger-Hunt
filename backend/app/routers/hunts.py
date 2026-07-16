from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from ..database import get_db
from ..models import Organization, Hunt, Character, PlayerSession, Scan

router = APIRouter(tags=["Hunts"])

# Public Endpoint
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
        db.query(Character).filter(Character.hunt_id == hunt.id).count()
    )

    return {
        "hunt_id": str(hunt.id),
        "name": hunt.name,
        "organization": {
            "name": organization.name,
            "theme_primary": organization.theme_primary,
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
def get_admin_hunts(db: Session = Depends(get_db)):
    hunts = db.query(Hunt).order_by(Hunt.created_at.desc()).all()
    return [_serialize_hunt(hunt) for hunt in hunts]

@router.post("/api/admin/hunts")
def create_admin_hunt(payload: dict, db: Session = Depends(get_db)):
    organization_id = payload.get("organization_id")
    name = payload.get("name")
    if not organization_id:
        raise HTTPException(status_code=400, detail="organization_id is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

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
def update_admin_hunt(payload: dict, db: Session = Depends(get_db)):
    hunt_id = payload.get("id")
    if not hunt_id:
        raise HTTPException(status_code=400, detail="id is required")

    hunt = db.query(Hunt).filter(Hunt.id == hunt_id).first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")

    for field in ("name", "description", "is_active", "start_date", "end_date"):
        if field in payload:
            setattr(hunt, field, payload[field])

    db.commit()
    db.refresh(hunt)

    return _serialize_hunt(hunt)

@router.get("/api/admin/hunts/{hunt_id}/stats")
def get_hunt_stats(hunt_id: str, db: Session = Depends(get_db)):
    hunt = db.query(Hunt).filter(Hunt.id == hunt_id).first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")

    total_sessions = (
        db.query(func.count(PlayerSession.id))
        .filter(PlayerSession.hunt_id == hunt_id)
        .scalar()
    )

    total_characters = (
        db.query(func.count(Character.id))
        .filter(Character.hunt_id == hunt_id)
        .scalar()
    )

    completion_rate = 0.0
    if total_sessions and total_characters:
        completed_sessions = (
            db.query(Scan.session_id)
            .join(PlayerSession, Scan.session_id == PlayerSession.id)
            .filter(PlayerSession.hunt_id == hunt_id)
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
