from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from ..database import get_db
from ..models import PlayerSession, Character, Scan

router = APIRouter(prefix="/api/progress", tags=["Progress"])


@router.get("/{device_token}")
def get_progress(device_token: str, db: DBSession = Depends(get_db)):
    session = (
        db.query(PlayerSession)
        .filter(PlayerSession.device_token == device_token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    characters = (
        db.query(Character)
        .filter(Character.hunt_id == session.hunt_id)
        .order_by(Character.sort_order)
        .all()
    )

    found_character_ids = {
        row.character_id
        for row in db.query(Scan.character_id).filter(Scan.session_id == session.id).all()
    }

    character_list = [
        {
            "id": str(character.id),
            "name": character.name if character.id in found_character_ids else "???",
            "found": character.id in found_character_ids,
            "image_url": character.image_url if character.id in found_character_ids else None,
            "sort_order": character.sort_order,
            "hint": None if character.id in found_character_ids else character.hint,
            "area": None if character.id in found_character_ids else character.area,
            "has_trivia": bool(character.trivia_question) if character.id in found_character_ids else False,
        }
        for character in characters
    ]

    return {
        "total_found": len(found_character_ids),
        "total_characters": len(characters),
        "characters": character_list,
    }
