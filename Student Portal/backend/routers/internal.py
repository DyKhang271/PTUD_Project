from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from pydantic import BaseModel, Field

from services import internal_service

router = APIRouter(prefix="/internal", tags=["internal"])


def require_internal_api_key(x_internal_api_key: Annotated[str | None, Header(alias="X-Internal-Api-Key")] = None) -> None:
    internal_service.verify_internal_api_key(x_internal_api_key)


class VerifyTokenRequest(BaseModel):
    token: str | None = None
    external_token: str | None = None


class StudentBatchRequest(BaseModel):
    student_ids: list[str] = Field(default_factory=list)


class TeacherBatchRequest(BaseModel):
    teacher_ids: list[str] = Field(default_factory=list)


@router.post("/auth/verify-token", dependencies=[Depends(require_internal_api_key)])
def verify_token(payload: VerifyTokenRequest):
    token = (payload.token or payload.external_token or "").strip()
    result = internal_service.verify_external_token(token)
    if not result.get("valid"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid external token")
    return result


@router.get("/students/{student_id}", dependencies=[Depends(require_internal_api_key)])
def get_student(student_id: str):
    student = internal_service.get_student_profile_internal(student_id)
    if not student:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Student not found")
    return student


@router.post("/students/batch", dependencies=[Depends(require_internal_api_key)])
def get_students_batch(payload: StudentBatchRequest):
    return internal_service.get_students_batch_internal(payload.student_ids)


@router.get("/students", dependencies=[Depends(require_internal_api_key)])
def get_students_by_class(class_name: str = Query(..., min_length=1)):
    return internal_service.get_students_by_class_internal(class_name)


@router.get("/teachers/{teacher_id}", dependencies=[Depends(require_internal_api_key)])
def get_teacher(teacher_id: str):
    teacher = internal_service.get_teacher_internal(teacher_id)
    if not teacher:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Teacher not found")
    return teacher


@router.post("/teachers/batch", dependencies=[Depends(require_internal_api_key)])
def get_teachers_batch(payload: TeacherBatchRequest):
    return internal_service.get_teachers_batch_internal(payload.teacher_ids)


@router.get("/course-sections/source", dependencies=[Depends(require_internal_api_key)])
def get_course_sections_source(
    term: str | None = Query(default=None),
    student_id: str | None = Query(default=None),
    class_name: str | None = Query(default=None),
    limit: int = Query(default=100, ge=0, le=1000),
):
    return internal_service.get_course_sections_source_internal(
        term=term,
        student_id=student_id,
        class_name=class_name,
        limit=limit,
    )


@router.get("/source-terms", dependencies=[Depends(require_internal_api_key)])
def get_source_terms():
    return internal_service.get_source_terms_internal()


@router.get("/students/{student_id}/course-sections", dependencies=[Depends(require_internal_api_key)])
def get_student_course_sections(student_id: str):
    return internal_service.get_student_course_sections_internal(student_id)
