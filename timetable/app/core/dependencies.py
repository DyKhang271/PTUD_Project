from __future__ import annotations

from dataclasses import dataclass
from typing import Annotated, Callable
from uuid import UUID

from fastapi import Depends, HTTPException, Path, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.course_section import CourseSection

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


@dataclass(frozen=True)
class CurrentUser:
    external_id: str
    role: str
    full_name: str | None = None


def get_current_user(token: Annotated[str, Depends(oauth2_scheme)]) -> CurrentUser:
    payload = decode_access_token(token)
    external_id = payload.get("sub")
    role = payload.get("role")
    if not external_id or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token payload")
    return CurrentUser(external_id=str(external_id), role=str(role), full_name=payload.get("full_name"))


def require_role(allowed_roles: list[str]) -> Callable[[CurrentUser], CurrentUser]:
    def dependency(current_user: Annotated[CurrentUser, Depends(get_current_user)]) -> CurrentUser:
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return dependency


def ensure_teacher_owns_section(
    section_id: Annotated[UUID, Path()],
    current_user: Annotated[CurrentUser, Depends(require_role(["teacher", "admin"]))],
    db: Annotated[Session, Depends(get_db)],
) -> CourseSection:
    section = db.scalar(select(CourseSection).where(CourseSection.id == section_id))
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course section not found")
    if current_user.role != "admin" and section.teacher_external_id != current_user.external_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher does not own this section")
    return section
