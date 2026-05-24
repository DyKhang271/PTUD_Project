from __future__ import annotations

from datetime import date, datetime
from uuid import UUID, uuid4

from sqlalchemy import Date, DateTime, Text, func
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class AcademicTerm(Base):
    __tablename__ = "academic_terms"

    id: Mapped[UUID] = mapped_column(PG_UUID(as_uuid=True), primary_key=True, default=uuid4)
    term_code: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    term_name: Mapped[str] = mapped_column(Text, nullable=False)
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(Text, nullable=False, server_default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    sections = relationship("CourseSection", back_populates="term")

    @property
    def has_date_range(self) -> bool:
        return self.start_date is not None and self.end_date is not None

    @property
    def date_range_warning(self) -> str | None:
        if self.has_date_range:
            return None
        return "Học kỳ chưa có ngày bắt đầu/kết thúc đầy đủ. Validation theo phạm vi học kỳ sẽ không áp dụng trọn vẹn."
