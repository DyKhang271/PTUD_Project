"""add status to timetable entries

Revision ID: 20260523_0002
Revises: 20260513_0001
Create Date: 2026-05-23
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260523_0002"
down_revision: Union[str, None] = "20260513_0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "timetable_entries",
        sa.Column("status", sa.Text(), server_default="published", nullable=False),
    )


def downgrade() -> None:
    op.drop_column("timetable_entries", "status")
