from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.course_section import CourseSection
from app.repositories import attendance_repo
from app.schemas.report_schema import AttendanceDashboard, AttendanceGroupSummary, TopAbsentSection


def _attendance_percent(present: int, late: int, excused: int, total: int) -> float:
    return round(((present + late + excused) / total * 100), 2) if total else 100.0


def get_dashboard(db: Session) -> AttendanceDashboard:
    total_sections = attendance_repo.count_sections(db)
    total_sessions = attendance_repo.count_sessions(db)
    absent_count = attendance_repo.count_records_by_status(db, "absent")
    late_count = attendance_repo.count_records_by_status(db, "late")
    present_count = attendance_repo.count_records_by_status(db, "present")
    excused_count = attendance_repo.count_records_by_status(db, "excused")
    total_records = present_count + late_count + absent_count + excused_count

    top_rows = db.execute(
        select(
            CourseSection.id,
            CourseSection.section_code,
            CourseSection.course_name,
            func.count(AttendanceRecord.id).label("absent_count"),
        )
        .join(AttendanceSession, AttendanceSession.section_id == CourseSection.id)
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .where(AttendanceRecord.status == "absent")
        .group_by(CourseSection.id)
        .order_by(func.count(AttendanceRecord.id).desc())
        .limit(5)
    ).all()
    return AttendanceDashboard(
        total_sections=total_sections,
        total_sessions=total_sessions,
        average_attendance_percent=_attendance_percent(present_count, late_count, excused_count, total_records),
        absent_count=absent_count,
        late_count=late_count,
        top_absent_sections=[
            TopAbsentSection(section_id=row.id, section_code=row.section_code, course_name=row.course_name, absent_count=row.absent_count)
            for row in top_rows
        ],
    )


def summarize_by_section(db: Session) -> list[AttendanceGroupSummary]:
    return _summarize(db, CourseSection.section_code, CourseSection.course_name)


def summarize_by_course(db: Session) -> list[AttendanceGroupSummary]:
    return _summarize(db, CourseSection.course_code, CourseSection.course_name)


def summarize_by_faculty(db: Session) -> list[AttendanceGroupSummary]:
    return _summarize(db, CourseSection.faculty, CourseSection.faculty)


def _summarize(db: Session, key_column, name_column) -> list[AttendanceGroupSummary]:
    rows = db.execute(
        select(
            key_column.label("group_key"),
            name_column.label("group_name"),
            func.count(AttendanceRecord.id).label("total_records"),
            func.count(AttendanceRecord.id).filter(AttendanceRecord.status == "present").label("present_count"),
            func.count(AttendanceRecord.id).filter(AttendanceRecord.status == "late").label("late_count"),
            func.count(AttendanceRecord.id).filter(AttendanceRecord.status == "absent").label("absent_count"),
            func.count(AttendanceRecord.id).filter(AttendanceRecord.status == "excused").label("excused_count"),
            func.count(func.distinct(AttendanceSession.id)).label("total_sessions"),
        )
        .join(AttendanceSession, AttendanceSession.section_id == CourseSection.id)
        .join(AttendanceRecord, AttendanceRecord.session_id == AttendanceSession.id)
        .group_by(key_column, name_column)
        .order_by(key_column)
    ).all()
    return [
        AttendanceGroupSummary(
            group_key=str(row.group_key or "unknown"),
            group_name=row.group_name,
            total_sessions=row.total_sessions,
            total_records=row.total_records,
            present_count=row.present_count,
            late_count=row.late_count,
            absent_count=row.absent_count,
            excused_count=row.excused_count,
            attendance_percent=_attendance_percent(row.present_count, row.late_count, row.excused_count, row.total_records),
        )
        for row in rows
    ]
