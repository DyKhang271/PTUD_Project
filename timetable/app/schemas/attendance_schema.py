from __future__ import annotations

from datetime import date, datetime, time
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
    checkin_expires_at: datetime | None = None
    created_by_external_id: str | None = None
    created_at: datetime
    opened_at: datetime | None = None
    closed_at: datetime | None = None
    note: str | None = None


class OpenAttendanceSessionResponse(BaseModel):
    session: AttendanceSessionRead
    checkin_code: str
    qr_token: str
    expires_at: datetime


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
    checkin_time: datetime | None = None
    method: str | None = None
    device_info: dict | None = None
    ip_address: str | None = None
    note: str | None = None
    updated_by_external_id: str | None = None
    updated_at: datetime
    full_name: str | None = None


class AttendanceRecordUpdate(BaseModel):
    status: str
    note: str | None = None


class AttendanceHistoryItem(BaseModel):
    session_id: UUID
    section_id: UUID
    course_code: str
    course_name: str
    section_code: str
    session_date: date
    start_time: time | None = None
    end_time: time | None = None
    status: str
    checkin_time: datetime | None = None
    method: str | None = None
    note: str | None = None


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
