from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_role
from app.repositories import attendance_repo, section_repo, timetable_repo
from app.schemas.attendance_schema import (
    AttendanceHistoryItem,
    AttendanceRecordRead,
    AttendanceSummaryItem,
    CheckInCodeRequest,
    CheckInQrRequest,
)
from app.schemas.section_schema import CourseSectionRead
from app.schemas.timetable_schema import ExamScheduleRead, StudentTimetableItem
from app.services import attendance_service, timetable_service

router = APIRouter(prefix="/student", tags=["student"])
StudentUser = Annotated[CurrentUser, Depends(require_role(["student"]))]


@router.get("/me/sections", response_model=list[CourseSectionRead])
def my_sections(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list:
    return section_repo.list_sections(db, student_external_id=current_user.external_id)


@router.get("/sections", response_model=list[CourseSectionRead], include_in_schema=False)
def my_sections_alias(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list:
    return my_sections(current_user=current_user, db=db)


@router.get("/timetable", response_model=list[StudentTimetableItem])
def my_timetable(
    current_user: StudentUser,
    db: Annotated[Session, Depends(get_db)],
    term_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StudentTimetableItem]:
    return timetable_service.get_student_timetable(
        db,
        student_external_id=current_user.external_id,
        term_id=term_id,
        date_from=date_from,
        date_to=date_to,
    )


@router.get("/me/timetable", response_model=list[StudentTimetableItem], include_in_schema=False)
def my_timetable_legacy(
    current_user: StudentUser,
    db: Annotated[Session, Depends(get_db)],
    term_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StudentTimetableItem]:
    return my_timetable(current_user=current_user, db=db, term_id=term_id, date_from=date_from, date_to=date_to)


@router.get("/exams", response_model=list[ExamScheduleRead])
def my_exams(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list:
    return timetable_repo.list_student_exam_schedules(db, current_user.external_id)


@router.get("/me/exams", response_model=list[ExamScheduleRead], include_in_schema=False)
def my_exams_legacy(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list:
    return my_exams(current_user=current_user, db=db)


@router.get("/attendance", response_model=list[AttendanceHistoryItem])
def my_attendance(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list[AttendanceHistoryItem]:
    rows = attendance_repo.list_student_attendance_history(db, current_user.external_id)
    return [
        AttendanceHistoryItem(
            session_id=session.id,
            section_id=section.id,
            course_code=section.course_code,
            course_name=section.course_name,
            section_code=section.section_code,
            session_date=session.session_date,
            start_time=session.start_time,
            end_time=session.end_time,
            status=record.status,
            checkin_time=record.checkin_time,
            method=record.method,
            note=record.note,
        )
        for record, session, section in rows
    ]


@router.get("/attendance-history", response_model=list[AttendanceHistoryItem])
def my_attendance_history(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list[AttendanceHistoryItem]:
    return my_attendance(current_user=current_user, db=db)


@router.get("/me/attendance", response_model=list[AttendanceHistoryItem], include_in_schema=False)
def my_attendance_legacy(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list[AttendanceHistoryItem]:
    return my_attendance(current_user=current_user, db=db)


@router.get("/me/attendance-history", response_model=list[AttendanceHistoryItem], include_in_schema=False)
def my_attendance_history_legacy(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list[AttendanceHistoryItem]:
    return my_attendance(current_user=current_user, db=db)


@router.get("/attendance/summary", response_model=list[AttendanceSummaryItem])
def my_attendance_summary(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list[AttendanceSummaryItem]:
    return attendance_service.get_student_attendance_summary(db, current_user.external_id)


@router.get("/me/attendance/summary", response_model=list[AttendanceSummaryItem], include_in_schema=False)
def my_attendance_summary_legacy(current_user: StudentUser, db: Annotated[Session, Depends(get_db)]) -> list[AttendanceSummaryItem]:
    return my_attendance_summary(current_user=current_user, db=db)


@router.post("/check-in/code", response_model=AttendanceRecordRead)
def check_in_code(
    payload: CheckInCodeRequest,
    current_user: StudentUser,
    db: Annotated[Session, Depends(get_db)],
    request: Request,
):
    return attendance_service.check_in_with_code(
        db,
        session_id=payload.session_id,
        code=payload.code,
        student_external_id=current_user.external_id,
        ip_address=request.client.host if request.client else None,
    )


@router.post("/me/check-in/code", response_model=AttendanceRecordRead, include_in_schema=False)
def check_in_code_legacy(
    payload: CheckInCodeRequest,
    current_user: StudentUser,
    db: Annotated[Session, Depends(get_db)],
    request: Request,
):
    return check_in_code(payload=payload, current_user=current_user, db=db, request=request)


@router.post("/check-in/qr", response_model=AttendanceRecordRead)
def check_in_qr(
    payload: CheckInQrRequest,
    current_user: StudentUser,
    db: Annotated[Session, Depends(get_db)],
    request: Request,
):
    return attendance_service.check_in_with_qr(
        db,
        qr_token=payload.qr_token,
        student_external_id=current_user.external_id,
        ip_address=request.client.host if request.client else None,
    )


@router.post("/me/check-in/qr", response_model=AttendanceRecordRead, include_in_schema=False)
def check_in_qr_legacy(
    payload: CheckInQrRequest,
    current_user: StudentUser,
    db: Annotated[Session, Depends(get_db)],
    request: Request,
):
    return check_in_qr(payload=payload, current_user=current_user, db=db, request=request)
