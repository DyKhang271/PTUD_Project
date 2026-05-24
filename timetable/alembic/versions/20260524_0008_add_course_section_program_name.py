"""add course section program name

Revision ID: 20260524_0008
Revises: 20260524_0007
Create Date: 2026-05-24 16:50:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260524_0008"
down_revision = "20260524_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("course_sections", sa.Column("program_name", sa.Text(), nullable=True))
    op.create_index("ix_course_sections_faculty", "course_sections", ["faculty"])
    op.create_index("ix_course_sections_program_name", "course_sections", ["program_name"])


def downgrade() -> None:
    op.drop_index("ix_course_sections_program_name", table_name="course_sections")
    op.drop_index("ix_course_sections_faculty", table_name="course_sections")
    op.drop_column("course_sections", "program_name")
