"""add unique constraint for timetable attendance sessions

Revision ID: 20260523_0003
Revises: 20260523_0002
Create Date: 2026-05-23
"""

from typing import Sequence, Union

from alembic import op


revision: str = "20260523_0003"
down_revision: Union[str, None] = "20260523_0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_attendance_sessions_timetable_entry_date",
        "attendance_sessions",
        ["timetable_entry_id", "session_date"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_attendance_sessions_timetable_entry_date", "attendance_sessions", type_="unique")
