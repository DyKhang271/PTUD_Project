from __future__ import annotations

from datetime import datetime

from sqlalchemy import or_, select
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


def search_cached_users(
    db: Session,
    *,
    role: str | None = None,
    q: str | None = None,
    faculty: str | None = None,
    limit: int = 50,
) -> list[ExternalUserCache]:
    stmt = select(ExternalUserCache)
    if role:
        stmt = stmt.where(ExternalUserCache.role == role)
    if faculty:
        stmt = stmt.where(ExternalUserCache.faculty == faculty)
    normalized_q = str(q or "").strip()
    if normalized_q:
        like_pattern = f"%{normalized_q}%"
        stmt = stmt.where(
            or_(
                ExternalUserCache.external_user_id.ilike(like_pattern),
                ExternalUserCache.full_name.ilike(like_pattern),
                ExternalUserCache.email.ilike(like_pattern),
                ExternalUserCache.faculty.ilike(like_pattern),
            )
        )
    stmt = stmt.order_by(ExternalUserCache.full_name.nullslast(), ExternalUserCache.external_user_id).limit(max(limit, 1))
    return list(db.scalars(stmt).all())
