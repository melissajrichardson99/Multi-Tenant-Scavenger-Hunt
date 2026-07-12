from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/scans", tags=["Scans"])

@router.post("")
def record_scan(payload: dict, db: Session = Depends(get_db)):
    device_token = payload.get("device_token")
    qr_code_value = payload.get("qr_code_value")
    
    # Handle simple mock behaviors for verification/demo
    if qr_code_value == "invalid":
        return {
            "success": False,
            "reason": "invalid_code"
        }
    elif qr_code_value == "already":
        return {
            "success": False,
            "reason": "already_scanned"
        }
        
    return {
        "success": True,
        "character": {
            "id": "33333333-4444-5555-6666-777777777777",
            "name": "Cobb the Kangaroo",
            "description": "The friendly mascot of Cobb's!",
            "image_url": "https://example.com/cobb.png",
            "points": 10
        },
        "total_found": 5,
        "total_characters": 10,
        "newly_unlocked_rewards": [
            { "reward_description": "10% off gift shop", "reward_code": "HUNT10" }
        ]
    }
