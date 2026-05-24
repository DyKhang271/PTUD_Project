from __future__ import annotations

from datetime import date as DateType
from datetime import datetime, time
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


class AcademicSchedulingSourceImportRequest(BaseModel):
    term_code: str = Field(min_length=1)
    program_name: str | None = None
    program_id: str | None = None
    cohort: str | None = None
    curriculum_semester: int | None = Field(default=None, ge=1)
    strict_curriculum_match: bool = False


class AcademicSchedulingImportedSectionRead(BaseModel):
    section_code: str
    course_code: str
    course_name: str
    teacher_external_id: str | None = None
    teacher_full_name: str | None = None
    student_count: int = 0
    status: str


class AcademicSchedulingSourceDebugRead(BaseModel):
    selected_program_name: str | None = None
    selected_cohort: str | None = None
    selected_term_code: str | None = None
    selected_curriculum_semester: int | None = None
    strict_curriculum_match: bool = False
    matched_students_by_program: int = 0
    matched_students_by_cohort: int = 0
    matched_students_final: int = 0
    transcript_courses_in_term: int = 0
    imported_courses_count: int = 0
    curriculum_courses_in_selected_semester: int = 0
    overlap_course_codes: list[str] = Field(default_factory=list)
    transcript_only_course_codes: list[str] = Field(default_factory=list)
    curriculum_only_course_codes: list[str] = Field(default_factory=list)
    available_program_names: list[str] = Field(default_factory=list)
    available_cohorts: list[str] = Field(default_factory=list)
    available_terms: list[str] = Field(default_factory=list)
    available_curriculum_semesters: list[int] = Field(default_factory=list)


class AcademicSchedulingOptionRead(BaseModel):
    value: str
    label: str


class AcademicSchedulingProgramOptionRead(BaseModel):
    name: str
    cohorts: list[str] = Field(default_factory=list)


class AcademicSchedulingOptionsResponse(BaseModel):
    terms: list[AcademicSchedulingOptionRead] = Field(default_factory=list)
    programs: list[AcademicSchedulingProgramOptionRead] = Field(default_factory=list)


class AcademicSchedulingSourceImportResponse(BaseModel):
    batch_id: str
    status: str
    term_code: str
    program_name: str | None = None
    cohort: str | None = None
    curriculum_semester: int
    imported_terms: int
    sections_created: int
    sections_updated: int
    students_created_or_reactivated: int
    teachers_upserted: int
    total_sections: int
    total_students: int
    warnings: list[str] = Field(default_factory=list)
    summary: dict[str, int] = Field(default_factory=dict)
    debug: AcademicSchedulingSourceDebugRead | None = None
    sections: list[AcademicSchedulingImportedSectionRead]


class AcademicImportBatchRead(BaseModel):
    id: str
    term_code: str
    program_name: str | None = None
    cohort: str | None = None
    curriculum_semester: int
    imported_at: datetime
    status: str
    section_count: int
    student_count: int
    teacher_count: int
    warnings: list[str] = Field(default_factory=list)
    debug: AcademicSchedulingSourceDebugRead | None = None


class AcademicImportBatchDetailRead(AcademicImportBatchRead):
    source: str
    imported_by: str | None = None
    snapshot: dict | None = None
    error_message: str | None = None


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
