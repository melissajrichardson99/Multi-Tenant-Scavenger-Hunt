from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from ..database import get_db

router = APIRouter(prefix="/api/admin/characters", tags=["Admin Characters"])

@router.get("")
def get_admin_characters(hunt_id: str = None, db: Session = Depends(get_db)):
    return [
        {
            "id": "33333333-4444-5555-6666-777777777777",
            "hunt_id": hunt_id or "22222222-3333-4444-5555-666666666666",
            "name": "Cobb the Kangaroo",
            "description": "The friendly mascot of Cobb's!",
            "image_url": "https://example.com/cobb.png",
            "points": 10,
            "qr_code_value": "char_cobb_2026",
            "sort_order": 1
        }
    ]

@router.post("")
def create_admin_character(payload: dict, db: Session = Depends(get_db)):
    return {
        "id": "33333333-4444-5555-6666-777777777777",
        "hunt_id": payload.get("hunt_id"),
        "name": payload.get("name"),
        "description": payload.get("description"),
        "image_url": payload.get("image_url"),
        "points": payload.get("points", 10),
        "qr_code_value": payload.get("qr_code_value", "generated_qr_value"),
        "sort_order": payload.get("sort_order", 0)
    }

@router.patch("")
def update_admin_character(payload: dict, db: Session = Depends(get_db)):
    return {
        "id": payload.get("id"),
        "name": payload.get("name"),
        "description": payload.get("description"),
        "image_url": payload.get("image_url"),
        "points": payload.get("points"),
        "sort_order": payload.get("sort_order")
    }

@router.delete("")
def delete_admin_character(character_id: str, db: Session = Depends(get_db)):
    return {"success": True, "deleted_id": character_id}
