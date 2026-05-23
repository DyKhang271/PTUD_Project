from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class AttendancePolicyBase(BaseModel):
    scope_type: str
    scope_id: str | None = None
    max_absent_sessions: int | None = None
    max_absent_percent: Decimal | None = None
    allow_late_minutes: int = 15
    late_count_as_absent_ratio: Decimal = Decimal("0.5")
    warning_threshold_percent: Decimal | None = None


class AttendancePolicyCreate(AttendancePolicyBase):
    pass


class AttendancePolicyUpdate(BaseModel):
    scope_type: str | None = None
    scope_id: str | None = None
    max_absent_sessions: int | None = None
    max_absent_percent: Decimal | None = None
    allow_late_minutes: int | None = None
    late_count_as_absent_ratio: Decimal | None = None
    warning_threshold_percent: Decimal | None = None


class AttendancePolicyRead(AttendancePolicyBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
