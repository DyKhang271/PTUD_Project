from __future__ import annotations

from datetime import datetime

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.repositories.external_user_repo import upsert_external_user
from app.schemas.auth_schema import AuthUser, ExternalLoginResponse
from app.services.core_api_client import CoreApiClient


def external_login(db: Session, external_token: str) -> ExternalLoginResponse:
    verified_user = CoreApiClient().verify_token(external_token)
    source_updated_at = verified_user.get("source_updated_at")
    parsed_source_updated_at = None
    if isinstance(source_updated_at, str):
        parsed_source_updated_at = datetime.fromisoformat(source_updated_at.replace("Z", "+00:00"))

    user = upsert_external_user(
        db,
        external_user_id=verified_user["external_user_id"],
        role=verified_user["role"],
        full_name=verified_user.get("full_name"),
        email=verified_user.get("email"),
        class_name=verified_user.get("class_name"),
        faculty=verified_user.get("faculty"),
        program_name=verified_user.get("program_name"),
        source_updated_at=parsed_source_updated_at,
    )
    access_token = create_access_token(external_id=user.external_user_id, role=user.role, full_name=user.full_name)
    db.commit()
    return ExternalLoginResponse(
        access_token=access_token,
        user=AuthUser(external_id=user.external_user_id, role=user.role, full_name=user.full_name),
    )


def login_with_credentials(db: Session, role: str, username: str, password: str) -> ExternalLoginResponse:
    normalized_role = role.strip().lower()
    normalized_username = username.strip()
    if normalized_role not in {"student", "teacher", "admin"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported login role")
    if not normalized_username or not password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Username and password are required")

    client = CoreApiClient()
    if normalized_role == "student":
        payload = client.login_student(normalized_username, password)
        external_id = (
            (payload.get("student") or {}).get("mssv")
            or (payload.get("student") or {}).get("student_id")
            or normalized_username
        )
    elif normalized_role == "teacher":
        payload = client.login_teacher(normalized_username, password)
        external_id = (
            (payload.get("teacher") or {}).get("username")
            or (payload.get("teacher") or {}).get("teacher_id")
            or normalized_username
        )
    else:
        payload = client.login_admin(normalized_username, password)
        external_id = (
            (payload.get("admin") or {}).get("username")
            or (payload.get("admin") or {}).get("admin_id")
            or normalized_username
        )

    if not payload.get("success"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(payload.get("message") or "Invalid credentials"),
        )

    return external_login(db, f"{normalized_role}:{external_id}")
