from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TeacherAssignment(Base):
    __tablename__ = "teacher_assignments"
    __table_args__ = (
        UniqueConstraint("section_id", "teacher_external_id", "assignment_type", name="uq_teacher_assignments_section_teacher_type"),
        Index("ix_teacher_assignments_teacher_external_id", "teacher_external_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    section_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=False
    )
    teacher_external_id: Mapped[str] = mapped_column(Text, nullable=False)
    teacher_full_name: Mapped[str | None] = mapped_column(Text)
    assignment_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="primary")
    source: Mapped[str] = mapped_column(Text, nullable=False, server_default="portal")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    assigned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
