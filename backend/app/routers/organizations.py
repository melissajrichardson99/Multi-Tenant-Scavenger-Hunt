from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AdminUser, Organization
from ..auth import get_current_admin

router = APIRouter(prefix="/api/admin/organizations", tags=["Admin Organizations"])

def _serialize_organization(org: Organization) -> dict:
    return {
        "id": str(org.id),
        "name": org.name,
        "slug": org.slug,
        "theme_primary": org.theme_primary,
        "theme_secondary": org.theme_secondary,
        "theme_mode": org.theme_mode,
        "logo_url": org.logo_url,
    }

@router.get("")
def get_organizations(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    query = db.query(Organization)
    if admin.organization_id:
        query = query.filter(Organization.id == admin.organization_id)
    organizations = query.order_by(Organization.name).all()
    return [_serialize_organization(org) for org in organizations]

@router.post("")
def create_organization(payload: dict, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    # Only super-admins (organization_id is None) may create new organizations.
    if admin.organization_id:
        raise HTTPException(status_code=403, detail="Only super-admins can create organizations")

    name = payload.get("name")
    slug = payload.get("slug")
    if not name or not slug:
        raise HTTPException(status_code=400, detail="name and slug are required")

    organization = Organization(
        name=name,
        slug=slug,
        theme_primary=payload.get("theme_primary", "#000000"),
        theme_secondary=payload.get("theme_secondary", "#ffffff"),
        theme_mode=payload.get("theme_mode", "dark"),
        logo_url=payload.get("logo_url"),
    )
    db.add(organization)
    db.commit()
    db.refresh(organization)

    return _serialize_organization(organization)

@router.patch("")
def update_organization(payload: dict, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    org_id = payload.get("id")
    if not org_id:
        raise HTTPException(status_code=400, detail="id is required")

    query = db.query(Organization).filter(Organization.id == org_id)
    if admin.organization_id:
        query = query.filter(Organization.id == admin.organization_id)
    organization = query.first()
    if not organization:
        raise HTTPException(status_code=404, detail="Organization not found")

    for field in ("name", "slug", "theme_primary", "theme_secondary", "theme_mode", "logo_url"):
        if field in payload:
            setattr(organization, field, payload[field])

    db.commit()
    db.refresh(organization)

    return _serialize_organization(organization)
