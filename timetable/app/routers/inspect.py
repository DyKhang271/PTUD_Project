from __future__ import annotations

from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.repositories import section_repo
from app.schemas.section_schema import CourseSectionInspectRead
from app.schemas.timetable_schema import StudentTimetableItem
from app.services import timetable_service

router = APIRouter(tags=["inspect"], dependencies=[Depends(require_role(["admin"]))])


def _to_section_inspect(section) -> CourseSectionInspectRead:
    return CourseSectionInspectRead(
        id=section.id,
        term_id=section.term_id,
        term_code=section.term.term_code if getattr(section, "term", None) else None,
        term_name=section.term.term_name if getattr(section, "term", None) else None,
        course_code=section.course_code,
        course_name=section.course_name,
        section_code=section.section_code,
        teacher_external_id=section.teacher_external_id,
        faculty=section.faculty,
        student_count=section.student_count,
        total_sessions=section.total_sessions,
        status=section.status,
        created_at=section.created_at,
        updated_at=section.updated_at,
    )


@router.get("/course-sections", response_model=list[CourseSectionInspectRead])
def inspect_course_sections(
    db: Annotated[Session, Depends(get_db)],
    term_id: UUID | None = None,
    term_code: str | None = None,
    teacher_external_id: str | None = None,
    student_external_id: str | None = None,
):
    resolved_term_id = term_id
    if term_code:
        term = section_repo.get_term_by_code(db, term_code)
        if term is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic term not found")
        resolved_term_id = term.id

    sections = section_repo.list_sections(
        db,
        term_id=resolved_term_id,
        teacher_external_id=teacher_external_id,
        student_external_id=student_external_id,
    )
    return [_to_section_inspect(section) for section in sections]


@router.get("/course-sections/{section_id}", response_model=CourseSectionInspectRead)
def inspect_course_section(section_id: UUID, db: Annotated[Session, Depends(get_db)]):
    section = section_repo.get_section(db, section_id)
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course section not found")
    return _to_section_inspect(section)


@router.get("/students/{student_id}/schedule", response_model=list[StudentTimetableItem])
def inspect_student_schedule(
    student_id: str,
    db: Annotated[Session, Depends(get_db)],
    term_id: UUID | None = None,
    term_code: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
):
    resolved_term_id = term_id
    if term_code:
        term = section_repo.get_term_by_code(db, term_code)
        if term is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic term not found")
        resolved_term_id = term.id
    return timetable_service.get_student_timetable(
        db,
        student_external_id=student_id,
        term_id=resolved_term_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/teachers/{teacher_id}/sections", response_model=list[CourseSectionInspectRead])
def inspect_teacher_sections(
    teacher_id: str,
    db: Annotated[Session, Depends(get_db)],
    term_id: UUID | None = None,
    term_code: str | None = None,
):
    resolved_term_id = term_id
    if term_code:
        term = section_repo.get_term_by_code(db, term_code)
        if term is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic term not found")
        resolved_term_id = term.id

    sections = section_repo.list_sections(db, term_id=resolved_term_id, teacher_external_id=teacher_id)
    return [_to_section_inspect(section) for section in sections]
