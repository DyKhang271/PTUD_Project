from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.teacher_assignment import TeacherAssignment


def get_by_section_and_type(db: Session, *, section_id, assignment_type: str) -> list[TeacherAssignment]:
    return list(
        db.scalars(
            select(TeacherAssignment).where(
                TeacherAssignment.section_id == section_id,
                TeacherAssignment.assignment_type == assignment_type,
            )
        ).all()
    )


def get_assignment(
    db: Session,
    *,
    section_id,
    teacher_external_id: str,
    assignment_type: str,
) -> TeacherAssignment | None:
    return db.scalar(
        select(TeacherAssignment).where(
            TeacherAssignment.section_id == section_id,
            TeacherAssignment.teacher_external_id == teacher_external_id,
            TeacherAssignment.assignment_type == assignment_type,
        )
    )


def upsert_for_section(
    db: Session,
    *,
    section_id,
    teacher_external_id: str,
    teacher_full_name: str | None,
    assignment_type: str = "primary",
    source: str = "portal",
    active: bool = True,
) -> TeacherAssignment:
    assignment = get_assignment(
        db,
        section_id=section_id,
        teacher_external_id=teacher_external_id,
        assignment_type=assignment_type,
    )
    if assignment is None:
        assignment = TeacherAssignment(
            section_id=section_id,
            teacher_external_id=teacher_external_id,
            assignment_type=assignment_type,
        )
        db.add(assignment)

    assignment.teacher_full_name = teacher_full_name
    assignment.source = source
    assignment.active = active
    db.flush()
    return assignment


def deactivate_other_assignments(
    db: Session,
    *,
    section_id,
    keep_teacher_external_id: str,
    assignment_type: str,
) -> None:
    assignments = get_by_section_and_type(db, section_id=section_id, assignment_type=assignment_type)
    for assignment in assignments:
        assignment.active = assignment.teacher_external_id == keep_teacher_external_id
    db.flush()
