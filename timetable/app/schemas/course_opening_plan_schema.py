from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class FacultyRead(BaseModel):
    id: str
    code: str
    name: str


class ProgramRead(BaseModel):
    id: str
    code: str
    name: str
    faculty_id: str


class CohortRead(BaseModel):
    id: str
    code: str
    name: str
    program_id: str
    start_year: int | None = None
    expected_students: int | None = None


class CourseOpeningPlanSectionRead(BaseModel):
    section_id: str
    section_code: str
    class_name: str | None = None
    student_count: int
    teacher_id: str | None = None
    teacher_name: str | None = None
    has_schedule: bool
    has_exam: bool
    status: Literal["ready", "missing_teacher", "missing_schedule", "missing_exam"]
    schedule_label: str | None = None
    exam_label: str | None = None


class CourseOpeningPlanCourseRead(BaseModel):
    course_code: str
    course_name: str
    credits: int | None = None
    course_type: str | None = None
    expected_students: int
    suggested_sections: int
    opened_sections: int
    status: Literal["opened", "missing", "under_opened", "extra"]
    sections: list[CourseOpeningPlanSectionRead]


class CourseOpeningPlanSummary(BaseModel):
    planned_courses: int
    opened_courses: int
    missing_courses: int
    extra_courses: int
    total_sections: int
    missing_teacher_sections: int
    missing_schedule_sections: int
    missing_exam_sections: int


class CourseOpeningPlanMeta(BaseModel):
    source: str | None = None
    notes: list[str] = Field(default_factory=list)


class CourseOpeningPlanResponse(BaseModel):
    faculty: str
    program: str
    cohort: str
    curriculum_semester: int
    term_code: str
    summary: CourseOpeningPlanSummary
    courses: list[CourseOpeningPlanCourseRead]
    meta: CourseOpeningPlanMeta | None = None
