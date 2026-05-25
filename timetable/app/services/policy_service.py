from __future__ import annotations

from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import policy_repo


def create_policy(db: Session, values: dict):
    policy = policy_repo.create_policy(db, values)
    db.commit()
    return policy


def update_policy(db: Session, policy_id: UUID, values: dict):
    policy = policy_repo.get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance policy not found")
    updated = policy_repo.update_policy(db, policy, values)
    db.commit()
    return updated


def delete_policy(db: Session, policy_id: UUID) -> None:
    policy = policy_repo.get_policy(db, policy_id)
    if policy is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance policy not found")
    policy_repo.delete_policy(db, policy)
    db.commit()
