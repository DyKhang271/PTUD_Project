from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.external_user import ExternalUserCache


def upsert_external_user(
    db: Session,
    *,
    external_user_id: str,
    role: str,
    full_name: str | None = None,
    email: str | None = None,
    class_name: str | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    source_updated_at: datetime | None = None,
) -> ExternalUserCache:
    user = db.scalar(
        select(ExternalUserCache).where(
            ExternalUserCache.external_user_id == external_user_id,
            ExternalUserCache.role == role,
        )
    )
    if user is None:
        user = ExternalUserCache(external_user_id=external_user_id, role=role)
        db.add(user)

    user.full_name = full_name or user.full_name
    user.email = email or user.email
    user.class_name = class_name or user.class_name
    user.faculty = faculty or user.faculty
    user.program_name = program_name or user.program_name
    user.source_updated_at = source_updated_at or user.source_updated_at
    db.flush()
    return user


def get_cached_user(db: Session, external_user_id: str, role: str | None = None) -> ExternalUserCache | None:
    stmt = select(ExternalUserCache).where(ExternalUserCache.external_user_id == external_user_id)
    if role:
        stmt = stmt.where(ExternalUserCache.role == role)
    return db.scalar(stmt)


def get_cached_users(db: Session, external_user_ids: list[str], role: str | None = None) -> dict[str, ExternalUserCache]:
    if not external_user_ids:
        return {}
    stmt = select(ExternalUserCache).where(ExternalUserCache.external_user_id.in_(external_user_ids))
    if role:
        stmt = stmt.where(ExternalUserCache.role == role)
    return {user.external_user_id: user for user in db.scalars(stmt).all()}

