from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.academic_import_batch import AcademicImportBatch


def create_batch(db: Session, values: dict) -> AcademicImportBatch:
    batch = AcademicImportBatch(**values)
    db.add(batch)
    db.flush()
    return batch


def update_batch(db: Session, batch: AcademicImportBatch, values: dict) -> AcademicImportBatch:
    for key, value in values.items():
        setattr(batch, key, value)
    db.flush()
    return batch


def get_batch(db: Session, batch_id: UUID) -> AcademicImportBatch | None:
    return db.get(AcademicImportBatch, batch_id)


def list_batches(db: Session, limit: int = 20) -> list[AcademicImportBatch]:
    stmt = select(AcademicImportBatch).order_by(AcademicImportBatch.imported_at.desc()).limit(limit)
    return list(db.scalars(stmt).all())
