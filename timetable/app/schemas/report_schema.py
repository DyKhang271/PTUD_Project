from __future__ import annotations

from uuid import UUID

from pydantic import BaseModel


class TopAbsentSection(BaseModel):
    section_id: UUID
    section_code: str
    course_name: str
    absent_count: int


class AttendanceDashboard(BaseModel):
    total_sections: int
    total_sessions: int
    average_attendance_percent: float
    absent_count: int
    late_count: int
    top_absent_sections: list[TopAbsentSection]


class AttendanceGroupSummary(BaseModel):
    group_key: str
    group_name: str | None = None
    total_sessions: int
    total_records: int
    present_count: int
    late_count: int
    absent_count: int
    excused_count: int
    attendance_percent: float
