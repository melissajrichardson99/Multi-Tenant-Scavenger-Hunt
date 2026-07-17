from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import AdminUser
from ..auth import verify_password, create_access_token, get_current_admin

router = APIRouter(prefix="/api/admin", tags=["Admin Auth & Management"])

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
