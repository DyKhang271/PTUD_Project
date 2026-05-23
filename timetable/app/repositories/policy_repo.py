from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.policy import AttendancePolicy


def _apply_updates(model: object, values: dict) -> None:
    for key, value in values.items():
        setattr(model, key, value)


def create_policy(db: Session, values: dict) -> AttendancePolicy:
    policy = AttendancePolicy(**values)
    db.add(policy)
    db.flush()
    return policy


def list_policies(db: Session) -> list[AttendancePolicy]:
    return list(db.scalars(select(AttendancePolicy).order_by(AttendancePolicy.scope_type, AttendancePolicy.scope_id)))


def get_policy(db: Session, policy_id: UUID) -> AttendancePolicy | None:
    return db.get(AttendancePolicy, policy_id)


def update_policy(db: Session, policy: AttendancePolicy, values: dict) -> AttendancePolicy:
    _apply_updates(policy, values)
    db.flush()
    return policy


def delete_policy(db: Session, policy: AttendancePolicy) -> None:
    db.delete(policy)
    db.flush()


def resolve_policy(db: Session, *, section_id: UUID | None = None, course_code: str | None = None, faculty: str | None = None) -> AttendancePolicy | None:
    scopes: list[tuple[str, str | None]] = []
    if section_id:
        scopes.append(("section", str(section_id)))
    if course_code:
        scopes.append(("course", course_code))
    if faculty:
        scopes.append(("faculty", faculty))
    scopes.append(("global", None))

    for scope_type, scope_id in scopes:
        stmt = select(AttendancePolicy).where(AttendancePolicy.scope_type == scope_type)
        if scope_id is None:
            stmt = stmt.where(AttendancePolicy.scope_id.is_(None))
        else:
            stmt = stmt.where(AttendancePolicy.scope_id == scope_id)
        policy = db.scalar(stmt)
        if policy:
            return policy
    return None
