"""harden import and constraints

Revision ID: 20260524_0007
Revises: 20260524_0006
Create Date: 2026-05-24 16:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260524_0007"
down_revision = "20260524_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_constraint("uq_teacher_assignments_section_id", "teacher_assignments", type_="unique")
    op.add_column("teacher_assignments", sa.Column("assignment_type", sa.Text(), server_default="primary", nullable=False))
    op.add_column("teacher_assignments", sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False))
    op.add_column("teacher_assignments", sa.Column("assigned_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
    op.create_unique_constraint(
        "uq_teacher_assignments_section_teacher_type",
        "teacher_assignments",
        ["section_id", "teacher_external_id", "assignment_type"],
    )

    op.create_table(
        "academic_import_batches",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("source", sa.Text(), server_default="student_portal", nullable=False),
        sa.Column("term_code", sa.Text(), nullable=False),
        sa.Column("program_name", sa.Text(), nullable=True),
        sa.Column("cohort", sa.Text(), nullable=True),
        sa.Column("curriculum_semester", sa.Integer(), nullable=False),
        sa.Column("imported_by", sa.Text(), nullable=True),
        sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("status", sa.Text(), server_default="failed", nullable=False),
        sa.Column("section_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("student_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("teacher_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("warnings_json", sa.JSON(), nullable=True),
        sa.Column("source_payload_snapshot_json", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "rooms",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("room_code", sa.Text(), nullable=False),
        sa.Column("room_name", sa.Text(), nullable=True),
        sa.Column("capacity", sa.Integer(), nullable=True),
        sa.Column("room_type", sa.Text(), server_default="theory", nullable=False),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("room_code", name="uq_rooms_room_code"),
    )

    op.create_table(
        "teacher_availability",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_external_id", sa.Text(), nullable=False),
        sa.Column("term_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("day_of_week", sa.SmallInteger(), nullable=False),
        sa.Column("start_period", sa.SmallInteger(), nullable=False),
        sa.Column("end_period", sa.SmallInteger(), nullable=False),
        sa.Column("availability_type", sa.Text(), server_default="available", nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["term_id"], ["academic_terms.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_teacher_availability_teacher_term", "teacher_availability", ["teacher_external_id", "term_id"])

    op.create_table(
        "section_scheduling_requirements",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("required_room_type", sa.Text(), nullable=True),
        sa.Column("expected_students", sa.Integer(), nullable=True),
        sa.Column("sessions_per_week", sa.Integer(), nullable=True),
        sa.Column("periods_per_session", sa.Integer(), nullable=True),
        sa.Column("note", sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(["section_id"], ["course_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("section_id", name="uq_section_scheduling_requirements_section_id"),
    )


def downgrade() -> None:
    op.drop_table("section_scheduling_requirements")
    op.drop_index("ix_teacher_availability_teacher_term", table_name="teacher_availability")
    op.drop_table("teacher_availability")
    op.drop_table("rooms")
    op.drop_table("academic_import_batches")
    op.drop_constraint("uq_teacher_assignments_section_teacher_type", "teacher_assignments", type_="unique")
    op.drop_column("teacher_assignments", "assigned_at")
    op.drop_column("teacher_assignments", "active")
    op.drop_column("teacher_assignments", "assignment_type")
    op.create_unique_constraint("uq_teacher_assignments_section_id", "teacher_assignments", ["section_id"])
