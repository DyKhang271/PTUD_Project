from __future__ import annotations

from datetime import date
from uuid import UUID

from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.course_section import CourseSection, CourseSectionStudent


def create_attendance_session(db: Session, values: dict) -> AttendanceSession:
    session = AttendanceSession(**values)
    db.add(session)
    db.flush()
    return session


def get_attendance_session(db: Session, session_id: UUID) -> AttendanceSession | None:
    return db.get(AttendanceSession, session_id)


def get_attendance_session_by_timetable_entry(
    db: Session,
    *,
    timetable_entry_id: UUID,
    session_date: date,
) -> AttendanceSession | None:
    return db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.timetable_entry_id == timetable_entry_id,
            AttendanceSession.session_date == session_date,
        )
    )


def get_section_session_by_date_and_start_time(
    db: Session,
    *,
    section_id: UUID,
    session_date: date,
    start_time,
) -> AttendanceSession | None:
    return db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.section_id == section_id,
            AttendanceSession.session_date == session_date,
            AttendanceSession.start_time == start_time,
        )
    )


def list_section_sessions(db: Session, section_id: UUID) -> list[AttendanceSession]:
    stmt = (
        select(AttendanceSession)
        .where(AttendanceSession.section_id == section_id)
        .order_by(AttendanceSession.session_date.desc(), AttendanceSession.start_time.desc().nullslast())
    )
    return list(db.scalars(stmt).all())


def get_open_session_by_qr_hash(db: Session, qr_token_hash: str) -> AttendanceSession | None:
    return db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.qr_token_hash == qr_token_hash,
            AttendanceSession.status == "open",
        )
    )


def add_default_absent_records(db: Session, *, session_id: UUID, section_id: UUID) -> int:
    student_ids = db.scalars(
        select(CourseSectionStudent.student_external_id).where(
            CourseSectionStudent.section_id == section_id,
            CourseSectionStudent.enrollment_status == "active",
        )
    ).all()
    for student_external_id in student_ids:
        db.add(
            AttendanceRecord(
                session_id=session_id,
                student_external_id=student_external_id,
                status="absent",
                method="import",
            )
        )
    db.flush()
    return len(student_ids)


def get_attendance_record(db: Session, *, session_id: UUID, student_external_id: str) -> AttendanceRecord | None:
    return db.scalar(
        select(AttendanceRecord).where(
            AttendanceRecord.session_id == session_id,
            AttendanceRecord.student_external_id == student_external_id,
        )
    )


def get_attendance_record_by_id(db: Session, record_id: UUID) -> AttendanceRecord | None:
    return db.get(AttendanceRecord, record_id)


def upsert_attendance_record(
    db: Session,
    *,
    session_id: UUID,
    student_external_id: str,
    values: dict,
) -> AttendanceRecord:
    record = get_attendance_record(db, session_id=session_id, student_external_id=student_external_id)
    if record is None:
        record = AttendanceRecord(session_id=session_id, student_external_id=student_external_id)
        db.add(record)
    for key, value in values.items():
        setattr(record, key, value)
    db.flush()
    return record


def list_session_records(db: Session, session_id: UUID) -> list[AttendanceRecord]:
    stmt = select(AttendanceRecord).where(AttendanceRecord.session_id == session_id).order_by(AttendanceRecord.student_external_id)
    return list(db.scalars(stmt).all())


def list_student_attendance_history(db: Session, student_external_id: str) -> list[tuple[AttendanceRecord, AttendanceSession, CourseSection]]:
    stmt = (
        select(AttendanceRecord, AttendanceSession, CourseSection)
        .join(AttendanceSession, AttendanceSession.id == AttendanceRecord.session_id)
        .join(CourseSection, CourseSection.id == AttendanceSession.section_id)
        .where(AttendanceRecord.student_external_id == student_external_id)
        .order_by(AttendanceSession.session_date.desc(), AttendanceSession.start_time.desc().nullslast())
    )
    return list(db.execute(stmt).all())


def section_attendance_counts_stmt(section_id: UUID | None = None) -> Select:
    stmt = (
        select(
            CourseSection.id.label("section_id"),
            CourseSection.course_code,
            CourseSection.course_name,
            CourseSection.section_code,
            func.count(AttendanceRecord.id).label("total_records"),
            func.count(func.nullif(AttendanceRecord.status != "present", True)).label("present_count"),
            func.count(func.nullif(AttendanceRecord.status != "late", True)).label("late_count"),
            func.count(func.nullif(AttendanceRecord.status != "absent", True)).label("absent_count"),
            func.count(func.nullif(AttendanceRecord.status != "excused", True)).label("excused_count"),
        )
        .join(AttendanceSession, AttendanceSession.section_id == CourseSection.id)
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .group_by(CourseSection.id)
    )
    if section_id:
        stmt = stmt.where(CourseSection.id == section_id)
    return stmt


def count_sections(db: Session) -> int:
    return int(db.scalar(select(func.count(CourseSection.id))) or 0)


def count_sessions(db: Session) -> int:
    return int(db.scalar(select(func.count(AttendanceSession.id))) or 0)


def count_records_by_status(db: Session, status: str) -> int:
    return int(db.scalar(select(func.count(AttendanceRecord.id)).where(AttendanceRecord.status == status)) or 0)
