from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Index, Integer, Numeric, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class AttendancePolicy(Base):
    __tablename__ = "attendance_policies"
    __table_args__ = (Index("ix_attendance_policies_scope_type_scope_id", "scope_type", "scope_id"),)

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    scope_type: Mapped[str] = mapped_column(Text, nullable=False)
    scope_id: Mapped[str | None] = mapped_column(Text)
    max_absent_sessions: Mapped[int | None] = mapped_column(Integer)
    max_absent_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    allow_late_minutes: Mapped[int] = mapped_column(Integer, nullable=False, server_default="15")
    late_count_as_absent_ratio: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, server_default="0.5")
    warning_threshold_percent: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

