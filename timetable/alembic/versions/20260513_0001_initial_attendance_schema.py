"""initial attendance timetable schema

Revision ID: 20260513_0001
Revises:
Create Date: 2026-05-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260513_0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "external_users_cache",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("external_user_id", sa.Text(), nullable=False),
        sa.Column("role", sa.Text(), nullable=False),
        sa.Column("full_name", sa.Text(), nullable=True),
        sa.Column("email", sa.Text(), nullable=True),
        sa.Column("class_name", sa.Text(), nullable=True),
        sa.Column("faculty", sa.Text(), nullable=True),
        sa.Column("program_name", sa.Text(), nullable=True),
        sa.Column("source_updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("cached_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("external_user_id", "role", name="uq_external_users_cache_external_user_role"),
    )
    op.create_index("ix_external_users_cache_external_user_role", "external_users_cache", ["external_user_id", "role"])

    op.create_table(
        "academic_terms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("term_code", sa.Text(), nullable=False),
        sa.Column("term_name", sa.Text(), nullable=False),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("term_code"),
    )

    op.create_table(
        "course_sections",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("term_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("course_code", sa.Text(), nullable=False),
        sa.Column("course_name", sa.Text(), nullable=False),
        sa.Column("section_code", sa.Text(), nullable=False),
        sa.Column("teacher_external_id", sa.Text(), nullable=True),
        sa.Column("faculty", sa.Text(), nullable=True),
        sa.Column("total_sessions", sa.Integer(), nullable=True),
        sa.Column("status", sa.Text(), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["term_id"], ["academic_terms.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("term_id", "section_code", name="uq_course_sections_term_section_code"),
    )
    op.create_index("ix_course_sections_term_id", "course_sections", ["term_id"])
    op.create_index("ix_course_sections_teacher_external_id", "course_sections", ["teacher_external_id"])

    op.create_table(
        "course_section_students",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_external_id", sa.Text(), nullable=False),
        sa.Column("enrollment_status", sa.Text(), server_default="active", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["section_id"], ["course_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("section_id", "student_external_id", name="uq_course_section_students_section_student"),
    )
    op.create_index("ix_course_section_students_section_id", "course_section_students", ["section_id"])
    op.create_index("ix_course_section_students_student_external_id", "course_section_students", ["student_external_id"])

    op.create_table(
        "timetable_entries",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_period", sa.SmallInteger(), nullable=True),
        sa.Column("end_period", sa.SmallInteger(), nullable=True),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("room", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("valid_from", sa.Date(), nullable=True),
        sa.Column("valid_to", sa.Date(), nullable=True),
        sa.Column("session_type", sa.Text(), server_default="study", nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("day_of_week BETWEEN 1 AND 7", name="ck_timetable_entries_day_of_week"),
        sa.ForeignKeyConstraint(["section_id"], ["course_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_timetable_entries_day_of_week", "timetable_entries", ["day_of_week"])
    op.create_index("ix_timetable_entries_section_id", "timetable_entries", ["section_id"])

    op.create_table(
        "exam_schedules",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("exam_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("room", sa.Text(), nullable=True),
        sa.Column("location", sa.Text(), nullable=True),
        sa.Column("exam_type", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["section_id"], ["course_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_schedules_section_id", "exam_schedules", ["section_id"])

    op.create_table(
        "attendance_sessions",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("timetable_entry_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("session_date", sa.Date(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=True),
        sa.Column("end_time", sa.Time(), nullable=True),
        sa.Column("status", sa.Text(), server_default="draft", nullable=False),
        sa.Column("qr_token_hash", sa.Text(), nullable=True),
        sa.Column("checkin_code_hash", sa.Text(), nullable=True),
        sa.Column("checkin_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by_external_id", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("opened_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["section_id"], ["course_sections.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["timetable_entry_id"], ["timetable_entries.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("section_id", "session_date", "start_time", name="uq_attendance_sessions_section_date_start"),
    )
    op.create_index("ix_attendance_sessions_section_date", "attendance_sessions", ["section_id", "session_date"])

    op.create_table(
        "attendance_records",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("session_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("student_external_id", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="absent", nullable=False),
        sa.Column("checkin_time", sa.DateTime(timezone=True), nullable=True),
        sa.Column("method", sa.Text(), nullable=True),
        sa.Column("device_info", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("ip_address", sa.Text(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("updated_by_external_id", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["attendance_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "student_external_id", name="uq_attendance_records_session_student"),
    )
    op.create_index("ix_attendance_records_session_id", "attendance_records", ["session_id"])
    op.create_index("ix_attendance_records_status", "attendance_records", ["status"])
    op.create_index("ix_attendance_records_student_external_id", "attendance_records", ["student_external_id"])

    op.create_table(
        "attendance_policies",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("scope_type", sa.Text(), nullable=False),
        sa.Column("scope_id", sa.Text(), nullable=True),
        sa.Column("max_absent_sessions", sa.Integer(), nullable=True),
        sa.Column("max_absent_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("allow_late_minutes", sa.Integer(), server_default="15", nullable=False),
        sa.Column("late_count_as_absent_ratio", sa.Numeric(4, 2), server_default="0.5", nullable=False),
        sa.Column("warning_threshold_percent", sa.Numeric(5, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_attendance_policies_scope_type_scope_id", "attendance_policies", ["scope_type", "scope_id"])

    op.create_table(
        "app_notifications",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_external_id", sa.Text(), nullable=False),
        sa.Column("user_role", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("message", sa.Text(), nullable=False),
        sa.Column("notification_type", sa.Text(), nullable=True),
        sa.Column("related_type", sa.Text(), nullable=True),
        sa.Column("related_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("app_notifications")
    op.drop_index("ix_attendance_policies_scope_type_scope_id", table_name="attendance_policies")
    op.drop_table("attendance_policies")
    op.drop_index("ix_attendance_records_student_external_id", table_name="attendance_records")
    op.drop_index("ix_attendance_records_status", table_name="attendance_records")
    op.drop_index("ix_attendance_records_session_id", table_name="attendance_records")
    op.drop_table("attendance_records")
    op.drop_index("ix_attendance_sessions_section_date", table_name="attendance_sessions")
    op.drop_table("attendance_sessions")
    op.drop_index("ix_exam_schedules_section_id", table_name="exam_schedules")
    op.drop_table("exam_schedules")
    op.drop_index("ix_timetable_entries_section_id", table_name="timetable_entries")
    op.drop_index("ix_timetable_entries_day_of_week", table_name="timetable_entries")
    op.drop_table("timetable_entries")
    op.drop_index("ix_course_section_students_student_external_id", table_name="course_section_students")
    op.drop_index("ix_course_section_students_section_id", table_name="course_section_students")
    op.drop_table("course_section_students")
    op.drop_index("ix_course_sections_teacher_external_id", table_name="course_sections")
    op.drop_index("ix_course_sections_term_id", table_name="course_sections")
    op.drop_table("course_sections")
    op.drop_table("academic_terms")
    op.drop_index("ix_external_users_cache_external_user_role", table_name="external_users_cache")
    op.drop_table("external_users_cache")
