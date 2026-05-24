from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from app.models.external_user import ExternalUserCache

from app.models.course_section import CourseSection, CourseSectionStudent
from app.models.timetable import ExamSchedule, TimetableEntry


def _apply_updates(model: object, values: dict) -> None:
    for key, value in values.items():
        setattr(model, key, value)


def create_timetable_entry(db: Session, values: dict) -> TimetableEntry:
    entry = TimetableEntry(**values)
    db.add(entry)
    db.flush()
    return entry


def list_timetable_entries(
    db: Session,
    *,
    section_id: UUID | None = None,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    statuses: list[str] | None = None,
) -> list[TimetableEntry]:
    stmt = select(TimetableEntry)
    if section_id:
        stmt = stmt.where(TimetableEntry.section_id == section_id)
    if term_id or faculty or program_name or course_code:
        stmt = stmt.join(CourseSection, CourseSection.id == TimetableEntry.section_id)
    if term_id:
        stmt = stmt.where(CourseSection.term_id == term_id)
    if faculty:
        stmt = stmt.where(CourseSection.faculty == faculty)
    if program_name:
        stmt = stmt.where(CourseSection.program_name == program_name)
    if course_code:
        stmt = stmt.where(CourseSection.course_code == course_code)
    if statuses:
        stmt = stmt.where(TimetableEntry.status.in_(statuses))
    stmt = stmt.order_by(TimetableEntry.day_of_week, TimetableEntry.start_period.nullslast(), TimetableEntry.start_time)
    return list(db.scalars(stmt).all())


def list_timetable_entries_with_sections(
    db: Session,
    *,
    section_id: UUID | None = None,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    statuses: list[str] | None = None,
    q: str | None = None,
) -> list[tuple[TimetableEntry, CourseSection]]:
    stmt = select(TimetableEntry, CourseSection).join(CourseSection, CourseSection.id == TimetableEntry.section_id)
    normalized_q = str(q or "").strip()
    if normalized_q:
        like_pattern = f"%{normalized_q}%"
        stmt = stmt.outerjoin(
            ExternalUserCache,
            (ExternalUserCache.external_user_id == CourseSection.teacher_external_id) & (ExternalUserCache.role == "teacher"),
        ).where(
            or_(
                CourseSection.course_name.ilike(like_pattern),
                CourseSection.course_code.ilike(like_pattern),
                CourseSection.section_code.ilike(like_pattern),
                TimetableEntry.room.ilike(like_pattern),
                TimetableEntry.location.ilike(like_pattern),
                ExternalUserCache.full_name.ilike(like_pattern),
            )
        )
    if section_id:
        stmt = stmt.where(TimetableEntry.section_id == section_id)
    if term_id:
        stmt = stmt.where(CourseSection.term_id == term_id)
    if faculty:
        stmt = stmt.where(CourseSection.faculty == faculty)
    if program_name:
        stmt = stmt.where(CourseSection.program_name == program_name)
    if course_code:
        stmt = stmt.where(CourseSection.course_code == course_code)
    if statuses:
        stmt = stmt.where(TimetableEntry.status.in_(statuses))
    stmt = stmt.order_by(
        CourseSection.faculty.nullslast(),
        CourseSection.program_name.nullslast(),
        CourseSection.course_code,
        CourseSection.section_code,
        TimetableEntry.day_of_week,
        TimetableEntry.start_period.nullslast(),
        TimetableEntry.start_time,
    )
    return list(db.execute(stmt).all())


def get_timetable_entry(db: Session, entry_id: UUID) -> TimetableEntry | None:
    return db.get(TimetableEntry, entry_id)


def update_timetable_entry(db: Session, entry: TimetableEntry, values: dict) -> TimetableEntry:
    _apply_updates(entry, values)
    db.flush()
    return entry


def delete_timetable_entry(db: Session, entry: TimetableEntry) -> None:
    db.delete(entry)
    db.flush()


def list_student_timetable_entries(
    db: Session,
    *,
    student_external_id: str,
    term_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    statuses: list[str] | None = None,
) -> list[tuple[TimetableEntry, CourseSection]]:
    stmt = (
        select(TimetableEntry, CourseSection)
        .join(CourseSection, CourseSection.id == TimetableEntry.section_id)
        .join(CourseSectionStudent, CourseSectionStudent.section_id == CourseSection.id)
        .where(
            CourseSectionStudent.student_external_id == student_external_id,
            CourseSectionStudent.enrollment_status == "active",
        )
    )
    if term_id:
        stmt = stmt.where(CourseSection.term_id == term_id)
    if date_from:
        stmt = stmt.where((TimetableEntry.valid_to.is_(None)) | (TimetableEntry.valid_to >= date_from))
    if date_to:
        stmt = stmt.where((TimetableEntry.valid_from.is_(None)) | (TimetableEntry.valid_from <= date_to))
    if statuses:
        stmt = stmt.where(TimetableEntry.status.in_(statuses))
    stmt = stmt.order_by(TimetableEntry.day_of_week, TimetableEntry.start_period.nullslast(), TimetableEntry.start_time)
    return list(db.execute(stmt).all())


def list_teacher_timetable_entries(
    db: Session,
    *,
    teacher_external_id: str,
    term_id: UUID | None = None,
    day_of_week: int | None = None,
    active_on: date | None = None,
    statuses: list[str] | None = None,
) -> list[tuple[TimetableEntry, CourseSection, int]]:
    active_student_count = func.count(CourseSectionStudent.id).filter(CourseSectionStudent.enrollment_status == "active")
    stmt = (
        select(TimetableEntry, CourseSection, active_student_count.label("student_count"))
        .join(CourseSection, CourseSection.id == TimetableEntry.section_id)
        .outerjoin(CourseSectionStudent, CourseSectionStudent.section_id == CourseSection.id)
        .where(CourseSection.teacher_external_id == teacher_external_id)
        .group_by(TimetableEntry.id, CourseSection.id)
    )
    if term_id:
        stmt = stmt.where(CourseSection.term_id == term_id)
    if day_of_week:
        stmt = stmt.where(TimetableEntry.day_of_week == day_of_week)
    if active_on:
        stmt = stmt.where((TimetableEntry.valid_from.is_(None)) | (TimetableEntry.valid_from <= active_on))
        stmt = stmt.where((TimetableEntry.valid_to.is_(None)) | (TimetableEntry.valid_to >= active_on))
    if statuses:
        stmt = stmt.where(TimetableEntry.status.in_(statuses))
    stmt = stmt.order_by(TimetableEntry.day_of_week, TimetableEntry.start_period.nullslast(), TimetableEntry.start_time)
    return list(db.execute(stmt).all())


def create_exam_schedule(db: Session, values: dict) -> ExamSchedule:
    exam = ExamSchedule(**values)
    db.add(exam)
    db.flush()
    return exam


def list_exam_schedules(db: Session, *, section_id: UUID | None = None) -> list[ExamSchedule]:
    stmt = select(ExamSchedule)
    if section_id:
        stmt = stmt.where(ExamSchedule.section_id == section_id)
    stmt = stmt.order_by(ExamSchedule.exam_date, ExamSchedule.start_time)
    return list(db.scalars(stmt).all())


def list_exam_schedules_with_sections(
    db: Session,
    *,
    section_id: UUID | None = None,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    statuses: list[str] | None = None,
    q: str | None = None,
) -> list[tuple[ExamSchedule, CourseSection]]:
    stmt = select(ExamSchedule, CourseSection).join(CourseSection, CourseSection.id == ExamSchedule.section_id)
    normalized_q = str(q or "").strip()
    if normalized_q:
        like_pattern = f"%{normalized_q}%"
        stmt = stmt.outerjoin(
            ExternalUserCache,
            (ExternalUserCache.external_user_id == CourseSection.teacher_external_id) & (ExternalUserCache.role == "teacher"),
        ).where(
            or_(
                CourseSection.course_name.ilike(like_pattern),
                CourseSection.course_code.ilike(like_pattern),
                CourseSection.section_code.ilike(like_pattern),
                ExamSchedule.room.ilike(like_pattern),
                ExamSchedule.location.ilike(like_pattern),
                ExternalUserCache.full_name.ilike(like_pattern),
            )
        )
    if section_id:
        stmt = stmt.where(ExamSchedule.section_id == section_id)
    if term_id:
        stmt = stmt.where(CourseSection.term_id == term_id)
    if faculty:
        stmt = stmt.where(CourseSection.faculty == faculty)
    if program_name:
        stmt = stmt.where(CourseSection.program_name == program_name)
    if course_code:
        stmt = stmt.where(CourseSection.course_code == course_code)
    if statuses:
        stmt = stmt.where(ExamSchedule.status.in_(statuses))
    stmt = stmt.order_by(
        CourseSection.faculty.nullslast(),
        CourseSection.program_name.nullslast(),
        CourseSection.course_code,
        CourseSection.section_code,
        ExamSchedule.exam_date,
        ExamSchedule.start_time,
    )
    return list(db.execute(stmt).all())


def list_student_exam_schedules(db: Session, student_external_id: str) -> list[ExamSchedule]:
    stmt = (
        select(ExamSchedule)
        .join(CourseSection, CourseSection.id == ExamSchedule.section_id)
        .join(CourseSectionStudent, CourseSectionStudent.section_id == CourseSection.id)
        .where(
            CourseSectionStudent.student_external_id == student_external_id,
            CourseSectionStudent.enrollment_status == "active",
        )
        .order_by(ExamSchedule.exam_date, ExamSchedule.start_time)
    )
    return list(db.scalars(stmt).all())


def list_student_exam_schedules_with_sections(
    db: Session,
    student_external_id: str,
) -> list[tuple[ExamSchedule, CourseSection]]:
    stmt = (
        select(ExamSchedule, CourseSection)
        .join(CourseSection, CourseSection.id == ExamSchedule.section_id)
        .join(CourseSectionStudent, CourseSectionStudent.section_id == CourseSection.id)
        .where(
            CourseSectionStudent.student_external_id == student_external_id,
            CourseSectionStudent.enrollment_status == "active",
        )
        .order_by(ExamSchedule.exam_date, ExamSchedule.start_time, CourseSection.section_code)
    )
    return list(db.execute(stmt).all())


def get_exam_schedule(db: Session, exam_id: UUID) -> ExamSchedule | None:
    return db.get(ExamSchedule, exam_id)


def update_exam_schedule(db: Session, exam: ExamSchedule, values: dict) -> ExamSchedule:
    _apply_updates(exam, values)
    db.flush()
    return exam


def delete_exam_schedule(db: Session, exam: ExamSchedule) -> None:
    db.delete(exam)
    db.flush()
