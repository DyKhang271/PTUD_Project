"""add timetable entry weeks

Revision ID: 20260523_0005
Revises: 20260523_0004
Create Date: 2026-05-23 14:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260523_0005"
down_revision = "20260523_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("timetable_entries", sa.Column("weeks", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("timetable_entries", "weeks")
