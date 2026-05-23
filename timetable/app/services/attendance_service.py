from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.dependencies import CurrentUser
from app.core.security import generate_checkin_code, generate_qr_token, hash_secret, utc_now, verify_secret
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.timetable import TimetableEntry
from app.repositories import attendance_repo, external_user_repo, policy_repo, section_repo
from app.schemas.attendance_schema import AttendanceRecordRead, AttendanceSummaryItem, OpenAttendanceSessionResponse
from app.services.section_service import get_section_or_404

VALID_ATTENDANCE_STATUSES = {"present", "late", "absent", "excused"}


def _ensure_teacher_can_access_section(db: Session, section_id: UUID, current_user: CurrentUser) -> None:
    section = get_section_or_404(db, section_id)
    if current_user.role == "admin":
        return
    if current_user.role != "teacher" or section.teacher_external_id != current_user.external_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teacher does not own this section")


def _ensure_teacher_can_access_session(db: Session, session: AttendanceSession, current_user: CurrentUser) -> None:
    _ensure_teacher_can_access_section(db, session.section_id, current_user)


def create_session(db: Session, *, section_id: UUID, values: dict, current_user: CurrentUser) -> AttendanceSession:
    _ensure_teacher_can_access_section(db, section_id, current_user)
    timetable_entry_id = values.get("timetable_entry_id")
    session_date = values.get("session_date")
    start_time_value = values.get("start_time")
    if timetable_entry_id and session_date:
        existing_session = attendance_repo.get_attendance_session_by_timetable_entry(
            db,
            timetable_entry_id=timetable_entry_id,
            session_date=session_date,
        )
        if existing_session is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attendance session already exists for timetable entry")
    if session_date and start_time_value:
        existing_section_session = attendance_repo.get_section_session_by_date_and_start_time(
            db,
            section_id=section_id,
            session_date=session_date,
            start_time=start_time_value,
        )
        if existing_section_session is not None:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Attendance session already exists for this section and time")
    session = attendance_repo.create_attendance_session(
        db,
        {
            **values,
            "section_id": section_id,
            "status": "draft",
            "created_by_external_id": current_user.external_id,
        },
    )
    attendance_repo.add_default_absent_records(db, session_id=session.id, section_id=section_id)
    db.commit()
    return session


def open_session(db: Session, *, session_id: UUID, current_user: CurrentUser) -> OpenAttendanceSessionResponse:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_can_access_session(db, session, current_user)
    if session.status in {"cancelled", "locked"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session cannot be opened")

    code = generate_checkin_code()
    qr_token = generate_qr_token()
    now = utc_now()
    expires_at = now + timedelta(minutes=get_settings().checkin_expire_minutes)
    session.status = "open"
    session.opened_at = now
    session.closed_at = None
    session.checkin_expires_at = expires_at
    session.checkin_code_hash = hash_secret(code)
    session.qr_token_hash = hash_secret(qr_token)
    db.commit()
    db.refresh(session)
    return OpenAttendanceSessionResponse(session=session, checkin_code=code, qr_token=qr_token, expires_at=expires_at)


def refresh_qr(db: Session, *, session_id: UUID, current_user: CurrentUser) -> OpenAttendanceSessionResponse:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_can_access_session(db, session, current_user)
    if session.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only open sessions can refresh QR")
    code = generate_checkin_code()
    qr_token = generate_qr_token()
    expires_at = utc_now() + timedelta(minutes=get_settings().checkin_expire_minutes)
    session.checkin_code_hash = hash_secret(code)
    session.qr_token_hash = hash_secret(qr_token)
    session.checkin_expires_at = expires_at
    db.commit()
    db.refresh(session)
    return OpenAttendanceSessionResponse(session=session, checkin_code=code, qr_token=qr_token, expires_at=expires_at)


def close_session(db: Session, *, session_id: UUID, current_user: CurrentUser) -> AttendanceSession:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_can_access_session(db, session, current_user)
    if session.status in {"cancelled", "locked"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session cannot be closed")
    session.status = "closed"
    session.closed_at = utc_now()
    db.commit()
    db.refresh(session)
    return session


def check_in_with_code(
    db: Session,
    *,
    session_id: UUID,
    code: str,
    student_external_id: str,
    ip_address: str | None = None,
    device_info: dict | None = None,
) -> AttendanceRecord:
    session = _get_session_or_404(db, session_id)
    if not verify_secret(code, session.checkin_code_hash):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid check-in code")
    return _check_in(db, session=session, student_external_id=student_external_id, method="code", ip_address=ip_address, device_info=device_info)


def check_in_with_qr(
    db: Session,
    *,
    qr_token: str,
    student_external_id: str,
    ip_address: str | None = None,
    device_info: dict | None = None,
) -> AttendanceRecord:
    session = attendance_repo.get_open_session_by_qr_hash(db, hash_secret(qr_token))
    if session is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid QR token")
    return _check_in(db, session=session, student_external_id=student_external_id, method="qr", ip_address=ip_address, device_info=device_info)


def update_record_manual(
    db: Session,
    *,
    session_id: UUID,
    student_external_id: str,
    status_value: str,
    note: str | None,
    current_user: CurrentUser,
) -> AttendanceRecord:
    if status_value not in VALID_ATTENDANCE_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid attendance status")
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_can_access_session(db, session, current_user)
    if not section_repo.is_student_in_section(db, section_id=session.section_id, student_external_id=student_external_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student is not enrolled in this section")
    record = attendance_repo.upsert_attendance_record(
        db,
        session_id=session.id,
        student_external_id=student_external_id,
        values={
            "status": status_value,
            "method": "manual",
            "note": note,
            "updated_by_external_id": current_user.external_id,
            "updated_at": utc_now(),
        },
    )
    db.commit()
    db.refresh(record)
    return record


def update_record_manual_by_id(
    db: Session,
    *,
    record_id: UUID,
    status_value: str,
    note: str | None,
    current_user: CurrentUser,
) -> AttendanceRecord:
    if status_value not in VALID_ATTENDANCE_STATUSES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid attendance status")
    record = attendance_repo.get_attendance_record_by_id(db, record_id)
    if record is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
    return update_record_manual(
        db,
        session_id=record.session_id,
        student_external_id=record.student_external_id,
        status_value=status_value,
        note=note,
        current_user=current_user,
    )


def list_session_records_enriched(db: Session, *, session_id: UUID, current_user: CurrentUser) -> list[AttendanceRecordRead]:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_can_access_session(db, session, current_user)
    records = attendance_repo.list_session_records(db, session_id)
    cached = external_user_repo.get_cached_users(db, [record.student_external_id for record in records], role="student")
    return [
        AttendanceRecordRead(
            id=record.id,
            session_id=record.session_id,
            student_external_id=record.student_external_id,
            status=record.status,
            checkin_time=record.checkin_time,
            method=record.method,
            device_info=record.device_info,
            ip_address=record.ip_address,
            note=record.note,
            updated_by_external_id=record.updated_by_external_id,
            updated_at=record.updated_at,
            full_name=cached.get(record.student_external_id).full_name if cached.get(record.student_external_id) else None,
        )
        for record in records
    ]


def get_session_detail(db: Session, *, session_id: UUID, current_user: CurrentUser) -> AttendanceSession:
    session = _get_session_or_404(db, session_id)
    _ensure_teacher_can_access_session(db, session, current_user)
    return session


def get_student_attendance_summary(db: Session, student_external_id: str) -> list[AttendanceSummaryItem]:
    sections = section_repo.list_sections(db, student_external_id=student_external_id)
    history = attendance_repo.list_student_attendance_history(db, student_external_id)
    by_section: dict[UUID, list[AttendanceRecord]] = {}
    for record, _, section in history:
        by_section.setdefault(section.id, []).append(record)
    return [_build_summary_for_records(db, section, by_section.get(section.id, [])) for section in sections]


def get_section_attendance_summary(db: Session, section_id: UUID) -> list[AttendanceSummaryItem]:
    section = get_section_or_404(db, section_id)
    students = section_repo.list_section_students(db, section_id)
    cached = external_user_repo.get_cached_users(db, [student.student_external_id for student in students], role="student")
    summaries: list[AttendanceSummaryItem] = []
    for enrollment in students:
        records = [
            record
            for record, _, _ in attendance_repo.list_student_attendance_history(db, enrollment.student_external_id)
            if record.session.section_id == section_id
        ]
        cached_user = cached.get(enrollment.student_external_id)
        summary = _build_summary_for_records(
            db,
            section,
            records,
            student_external_id=enrollment.student_external_id,
            full_name=cached_user.full_name if cached_user else None,
        )
        summaries.append(summary)
    return summaries


def open_session_for_timetable_entry(
    db: Session,
    *,
    entry: TimetableEntry,
    current_user: CurrentUser,
    session_date: date | None = None,
) -> OpenAttendanceSessionResponse:
    _ensure_teacher_can_access_section(db, entry.section_id, current_user)
    today = session_date or utc_now().date()
    if entry.status == "cancelled":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timetable entry is cancelled")
    if entry.day_of_week != today.weekday() + 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timetable entry is not scheduled for today")
    if entry.valid_from and today < entry.valid_from:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timetable entry is not active yet")
    if entry.valid_to and today > entry.valid_to:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Timetable entry has expired")

    session = attendance_repo.get_attendance_session_by_timetable_entry(
        db,
        timetable_entry_id=entry.id,
        session_date=today,
    )
    if session is None:
        session = attendance_repo.create_attendance_session(
            db,
            {
                "section_id": entry.section_id,
                "timetable_entry_id": entry.id,
                "session_date": today,
                "start_time": entry.start_time,
                "end_time": entry.end_time,
                "status": "draft",
                "created_by_external_id": current_user.external_id,
                "note": "Opened from timetable entry",
            },
        )
        attendance_repo.add_default_absent_records(db, session_id=session.id, section_id=entry.section_id)
        db.flush()
    else:
        existing_count = len(attendance_repo.list_session_records(db, session.id))
        if existing_count == 0:
            attendance_repo.add_default_absent_records(db, session_id=session.id, section_id=entry.section_id)
            db.flush()
    return open_session(db, session_id=session.id, current_user=current_user)


def _get_session_or_404(db: Session, session_id: UUID) -> AttendanceSession:
    session = attendance_repo.get_attendance_session(db, session_id)
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance session not found")
    return session


def _check_in(
    db: Session,
    *,
    session: AttendanceSession,
    student_external_id: str,
    method: str,
    ip_address: str | None,
    device_info: dict | None,
) -> AttendanceRecord:
    if session.status != "open":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Attendance session is not open")
    now = utc_now()
    if session.checkin_expires_at and now > session.checkin_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Check-in token has expired")
    if not section_repo.is_student_in_section(db, section_id=session.section_id, student_external_id=student_external_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Student is not enrolled in this section")

    existing = attendance_repo.get_attendance_record(db, session_id=session.id, student_external_id=student_external_id)
    if existing and existing.status in {"present", "late", "excused"}:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Student already checked in")

    section = get_section_or_404(db, session.section_id)
    policy = policy_repo.resolve_policy(db, section_id=section.id, course_code=section.course_code, faculty=section.faculty)
    allow_late_minutes = policy.allow_late_minutes if policy else 15
    late_after = (session.opened_at or now) + timedelta(minutes=allow_late_minutes)
    status_value = "late" if now > late_after else "present"
    record = attendance_repo.upsert_attendance_record(
        db,
        session_id=session.id,
        student_external_id=student_external_id,
        values={
            "status": status_value,
            "checkin_time": now,
            "method": method,
            "ip_address": ip_address,
            "device_info": device_info,
            "updated_by_external_id": student_external_id,
            "updated_at": now,
        },
    )
    db.commit()
    db.refresh(record)
    return record


def _build_summary_for_records(
    db: Session,
    section,
    records: list[AttendanceRecord],
    *,
    student_external_id: str | None = None,
    full_name: str | None = None,
) -> AttendanceSummaryItem:
    total = len(records)
    present = sum(1 for record in records if record.status == "present")
    late = sum(1 for record in records if record.status == "late")
    absent = sum(1 for record in records if record.status == "absent")
    excused = sum(1 for record in records if record.status == "excused")
    attendance_percent = round(((present + late + excused) / total * 100), 2) if total else 100.0
    policy = policy_repo.resolve_policy(db, section_id=section.id, course_code=section.course_code, faculty=section.faculty)
    warning_threshold = float(policy.warning_threshold_percent) if policy and policy.warning_threshold_percent is not None else 80.0
    warning_status = "warning" if attendance_percent < warning_threshold else "ok"
    return AttendanceSummaryItem(
        student_external_id=student_external_id,
        full_name=full_name,
        section_id=section.id,
        course_code=section.course_code,
        course_name=section.course_name,
        section_code=section.section_code,
        total_sessions=total,
        present_count=present,
        late_count=late,
        absent_count=absent,
        excused_count=excused,
        attendance_percent=attendance_percent,
        warning_status=warning_status,
    )
