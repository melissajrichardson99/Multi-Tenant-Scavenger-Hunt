from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/admin", tags=["Admin Auth & Management"])

@router.post("/login")
def admin_login(payload: dict, db: Session = Depends(get_db)):
    # Returns mock token
    return {
        "access_token": "mock-admin-session-token-12345",
        "token_type": "bearer"
    }

@router.post("/reward-tiers")
def create_reward_tier(payload: dict, db: Session = Depends(get_db)):
    return {
        "id": "66666666-7777-8888-9999-000000000000",
        "hunt_id": payload.get("hunt_id"),
        "threshold_type": payload.get("threshold_type"),
        "threshold_value": payload.get("threshold_value"),
        "reward_description": payload.get("reward_description"),
        "reward_code": payload.get("reward_code")
    }
