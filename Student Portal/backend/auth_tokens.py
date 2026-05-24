from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import uuid4

import jwt

PASSWORD_HASH_PREFIX = "pbkdf2_sha256"


def utc_now() -> datetime:
    return datetime.now(UTC)


def _get_password_hash_iterations() -> int:
    return int(os.getenv("PASSWORD_HASH_ITERATIONS", "390000"))


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt,
        _get_password_hash_iterations(),
    )
    return (
        f"{PASSWORD_HASH_PREFIX}"
        f"${_get_password_hash_iterations()}"
        f"${base64.urlsafe_b64encode(salt).decode('ascii')}"
        f"${base64.urlsafe_b64encode(digest).decode('ascii')}"
    )


def is_password_hashed(value: str | None) -> bool:
    return str(value or "").startswith(f"{PASSWORD_HASH_PREFIX}$")


def verify_password(password: str, stored_value: str | None) -> bool:
    raw_value = str(stored_value or "")
    if not raw_value:
        return False

    if not is_password_hashed(raw_value):
        return secrets.compare_digest(raw_value, password)

    try:
        _, iterations, salt_b64, digest_b64 = raw_value.split("$", 3)
        salt = base64.urlsafe_b64decode(salt_b64.encode("ascii"))
        expected_digest = base64.urlsafe_b64decode(digest_b64.encode("ascii"))
        actual_digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            salt,
            int(iterations),
        )
    except (ValueError, TypeError):
        return False

    return hmac.compare_digest(actual_digest, expected_digest)


def _token_lifetime_minutes() -> int:
    raw_value = os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")
    if raw_value is None:
        raise RuntimeError("ACCESS_TOKEN_EXPIRE_MINUTES must be configured")
    return int(raw_value)


def _refresh_token_lifetime_days() -> int:
    raw_value = os.getenv("REFRESH_TOKEN_EXPIRE_DAYS")
    if raw_value is None:
        raise RuntimeError("REFRESH_TOKEN_EXPIRE_DAYS must be configured")
    return int(raw_value)


def get_jwt_secret() -> str:
    return os.getenv("PORTAL_JWT_SECRET", os.getenv("SECRET_KEY", "student-portal-dev-secret"))


def get_jwt_algorithm() -> str:
    return os.getenv("PORTAL_JWT_ALGORITHM", "HS256")


def get_jwt_issuer() -> str:
    return os.getenv("PORTAL_JWT_ISSUER", "student-portal")


def _build_token_payload(
    *,
    subject: str,
    role: str,
    token_type: str,
    lifetime: timedelta,
    user_claims: dict[str, Any] | None = None,
) -> dict[str, Any]:
    now = utc_now()
    payload: dict[str, Any] = {
        "sub": subject,
        "role": role,
        "iss": get_jwt_issuer(),
        "iat": int(now.timestamp()),
        "exp": int((now + lifetime).timestamp()),
        "jti": str(uuid4()),
        "type": token_type,
    }
    for key, value in (user_claims or {}).items():
        if value is not None:
            payload[key] = value
    return payload


def create_access_token(*, subject: str, role: str, user_claims: dict[str, Any] | None = None) -> str:
    payload = _build_token_payload(
        subject=subject,
        role=role,
        token_type="access",
        lifetime=timedelta(minutes=_token_lifetime_minutes()),
        user_claims=user_claims,
    )
    return jwt.encode(payload, get_jwt_secret(), algorithm=get_jwt_algorithm())


def create_refresh_token(*, subject: str, role: str, user_claims: dict[str, Any] | None = None) -> str:
    payload = _build_token_payload(
        subject=subject,
        role=role,
        token_type="refresh",
        lifetime=timedelta(days=_refresh_token_lifetime_days()),
        user_claims=user_claims,
    )
    return jwt.encode(payload, get_jwt_secret(), algorithm=get_jwt_algorithm())


def decode_token(token: str, *, expected_type: str | None = None) -> dict[str, Any]:
    payload = jwt.decode(
        token,
        get_jwt_secret(),
        algorithms=[get_jwt_algorithm()],
        issuer=get_jwt_issuer(),
    )
    if expected_type and payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"Unexpected token type: {payload.get('type')}")
    return payload
