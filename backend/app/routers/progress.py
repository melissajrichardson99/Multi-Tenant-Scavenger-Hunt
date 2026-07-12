from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/progress", tags=["Progress"])

@router.get("/{device_token}")
def get_progress(device_token: str, db: Session = Depends(get_db)):
    return {
        "total_found": 1,
        "total_characters": 2,
        "characters": [
            {
                "id": "33333333-4444-5555-6666-777777777777",
                "name": "Cobb the Kangaroo",
                "found": True,
                "image_url": "https://example.com/cobb.png"
            },
            {
                "id": "55555555-6666-7777-8888-999999999999",
                "name": "???",
                "found": False,
                "image_url": None
            }
        ]
    }
