from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.import_schema import SourceTermRead


class CourseSectionBase(BaseModel):
    term_id: UUID | None = None
    course_code: str
    course_name: str
    section_code: str
    teacher_external_id: str | None = None
    faculty: str | None = None
    student_count: int = 0
    total_sessions: int | None = None
    status: str = "active"


class CourseSectionCreate(CourseSectionBase):
    pass


class CourseSectionUpdate(BaseModel):
    term_id: UUID | None = None
    course_code: str | None = None
    course_name: str | None = None
    section_code: str | None = None
    teacher_external_id: str | None = None
    faculty: str | None = None
    student_count: int | None = None
    total_sessions: int | None = None
    status: str | None = None


class CourseSectionRead(CourseSectionBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    created_at: datetime
    updated_at: datetime


class CourseSectionInspectRead(CourseSectionRead):
    term_code: str | None = None
    term_name: str | None = None


class SectionStudentCreate(BaseModel):
    student_external_id: str
    enrollment_status: str = "active"


class SectionStudentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    section_id: UUID
    student_external_id: str
    enrollment_status: str
    created_at: datetime
    full_name: str | None = None
    class_name: str | None = None
    faculty: str | None = None


class SectionStudentsImportRequest(BaseModel):
    student_ids: list[str] | None = Field(default=None, min_length=1)
    source: str | None = None
    class_name: str | None = None


class SectionStudentsImportResponse(BaseModel):
    imported_count: int
    skipped_count: int
    student_ids: list[str]


class CoreCourseSectionsImportRequest(BaseModel):
    term: str | None = None
    term_code: str | None = None
    class_name: str | None = None
    student_id: str | None = None
    limit: int = 100


class CoreCourseSectionsImportResponse(BaseModel):
    term_code: str | None = None
    selected_term: SourceTermRead | None = None
    imported_terms: int
    imported_sections: int
    sections_created: int
    sections_updated: int
    imported_students: int
    students_cached: int
    linked_students: int
    students_linked: int
    teachers_cached: int
    missing_students: list[str]
    warnings: list[str]
    errors: list[str]


class SectionTeacherAssignRequest(BaseModel):
    teacher_id: str = Field(min_length=1)
