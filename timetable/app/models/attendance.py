from __future__ import annotations

from datetime import date, datetime, time
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, ForeignKey, Index, Text, Time, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AttendanceSession(Base):
    __tablename__ = "attendance_sessions"
    __table_args__ = (
        UniqueConstraint("section_id", "session_date", "start_time", name="uq_attendance_sessions_section_date_start"),
        UniqueConstraint("timetable_entry_id", "session_date", name="uq_attendance_sessions_timetable_entry_date"),
        Index("ix_attendance_sessions_section_date", "section_id", "session_date"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    section_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=False
    )
    timetable_entry_id: Mapped[UUID | None] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("timetable_entries.id", ondelete="SET NULL")
    )
    session_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time | None] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="draft")
    qr_token_hash: Mapped[str | None] = mapped_column(Text)
    checkin_code_hash: Mapped[str | None] = mapped_column(Text)
    checkin_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by_external_id: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    note: Mapped[str | None] = mapped_column(Text)

    section = relationship("CourseSection", back_populates="attendance_sessions")
    timetable_entry = relationship("TimetableEntry", back_populates="attendance_sessions")
    records = relationship("AttendanceRecord", back_populates="session", cascade="all, delete-orphan")


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (
        UniqueConstraint("session_id", "student_external_id", name="uq_attendance_records_session_student"),
        Index("ix_attendance_records_session_id", "session_id"),
        Index("ix_attendance_records_student_external_id", "student_external_id"),
        Index("ix_attendance_records_status", "status"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    session_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("attendance_sessions.id", ondelete="CASCADE"), nullable=False
    )
    student_external_id: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="absent")
    checkin_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    method: Mapped[str | None] = mapped_column(Text)
    device_info: Mapped[dict | None] = mapped_column(JSONB)
    ip_address: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    updated_by_external_id: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    session = relationship("AttendanceSession", back_populates="records")
