from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AdminUser, Organization
from ..auth import verify_password, create_access_token, get_current_admin, hash_password

router = APIRouter(prefix="/api/admin", tags=["Admin Auth & Management"])

MIN_PASSWORD_LENGTH = 8

@router.post("/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    email = payload.get("email")
    password = payload.get("password")
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")

    admin_user = db.query(AdminUser).filter(AdminUser.email == email).first()
    if not admin_user or not verify_password(password, admin_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    access_token = create_access_token(admin_user)
    return {
        "access_token": access_token,
        "token_type": "bearer"
    }

def _serialize_admin_user(admin_user: AdminUser, org_names: dict) -> dict:
    return {
        "id": str(admin_user.id),
        "email": admin_user.email,
        "organization_id": str(admin_user.organization_id) if admin_user.organization_id else None,
        "organization_name": org_names.get(admin_user.organization_id, "Super Admin") if admin_user.organization_id else "Super Admin",
    }

@router.get("/admin-users")
def get_admin_users(db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    # Only super-admins (organization_id is None) may view the admin roster.
    if admin.organization_id:
        raise HTTPException(status_code=403, detail="Only super-admins can view admin accounts")

    admin_users = db.query(AdminUser).order_by(AdminUser.email).all()
    org_names = {org.id: org.name for org in db.query(Organization).all()}
    return [_serialize_admin_user(a, org_names) for a in admin_users]

@router.post("/admin-users")
def create_admin_user(payload: dict, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    # Only super-admins (organization_id is None) may create new admin accounts.
    if admin.organization_id:
        raise HTTPException(status_code=403, detail="Only super-admins can create admin accounts")

    email = payload.get("email")
    password = payload.get("password")
    organization_id = payload.get("organization_id") or None
    if not email or not password:
        raise HTTPException(status_code=400, detail="email and password are required")
    if len(password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"password must be at least {MIN_PASSWORD_LENGTH} characters")

    existing = db.query(AdminUser).filter(AdminUser.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="An admin with this email already exists")

    if organization_id:
        org = db.query(Organization).filter(Organization.id == organization_id).first()
        if not org:
            raise HTTPException(status_code=400, detail="Organization not found")

    admin_user = AdminUser(
        email=email,
        password_hash=hash_password(password),
        organization_id=organization_id,
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)

    org_names = {admin_user.organization_id: org.name} if organization_id else {}
    return _serialize_admin_user(admin_user, org_names)

@router.post("/reward-tiers")
def create_reward_tier(payload: dict, db: Session = Depends(get_db), admin: AdminUser = Depends(get_current_admin)):
    return {
        "id": "66666666-7777-8888-9999-000000000000",
        "hunt_id": payload.get("hunt_id"),
        "threshold_type": payload.get("threshold_type"),
        "threshold_value": payload.get("threshold_value"),
        "reward_description": payload.get("reward_description"),
        "reward_code": payload.get("reward_code")
    }
