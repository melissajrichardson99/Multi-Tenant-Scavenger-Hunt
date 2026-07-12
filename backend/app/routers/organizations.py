from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/admin/organizations", tags=["Admin Organizations"])

@router.get("")
def get_organizations(db: Session = Depends(get_db)):
    # Placeholder return
    return [
        {
            "id": "11111111-2222-3333-4444-555555555555",
            "name": "Cobb's Adventure Park",
            "slug": "cobbs",
            "theme_primary": "#000000",
            "theme_secondary": "#ffffff",
            "logo_url": "https://example.com/cobbs-logo.png"
        }
    ]

@router.post("")
def create_organization(payload: dict, db: Session = Depends(get_db)):
    # Placeholder return
    return {
        "id": "11111111-2222-3333-4444-555555555555",
        "name": payload.get("name", "New Organization"),
        "slug": payload.get("slug", "new-org"),
        "theme_primary": payload.get("theme_primary", "#000000"),
        "theme_secondary": payload.get("theme_secondary", "#ffffff"),
        "logo_url": payload.get("logo_url")
    }
