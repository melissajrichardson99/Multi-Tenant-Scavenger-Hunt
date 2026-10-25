import secrets
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func
from ..database import get_db
from ..models import PlayerSession, Hunt, Character, Scan

router = APIRouter(prefix="/api/sessions", tags=["Sessions"])


@router.post("")
def create_session(payload: dict, db: DBSession = Depends(get_db)):
    """Create a new anonymous player session for a given hunt."""
    hunt_id = payload.get("hunt_id")
    if not hunt_id:
        raise HTTPException(status_code=400, detail="hunt_id is required")

    # Verify the hunt exists and is currently running
    hunt = db.query(Hunt).filter(Hunt.id == hunt_id).first()
    if not hunt:
        raise HTTPException(status_code=404, detail="Hunt not found")
    if not hunt.is_active:
        raise HTTPException(status_code=403, detail="This hunt is not currently active")

    # Generate a cryptographically secure device token
    device_token = secrets.token_hex(24)

    # Persist the session
    session = PlayerSession(
        hunt_id=hunt_id,
        device_token=device_token,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return {
        "session_id": str(session.id),
        "device_token": session.device_token,
    }


@router.get("/{device_token}")
def get_session(device_token: str, db: DBSession = Depends(get_db)):
    """Resume an existing session — look up by device_token."""
    session = (
        db.query(PlayerSession)
        .filter(PlayerSession.device_token == device_token)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Secret characters never count toward either total (same rule as
    # progress.py and scans.py), so these numbers always match the gallery.
    total_characters = (
        db.query(func.count(Character.id))
        .filter(Character.hunt_id == session.hunt_id, Character.is_secret == False)
        .scalar()
    )

    # Characters this session has already scanned (secret ones included)
    scanned = (
        db.query(Scan.character_id, Character.is_secret)
        .join(Character, Scan.character_id == Character.id)
        .filter(Scan.session_id == session.id)
        .all()
    )
    found_character_ids = [str(row.character_id) for row in scanned]
    total_found = sum(1 for row in scanned if not row.is_secret)

    return {
        "session_id": str(session.id),
        "hunt_id": str(session.hunt_id),
        "total_found": total_found,
        "total_characters": total_characters,
        "found_character_ids": found_character_ids,
    }
