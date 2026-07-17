import os
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from .database import get_db
from .models import AdminUser

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

JWT_ALGORITHM = "HS256"
JWT_EXPIRY_HOURS = 24

# Dev-only fallback so the app doesn't crash if JWT_SECRET_KEY isn't set yet.
# Set a real JWT_SECRET_KEY in .env before deploying anywhere non-local.
JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY") or "dev-only-insecure-secret-change-me"

bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(admin_user: AdminUser) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRY_HOURS)
    payload = {
        "sub": str(admin_user.id),
        "organization_id": str(admin_user.organization_id) if admin_user.organization_id else None,
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def get_current_admin(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> AdminUser:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None:
        raise unauthorized

    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except jwt.PyJWTError:
        raise unauthorized

    admin_id = payload.get("sub")
    if not admin_id:
        raise unauthorized

    admin_user = db.query(AdminUser).filter(AdminUser.id == admin_id).first()
    if not admin_user:
        raise unauthorized

    return admin_user
