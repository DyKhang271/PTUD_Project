from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, SmallInteger, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("room_code", name="uq_rooms_room_code"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    room_code: Mapped[str] = mapped_column(Text, nullable=False)
    room_name: Mapped[str | None] = mapped_column(Text)
    capacity: Mapped[int | None] = mapped_column(Integer)
    room_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="theory")
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")


class TeacherAvailability(Base):
    __tablename__ = "teacher_availability"
    __table_args__ = (
        Index("ix_teacher_availability_teacher_term", "teacher_external_id", "term_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    teacher_external_id: Mapped[str] = mapped_column(Text, nullable=False)
    term_id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("academic_terms.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    start_period: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    end_period: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    availability_type: Mapped[str] = mapped_column(Text, nullable=False, server_default="available")
    note: Mapped[str | None] = mapped_column(Text)


class SectionSchedulingRequirement(Base):
    __tablename__ = "section_scheduling_requirements"
    __table_args__ = (UniqueConstraint("section_id", name="uq_section_scheduling_requirements_section_id"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    section_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=False
    )
    required_room_type: Mapped[str | None] = mapped_column(Text)
    expected_students: Mapped[int | None] = mapped_column(Integer)
    sessions_per_week: Mapped[int | None] = mapped_column(Integer)
    periods_per_session: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(Text)
