from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from fastapi import HTTPException, status

from app.core.config import get_settings


def utc_now() -> datetime:
    return datetime.now(UTC)


def hash_secret(value: str) -> str:
    settings = get_settings()
    return hmac.new(settings.secret_key.encode("utf-8"), value.encode("utf-8"), hashlib.sha256).hexdigest()


def verify_secret(value: str, hashed_value: str | None) -> bool:
    if not hashed_value:
        return False
    return hmac.compare_digest(hash_secret(value), hashed_value)


def generate_checkin_code() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_qr_token() -> str:
    return secrets.token_urlsafe(32)


def create_access_token(*, external_id: str, role: str, full_name: str | None = None) -> str:
    settings = get_settings()
    now = utc_now()
    payload: dict[str, Any] = {
        "sub": external_id,
        "role": role,
        "full_name": full_name,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.access_token_expire_minutes)).timestamp()),
    }
    return jwt.encode(payload, settings.secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc

