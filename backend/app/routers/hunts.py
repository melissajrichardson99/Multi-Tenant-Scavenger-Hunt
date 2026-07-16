from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import Organization, Hunt, Character

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
@router.get("/api/admin/hunts")
def get_admin_hunts(db: Session = Depends(get_db)):
    return [
        {
            "id": "22222222-3333-4444-5555-666666666666",
            "organization_id": "11111111-2222-3333-4444-555555555555",
            "name": "Cobb's Summer Hunt 2026",
            "description": "Find hidden characters around the park!",
            "is_active": True,
            "start_date": "2026-06-01T00:00:00Z",
            "end_date": "2026-09-01T00:00:00Z"
        }
    ]

@router.post("/api/admin/hunts")
def create_admin_hunt(payload: dict, db: Session = Depends(get_db)):
    return {
        "id": "22222222-3333-4444-5555-666666666666",
        "organization_id": payload.get("organization_id"),
        "name": payload.get("name"),
        "description": payload.get("description"),
        "is_active": payload.get("is_active", True),
        "start_date": payload.get("start_date"),
        "end_date": payload.get("end_date")
    }

@router.patch("/api/admin/hunts")
def update_admin_hunt(payload: dict, db: Session = Depends(get_db)):
    return {
        "id": payload.get("id", "22222222-3333-4444-5555-666666666666"),
        "name": payload.get("name", "Updated Hunt Name"),
        "description": payload.get("description", "Updated description"),
        "is_active": payload.get("is_active", True)
    }

@router.get("/api/admin/hunts/{hunt_id}/stats")
def get_hunt_stats(hunt_id: str, db: Session = Depends(get_db)):
    return {
        "total_sessions": 342,
        "completion_rate": 0.28,
        "character_stats": [
            { "name": "Cobb the Kangaroo", "scan_count": 310 },
            { "name": "Billy the Goat", "scan_count": 88 }
        ]
    }
