from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])

@router.post("")
def create_session(payload: dict, response: Response, db: Session = Depends(get_db)):
    hunt_id = payload.get("hunt_id")
    if not hunt_id:
        raise HTTPException(status_code=400, detail="hunt_id is required")
    
    # Generate mock session details
    mock_session_id = "44444444-5555-6666-7777-888888888888"
    mock_device_token = "mock-device-token-abc123xyz"
    
    # In a real implementation we might set a cookie
    response.set_cookie(
        key="device_token",
        value=mock_device_token,
        httponly=True,
        samesite="lax",
        max_age=31536000  # 1 year
    )
    
    return {
        "session_id": mock_session_id,
        "device_token": mock_device_token
    }

@router.get("/{device_token}")
def get_session(device_token: str, db: Session = Depends(get_db)):
    if device_token != "mock-device-token-abc123xyz":
        # Raise standard mock response or create on the fly, but let's return a default mock
        pass
    
    return {
        "session_id": "44444444-5555-6666-7777-888888888888",
        "total_found": 4,
        "total_characters": 10,
        "found_character_ids": [
            "33333333-4444-5555-6666-777777777777"
        ]
    }
