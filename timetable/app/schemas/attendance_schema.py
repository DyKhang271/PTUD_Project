from __future__ import annotations

from datetime import date, datetime as DateTime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class AttendanceSessionCreate(BaseModel):
    timetable_entry_id: UUID | None = None
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    note: str | None = None


class AttendanceSessionCreateForSection(AttendanceSessionCreate):
    section_id: UUID


class AttendanceSessionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    section_id: UUID
    timetable_entry_id: UUID | None = None
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    status: str
    checkin_expires_at: DateTime | None = None
    created_by_external_id: str | None = None
    created_at: DateTime
    opened_at: DateTime | None = None
    closed_at: DateTime | None = None
    note: str | None = None


class OpenAttendanceSessionResponse(BaseModel):
    session: AttendanceSessionRead
    checkin_code: str
    qr_token: str
    expires_at: DateTime


class CheckInCodeRequest(BaseModel):
    session_id: UUID
    code: str = Field(min_length=1)


class CheckInQrRequest(BaseModel):
    qr_token: str = Field(min_length=1)


class AttendanceRecordRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    student_external_id: str
    status: str
    checkin_time: DateTime | None = None
    method: str | None = None
    device_info: dict | None = None
    ip_address: str | None = None
    note: str | None = None
    updated_by_external_id: str | None = None
    updated_at: DateTime
    full_name: str | None = None


class AttendanceRecordUpdate(BaseModel):
    status: str
    note: str | None = None


class AttendanceRecordBatchUpdateItem(BaseModel):
    student_id: str = Field(min_length=1)
    status: str
    note: str | None = None


class AttendanceRecordBatchUpdate(BaseModel):
    records: list[AttendanceRecordBatchUpdateItem] = Field(default_factory=list)


class AttendanceHistoryItem(BaseModel):
    session_id: UUID
    section_id: UUID
    term: str | None = None
    course_code: str
    course_name: str
    section_code: str
    teacher_name: str | None = None
    datetime: DateTime | None = None
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    status: str
    checkin_time: DateTime | None = None
    method: str | None = None
    note: str | None = None
    updated_at: DateTime | None = None


class AttendanceSummaryItem(BaseModel):
    student_external_id: str | None = None
    full_name: str | None = None
    section_id: UUID
    course_code: str
    course_name: str
    section_code: str
    total_sessions: int
    present_count: int
    late_count: int
    absent_count: int
    excused_count: int
    attendance_percent: float
    warning_status: str
