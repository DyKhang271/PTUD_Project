from __future__ import annotations

from datetime import date as DateType
from datetime import time
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class ImportFromCoreRequest(BaseModel):
    term: str | None = None
    term_code: str | None = None
    student_ids: list[str] | None = Field(default=None, min_length=1)
    create_sample_timetable: bool = True
    create_sample_attendance: bool = True


class ImportFromCoreResponse(BaseModel):
    imported_terms: int
    imported_sections: int
    imported_students: int
    linked_students: int
    created_timetable_entries: int
    created_attendance_sessions: int
    created_attendance_records: int
    missing_students: list[str]
    errors: list[str]


class ImportDebugSummaryTerm(BaseModel):
    id: str
    term_code: str
    term_name: str
    sections_count: int
    student_links_count: int


class ImportDebugSummaryDuplicateSection(BaseModel):
    term_id: str
    section_code: str
    count: int


class ImportDebugSummaryLatestSection(BaseModel):
    id: str
    term_code: str | None
    section_code: str
    course_code: str
    course_name: str
    teacher_external_id: str | None
    student_count: int
    status: str


class ImportDebugSummaryStatusCounts(BaseModel):
    draft: int
    published: int
    archived: int


class ImportDebugSummaryTimetableStatusCounts(BaseModel):
    draft: int
    published: int
    cancelled: int


class ImportDebugSummaryLatestTimetableEntry(BaseModel):
    id: str
    term_code: str | None
    section_code: str
    course_code: str
    course_name: str
    day_of_week: int
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    status: str


class ImportDebugSummaryResponse(BaseModel):
    terms_count: int
    course_sections_count: int
    course_section_students_count: int
    external_users_cache_count: int
    timetable_entries_count: int
    terms: list[ImportDebugSummaryTerm]
    sections_by_status: ImportDebugSummaryStatusCounts
    duplicate_sections: list[ImportDebugSummaryDuplicateSection]
    latest_sections: list[ImportDebugSummaryLatestSection]
    timetable_entries_by_status: ImportDebugSummaryTimetableStatusCounts
    latest_timetable_entries: list[ImportDebugSummaryLatestTimetableEntry]
    attendance_sessions: int
    attendance_records: int


class SourceTermRead(BaseModel):
    term_code: str | None
    term_name: str | None
    academic_year: str | None = None
    semester: str | None = None
    course_count: int = 0
    student_count: int = 0
    has_course_sections: bool = False
    has_transcript_courses: bool = False
    source: list[str] = Field(default_factory=list)


class SourceTermsResponse(BaseModel):
    terms: list[SourceTermRead]
    latest_term_code: str | None = None
    total: int


class TimetableEntriesImportItem(BaseModel):
    section_code: str = Field(min_length=1)
    day_of_week: int = Field(ge=1, le=7)
    start_time: time | None = None
    end_time: time | None = None
    room: str | None = None
    weeks: str | None = None
    status: str = "published"
    note: str | None = None
    location: str | None = None
    session_type: str = "study"
    start_period: int | None = Field(default=None, ge=1)
    end_period: int | None = Field(default=None, ge=1)
    valid_from: DateType | None = None
    valid_to: DateType | None = None

    @model_validator(mode="after")
    def validate_ranges(self):
        if self.start_time and self.end_time and self.end_time <= self.start_time:
            raise ValueError("end_time must be greater than start_time")
        if self.start_period is not None and self.end_period is not None and self.end_period < self.start_period:
            raise ValueError("end_period must be greater than or equal to start_period")
        if self.valid_from and self.valid_to and self.valid_to < self.valid_from:
            raise ValueError("valid_to must be on or after valid_from")
        return self


class TimetableEntriesImportRequest(BaseModel):
    term_code: str = Field(min_length=1)
    entries: list[TimetableEntriesImportItem] = Field(default_factory=list)


class TimetableEntriesImportResponse(BaseModel):
    term_code: str
    term_id: UUID
    received_entries: int
    created: int
    updated: int
    skipped: int
    missing_sections: list[str]
    warnings: list[str]
    errors: list[str]


class TimetableCsvInvalidRow(BaseModel):
    row: int
    section_code: str | None = None
    error: str


class TimetableEntriesCsvImportResponse(BaseModel):
    filename: str
    received_rows: int
    created: int
    updated: int
    skipped: int
    missing_sections: list[str]
    invalid_rows: list[TimetableCsvInvalidRow]
    warnings: list[str]
    errors: list[str]
