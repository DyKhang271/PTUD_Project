from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.models.academic_term import AcademicTerm
from app.models.course_section import CourseSection, CourseSectionStudent


def _apply_updates(model: object, values: dict) -> None:
    for key, value in values.items():
        setattr(model, key, value)


def create_term(db: Session, values: dict) -> AcademicTerm:
    term = AcademicTerm(**values)
    db.add(term)
    db.flush()
    return term


def list_terms(db: Session) -> list[AcademicTerm]:
    return list(db.scalars(select(AcademicTerm).order_by(AcademicTerm.start_date.desc().nullslast(), AcademicTerm.term_code)))


def get_term(db: Session, term_id: UUID) -> AcademicTerm | None:
    return db.get(AcademicTerm, term_id)


def get_term_by_code(db: Session, term_code: str) -> AcademicTerm | None:
    return db.scalar(select(AcademicTerm).where(AcademicTerm.term_code == term_code))


def update_term(db: Session, term: AcademicTerm, values: dict) -> AcademicTerm:
    _apply_updates(term, values)
    db.flush()
    return term


def create_section(db: Session, values: dict) -> CourseSection:
    section = CourseSection(**values)
    db.add(section)
    db.flush()
    return section


def list_sections(
    db: Session,
    *,
    term_id: UUID | None = None,
    teacher_external_id: str | None = None,
    student_external_id: str | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    status: str | None = None,
) -> list[CourseSection]:
    stmt = select(CourseSection).options(joinedload(CourseSection.term))
    if term_id:
        stmt = stmt.where(CourseSection.term_id == term_id)
    if teacher_external_id:
        stmt = stmt.where(CourseSection.teacher_external_id == teacher_external_id)
    if student_external_id:
        stmt = stmt.join(CourseSectionStudent).where(
            CourseSectionStudent.student_external_id == student_external_id,
            CourseSectionStudent.enrollment_status == "active",
        )
    if faculty:
        stmt = stmt.where(CourseSection.faculty == faculty)
    if program_name:
        stmt = stmt.where(CourseSection.program_name == program_name)
    if course_code:
        stmt = stmt.where(CourseSection.course_code == course_code)
    if status:
        stmt = stmt.where(CourseSection.status == status)
    stmt = stmt.order_by(CourseSection.course_code, CourseSection.section_code)
    return list(db.scalars(stmt).unique().all())


def get_section(db: Session, section_id: UUID) -> CourseSection | None:
    return db.get(CourseSection, section_id)


def get_section_by_term_and_code(db: Session, *, term_id: UUID, section_code: str) -> CourseSection | None:
    return db.scalar(
        select(CourseSection).where(
            CourseSection.term_id == term_id,
            CourseSection.section_code == section_code,
        )
    )


def update_section(db: Session, section: CourseSection, values: dict) -> CourseSection:
    _apply_updates(section, values)
    db.flush()
    return section


def delete_section(db: Session, section: CourseSection) -> None:
    db.delete(section)
    db.flush()


def add_student_to_section(
    db: Session, *, section_id: UUID, student_external_id: str, enrollment_status: str = "active"
) -> tuple[CourseSectionStudent, bool]:
    existing = db.scalar(
        select(CourseSectionStudent).where(
            CourseSectionStudent.section_id == section_id,
            CourseSectionStudent.student_external_id == student_external_id,
        )
    )
    if existing:
        existing.enrollment_status = enrollment_status
        db.flush()
        return existing, False
    enrollment = CourseSectionStudent(
        section_id=section_id,
        student_external_id=student_external_id,
        enrollment_status=enrollment_status,
    )
    db.add(enrollment)
    db.flush()
    return enrollment, True


def list_section_students(db: Session, section_id: UUID) -> list[CourseSectionStudent]:
    stmt = (
        select(CourseSectionStudent)
        .where(CourseSectionStudent.section_id == section_id)
        .order_by(CourseSectionStudent.student_external_id)
    )
    return list(db.scalars(stmt).all())


def is_student_in_section(db: Session, *, section_id: UUID, student_external_id: str) -> bool:
    return (
        db.scalar(
            select(CourseSectionStudent.id).where(
                CourseSectionStudent.section_id == section_id,
                CourseSectionStudent.student_external_id == student_external_id,
                CourseSectionStudent.enrollment_status == "active",
            )
        )
        is not None
    )
