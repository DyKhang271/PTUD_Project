from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class CourseSection(Base):
    __tablename__ = "course_sections"
    __table_args__ = (
        UniqueConstraint("term_id", "section_code", name="uq_course_sections_term_section_code"),
        Index("ix_course_sections_term_id", "term_id"),
        Index("ix_course_sections_teacher_external_id", "teacher_external_id"),
        Index("ix_course_sections_faculty", "faculty"),
        Index("ix_course_sections_program_name", "program_name"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    term_id: Mapped[UUID | None] = mapped_column(PG_UUID(as_uuid=True), ForeignKey("academic_terms.id"), nullable=True)
    course_code: Mapped[str] = mapped_column(Text, nullable=False)
    course_name: Mapped[str] = mapped_column(Text, nullable=False)
    section_code: Mapped[str] = mapped_column(Text, nullable=False)
    teacher_external_id: Mapped[str | None] = mapped_column(Text)
    faculty: Mapped[str | None] = mapped_column(Text)
    program_name: Mapped[str | None] = mapped_column(Text)
    student_count: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    total_sessions: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    term = relationship("AcademicTerm", back_populates="sections")
    students = relationship("CourseSectionStudent", back_populates="section", cascade="all, delete-orphan")
    timetable_entries = relationship("TimetableEntry", back_populates="section", cascade="all, delete-orphan")
    exam_schedules = relationship("ExamSchedule", back_populates="section", cascade="all, delete-orphan")
    attendance_sessions = relationship("AttendanceSession", back_populates="section", cascade="all, delete-orphan")


class CourseSectionStudent(Base):
    __tablename__ = "course_section_students"
    __table_args__ = (
        UniqueConstraint("section_id", "student_external_id", name="uq_course_section_students_section_student"),
        Index("ix_course_section_students_student_external_id", "student_external_id"),
        Index("ix_course_section_students_section_id", "section_id"),
    )

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    section_id: Mapped[UUID] = mapped_column(
        PG_UUID(as_uuid=True), ForeignKey("course_sections.id", ondelete="CASCADE"), nullable=False
    )
    student_external_id: Mapped[str] = mapped_column(Text, nullable=False)
    enrollment_status: Mapped[str] = mapped_column(Text, nullable=False, server_default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    section = relationship("CourseSection", back_populates="students")
