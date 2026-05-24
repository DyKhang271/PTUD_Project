"""add exam schedule status

Revision ID: 20260524_0010
Revises: 20260524_0009
Create Date: 2026-05-24 13:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "20260524_0010"
down_revision = "20260524_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("exam_schedules", sa.Column("status", sa.Text(), nullable=False, server_default="scheduled"))


def downgrade() -> None:
    op.drop_column("exam_schedules", "status")
