from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.services.core_api_client import CoreApiClient

# DEV ONLY: remove or protect before production
router = APIRouter(prefix="/debug/core", tags=["debug-core"])


class DebugVerifyTokenRequest(BaseModel):
    external_token: str


class DebugStudentsBatchRequest(BaseModel):
    student_ids: list[str] = Field(default_factory=list)


@router.get("/student/{student_id}")
def debug_get_student(student_id: str):
    return CoreApiClient().get_student(student_id)


@router.post("/verify-token")
def debug_verify_token(payload: DebugVerifyTokenRequest):
    return CoreApiClient().verify_token(payload.external_token)


@router.post("/students/batch")
def debug_students_batch(payload: DebugStudentsBatchRequest):
    return CoreApiClient().get_students_batch(payload.student_ids)


@router.get("/teachers/{teacher_id}")
def debug_get_teacher(teacher_id: str):
    return CoreApiClient().get_teacher(teacher_id)


@router.get("/students-by-class")
def debug_students_by_class(class_name: str):
    return CoreApiClient().get_students_by_class(class_name)


@router.get("/course-sections/source")
def debug_course_sections_source(
    term: str | None = None,
    student_id: str | None = None,
    class_name: str | None = None,
    limit: int = 10,
):
    return CoreApiClient().get_course_sections_source(
        term=term,
        student_id=student_id,
        class_name=class_name,
        limit=limit,
    )
