from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func, and_, or_
from sqlalchemy.exc import IntegrityError
from ..database import get_db
from ..models import PlayerSession, Character, Scan, RewardTier
from ..qr_codes import normalize_code

router = APIRouter(prefix="/api/scans", tags=["Scans"])


@router.post("")
def record_scan(payload: dict, db: DBSession = Depends(get_db)):
    device_token = payload.get("device_token")
    qr_code_value = payload.get("qr_code_value")

    if not device_token:
        raise HTTPException(status_code=400, detail="device_token is required")
    if not qr_code_value:
        raise HTTPException(status_code=400, detail="qr_code_value is required")

    session = (
        db.query(PlayerSession)
        .filter(PlayerSession.device_token == device_token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    normalized_code = normalize_code(qr_code_value)
    character = (
        db.query(Character)
        .filter(
            func.upper(func.replace(Character.qr_code_value, "-", "")) == normalized_code,
            Character.hunt_id == session.hunt_id,
        )
        .first()
    )
    if not character:
        return {"success": False, "reason": "invalid_code"}

    existing_scan = (
        db.query(Scan)
        .filter(Scan.session_id == session.id, Scan.character_id == character.id)
        .first()
    )
    if existing_scan:
        return {"success": False, "reason": "already_scanned"}

    scan = Scan(session_id=session.id, character_id=character.id)
    db.add(scan)
    try:
        db.commit()
    except IntegrityError:
        # Concurrent duplicate submission raced us past the check above.
        db.rollback()
        return {"success": False, "reason": "already_scanned"}

    # Secret characters never count toward the total or the found count —
    # finding all of them should never be required for 100% completion.
    total_characters = (
        db.query(func.count(Character.id))
        .filter(Character.hunt_id == session.hunt_id, Character.is_secret == False)
        .scalar()
    )
    total_found = (
        db.query(func.count(Scan.id))
        .join(Character, Scan.character_id == Character.id)
        .filter(Scan.session_id == session.id, Character.is_secret == False)
        .scalar()
    )

    newly_unlocked_rewards = []
    if total_characters and total_found == total_characters:
        tiers = (
            db.query(RewardTier)
            .filter(
                RewardTier.hunt_id == session.hunt_id,
                or_(
                    and_(RewardTier.threshold_type == "percentage", RewardTier.threshold_value == 100),
                    and_(RewardTier.threshold_type == "count", RewardTier.threshold_value == total_characters),
                ),
            )
            .all()
        )
        newly_unlocked_rewards = [
            {"reward_description": tier.reward_description, "reward_code": tier.reward_code}
            for tier in tiers
        ]

    return {
        "success": True,
        "character": {
            "id": str(character.id),
            "name": character.name,
            "description": character.description,
            "image_url": character.image_url,
            "points": character.points,
            "has_trivia": bool(character.trivia_question),
        },
        "total_found": total_found,
        "total_characters": total_characters,
        "newly_unlocked_rewards": newly_unlocked_rewards,
    }
