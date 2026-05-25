from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime
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


def _get_portal_jwt_verification_key() -> str:
    settings = get_settings()
    if settings.portal_jwt_algorithm.upper().startswith("RS"):
        if not settings.portal_jwt_public_key:
            raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Portal JWT public key is missing")
        return settings.portal_jwt_public_key
    return settings.portal_jwt_secret


def decode_portal_access_token(token: str) -> dict[str, Any]:
    settings = get_settings()
    try:
        payload = jwt.decode(
            token,
            _get_portal_jwt_verification_key(),
            algorithms=[settings.portal_jwt_algorithm],
            issuer=settings.portal_jwt_issuer,
        )
        if payload.get("type") and payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token type")
        return payload
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Access token has expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc
