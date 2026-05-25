from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Integer, JSON, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AcademicImportBatch(Base):
    __tablename__ = "academic_import_batches"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="student_portal")
    term_code: Mapped[str] = mapped_column(Text, nullable=False)
    program_name: Mapped[str | None] = mapped_column(Text)
    cohort: Mapped[str | None] = mapped_column(Text)
    curriculum_semester: Mapped[int] = mapped_column(Integer, nullable=False)
    imported_by: Mapped[str | None] = mapped_column(Text)
    imported_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="failed")
    section_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    teacher_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    warnings_json: Mapped[list | None] = mapped_column(JSON)
    source_payload_snapshot_json: Mapped[dict | None] = mapped_column(JSON)
    error_message: Mapped[str | None] = mapped_column(Text)
