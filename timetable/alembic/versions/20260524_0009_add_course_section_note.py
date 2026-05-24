"""add course section note

Revision ID: 20260524_0009
Revises: 20260524_0008
Create Date: 2026-05-24 12:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260524_0009"
down_revision = "20260524_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("course_sections", sa.Column("note", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("course_sections", "note")
