"""add student_count to course sections

Revision ID: 20260523_0004
Revises: 20260523_0003
Create Date: 2026-05-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260523_0004"
down_revision: Union[str, None] = "20260523_0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "course_sections",
        sa.Column("student_count", sa.Integer(), server_default="0", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("course_sections", "student_count")
