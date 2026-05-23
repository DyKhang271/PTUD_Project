from __future__ import annotations

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class TermBase(BaseModel):
    term_code: str
    term_name: str
    start_date: date | None = None
    end_date: date | None = None
    status: str = "active"


class TermCreate(TermBase):
    pass


class TermUpdate(BaseModel):
    term_code: str | None = None
    term_name: str | None = None
    start_date: date | None = None
    end_date: date | None = None
    status: str | None = None


class TermRead(TermBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime
