"""add timetable shift and source columns

Revision ID: 20260526_0011
Revises: 20260524_0010
Create Date: 2026-05-26 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260526_0011"
down_revision = "20260524_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("timetable_entries", sa.Column("shift_code", sa.Text(), nullable=True))
    op.add_column("timetable_entries", sa.Column("shift_name", sa.Text(), nullable=True))
    op.add_column("timetable_entries", sa.Column("source", sa.Text(), nullable=False, server_default="manual"))
    op.add_column("timetable_entries", sa.Column("is_sample", sa.Boolean(), nullable=False, server_default=sa.text("false")))

    op.execute(
        """
        UPDATE timetable_entries
        SET
            shift_code = CASE
                WHEN start_time = TIME '06:30' AND end_time = TIME '09:00' THEN 'CA1'
                WHEN start_time = TIME '09:10' AND end_time = TIME '11:40' THEN 'CA2'
                WHEN start_time = TIME '12:30' AND end_time = TIME '15:00' THEN 'CA3'
                WHEN start_time = TIME '15:10' AND end_time = TIME '17:40' THEN 'CA4'
                WHEN start_time = TIME '18:00' AND end_time = TIME '20:40' THEN 'CA5'
                ELSE NULL
            END,
            shift_name = CASE
                WHEN start_time = TIME '06:30' AND end_time = TIME '09:00' THEN 'Ca 1'
                WHEN start_time = TIME '09:10' AND end_time = TIME '11:40' THEN 'Ca 2'
                WHEN start_time = TIME '12:30' AND end_time = TIME '15:00' THEN 'Ca 3'
                WHEN start_time = TIME '15:10' AND end_time = TIME '17:40' THEN 'Ca 4'
                WHEN start_time = TIME '18:00' AND end_time = TIME '20:40' THEN 'Ca 5'
                ELSE NULL
            END
        """
    )


def downgrade() -> None:
    op.drop_column("timetable_entries", "is_sample")
    op.drop_column("timetable_entries", "source")
    op.drop_column("timetable_entries", "shift_name")
    op.drop_column("timetable_entries", "shift_code")
