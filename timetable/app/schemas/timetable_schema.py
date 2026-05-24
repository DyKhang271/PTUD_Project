from __future__ import annotations

from datetime import date as DateType
from datetime import datetime, time
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class TimetableEntryBase(BaseModel):
    section_id: UUID
    day_of_week: int = Field(ge=1, le=7)
    start_period: int | None = None
    end_period: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    location: str | None = None
    valid_from: DateType | None = None
    valid_to: DateType | None = None
    status: str = "published"
    session_type: str = "study"
    note: str | None = None

    @model_validator(mode="after")
    def validate_time_and_date_range(self):
        if self.start_period is not None and self.end_period is not None and self.end_period < self.start_period:
            raise ValueError("end_period must be greater than or equal to start_period")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("valid_to must be on or after valid_from")
        return self


class TimetableEntryCreate(TimetableEntryBase):
    pass


class TimetableEntryUpdate(BaseModel):
    section_id: UUID | None = None
    day_of_week: int | None = Field(default=None, ge=1, le=7)
    start_period: int | None = None
    end_period: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    location: str | None = None
    valid_from: DateType | None = None
    valid_to: DateType | None = None
    status: str | None = None
    session_type: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def validate_time_and_date_range(self):
        if self.start_period is not None and self.end_period is not None and self.end_period < self.start_period:
            raise ValueError("end_period must be greater than or equal to start_period")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("valid_to must be on or after valid_from")
        return self


class TimetableEntryRead(TimetableEntryBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class StudentTimetableItem(BaseModel):
    section_id: UUID
    course_code: str
    course_name: str
    section_code: str
    teacher_external_id: str | None = None
    teacher_name: str | None = None
    timetable_entry_id: UUID
    day_of_week: int
    date: DateType | None = None
    start_period: int | None = None
    end_period: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    location: str | None = None
    campus: str | None = None
    effective_from: DateType | None = None
    effective_to: DateType | None = None
    status: str = "published"
    session_type: str
    note: str | None = None


class TeacherTimetableItem(BaseModel):
    section_id: UUID
    timetable_entry_id: UUID
    term_id: UUID | None = None
    section_code: str
    course_code: str
    course_name: str
    student_count: int
    day_of_week: int
    start_period: int | None = None
    end_period: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    location: str | None = None
    campus: str | None = None
    effective_from: DateType | None = None
    effective_to: DateType | None = None
    status: str = "published"


class AdminTimetableEntryRead(BaseModel):
    id: UUID
    section_id: UUID
    term_id: UUID | None = None
    term_code: str | None = None
    term_name: str | None = None
    faculty: str | None = None
    program_name: str | None = None
    section_code: str
    course_code: str
    course_name: str
    teacher_external_id: str | None = None
    teacher_name: str | None = None
    day_of_week: int
    start_period: int | None = None
    end_period: int | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    location: str | None = None
    status: str = "published"
    session_type: str = "study"
    note: str | None = None
    valid_from: DateType | None = None
    valid_to: DateType | None = None
    created_at: datetime
    updated_at: datetime


class AdminTimetableCourseGroupRead(BaseModel):
    term_id: UUID | None = None
    term_code: str | None = None
    term_name: str | None = None
    faculty: str | None = None
    program_name: str | None = None
    course_id: str
    course_code: str
    course_name: str
    section_count: int = 0
    scheduled_count: int = 0
    schedules: list[AdminTimetableEntryRead] = Field(default_factory=list)


class InvalidTimetableIssueRead(BaseModel):
    entry_id: UUID
    section_id: UUID
    term_id: UUID | None = None
    term_code: str | None = None
    section_code: str
    course_code: str
    course_name: str
    reason: str
    detail: str
    current_status: str
    suggested_action: str = "mark_cancelled"


class TimetableCleanupSummaryRead(BaseModel):
    detected_count: int
    marked_invalid_count: int
    invalid_entries: list[InvalidTimetableIssueRead] = Field(default_factory=list)


class StudentExamScheduleItem(BaseModel):
    id: UUID
    section_id: UUID
    term_id: UUID | None = None
    term_code: str | None = None
    term_name: str | None = None
    course_code: str
    course_name: str
    section_code: str
    teacher_external_id: str | None = None
    teacher_name: str | None = None
    exam_date: DateType
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    location: str | None = None
    exam_type: str | None = None
    note: str | None = None
    created_at: datetime


class AdminExamScheduleRead(BaseModel):
    id: UUID
    section_id: UUID
    term_id: UUID | None = None
    term_code: str | None = None
    term_name: str | None = None
    faculty: str | None = None
    program_name: str | None = None
    section_code: str
    course_code: str
    course_name: str
    teacher_external_id: str | None = None
    teacher_name: str | None = None
    exam_date: DateType
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    location: str | None = None
    exam_type: str | None = None
    status: str = "scheduled"
    note: str | None = None
    created_at: datetime


class AdminExamCourseGroupRead(BaseModel):
    term_id: UUID | None = None
    term_code: str | None = None
    term_name: str | None = None
    faculty: str | None = None
    program_name: str | None = None
    course_id: str
    course_code: str
    course_name: str
    section_count: int = 0
    scheduled_count: int = 0
    exams: list[AdminExamScheduleRead] = Field(default_factory=list)


class SectionTimetableWriteBase(BaseModel):
    day_of_week: int = Field(ge=1, le=7)
    start_period: int = Field(ge=1)
    end_period: int = Field(ge=1)
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    location: str | None = None
    campus: str | None = None
    valid_from: DateType | None = None
    valid_to: DateType | None = None
    effective_from: DateType | None = None
    effective_to: DateType | None = None
    status: str = "published"
    session_type: str = "study"
    teacher_id: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def validate_period_range(self):
        range_start = self.valid_from or self.effective_from
        range_end = self.valid_to or self.effective_to
        if self.end_period < self.start_period:
            raise ValueError("end_period must be greater than or equal to start_period")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        if range_start and range_end and range_end < range_start:
            raise ValueError("effective_to must be on or after effective_from")
        return self


class SectionTimetableCreate(SectionTimetableWriteBase):
    pass


class SectionTimetableUpdate(BaseModel):
    day_of_week: int | None = Field(default=None, ge=1, le=7)
    start_period: int | None = Field(default=None, ge=1)
    end_period: int | None = Field(default=None, ge=1)
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    location: str | None = None
    campus: str | None = None
    valid_from: DateType | None = None
    valid_to: DateType | None = None
    effective_from: DateType | None = None
    effective_to: DateType | None = None
    status: str | None = None
    session_type: str | None = None
    teacher_id: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def validate_period_range(self):
        range_start = self.valid_from or self.effective_from
        range_end = self.valid_to or self.effective_to
        if self.start_period is not None and self.end_period is not None and self.end_period < self.start_period:
            raise ValueError("end_period must be greater than or equal to start_period")
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        if range_start and range_end and range_end < range_start:
            raise ValueError("effective_to must be on or after effective_from")
        return self


class ExamScheduleBase(BaseModel):
    section_id: UUID
    exam_date: DateType
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    location: str | None = None
    exam_type: str | None = None
    status: str = "scheduled"
    note: str | None = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        return self


class ExamScheduleCreate(ExamScheduleBase):
    pass


class ExamScheduleUpdate(BaseModel):
    section_id: UUID | None = None
    exam_date: DateType | None = None
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    location: str | None = None
    exam_type: str | None = None
    status: str | None = None
    note: str | None = None

    @model_validator(mode="after")
    def validate_time_range(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        return self


class ExamScheduleRead(ExamScheduleBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
