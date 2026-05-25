"""add teacher assignments

Revision ID: 20260524_0006
Revises: 20260523_0005
Create Date: 2026-05-24 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "20260524_0006"
down_revision = "20260523_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "teacher_assignments",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("section_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("teacher_external_id", sa.Text(), nullable=False),
        sa.Column("teacher_full_name", sa.Text(), nullable=True),
        sa.Column("source", sa.Text(), server_default="portal", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["section_id"], ["course_sections.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("section_id", name="uq_teacher_assignments_section_id"),
    )
    op.create_index("ix_teacher_assignments_teacher_external_id", "teacher_assignments", ["teacher_external_id"])


def downgrade() -> None:
    op.drop_index("ix_teacher_assignments_teacher_external_id", table_name="teacher_assignments")
    op.drop_table("teacher_assignments")
