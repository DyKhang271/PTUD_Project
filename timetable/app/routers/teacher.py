from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import CurrentUser, ensure_teacher_owns_section, require_role
from app.models.course_section import CourseSection
from app.repositories import section_repo, timetable_repo
from app.schemas.attendance_schema import (
    AttendanceRecordRead,
    AttendanceRecordUpdate,
    AttendanceSessionCreate,
    AttendanceSessionCreateForSection,
    AttendanceSessionRead,
    AttendanceSummaryItem,
    OpenAttendanceSessionResponse,
)
from app.schemas.section_schema import CourseSectionRead, SectionStudentRead
from app.schemas.timetable_schema import TeacherTimetableItem, TimetableEntryRead
from app.services import attendance_service, section_service, timetable_service
router = APIRouter(prefix="/teacher", tags=["teacher"])
TeacherUser = Annotated[CurrentUser, Depends(require_role(["teacher"]))]
TeacherOrAdminUser = Annotated[CurrentUser, Depends(require_role(["teacher", "admin"]))]


@router.get("/me/sections", response_model=list[CourseSectionRead])
def my_sections(current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]) -> list:
    return section_repo.list_sections(db, teacher_external_id=current_user.external_id)


@router.get("/sections", response_model=list[CourseSectionRead])
def my_sections_alias(current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]) -> list:
    return my_sections(current_user=current_user, db=db)


@router.get("/sections/{section_id}", response_model=CourseSectionRead)
def section_detail(section: Annotated[CourseSection, Depends(ensure_teacher_owns_section)]) -> CourseSection:
    return section


@router.get("/sections/{section_id}/students", response_model=list[SectionStudentRead])
def section_students(
    section: Annotated[CourseSection, Depends(ensure_teacher_owns_section)],
    db: Annotated[Session, Depends(get_db)],
) -> list[SectionStudentRead]:
    return section_service.list_section_students_enriched(db, section.id)


@router.get("/sections/{section_id}/timetable", response_model=list[TimetableEntryRead])
def section_timetable(
    section: Annotated[CourseSection, Depends(ensure_teacher_owns_section)],
    db: Annotated[Session, Depends(get_db)],
) -> list:
    return timetable_repo.list_timetable_entries(db, section_id=section.id)


@router.get("/timetable", response_model=list[TeacherTimetableItem])
def my_timetable(current_user: TeacherUser, db: Annotated[Session, Depends(get_db)], term_id: UUID | None = None):
    return timetable_service.get_teacher_timetable(db, teacher_external_id=current_user.external_id, term_id=term_id)


@router.get("/today-classes", response_model=list[TeacherTimetableItem])
def my_today_classes(current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.get_teacher_today_classes(
        db,
        teacher_external_id=current_user.external_id,
        today=datetime.now().astimezone().date(),
    )


@router.post("/sections/{section_id}/attendance-sessions", response_model=AttendanceSessionRead)
def create_attendance_session(
    section_id: UUID,
    payload: AttendanceSessionCreate,
    current_user: TeacherUser,
    db: Annotated[Session, Depends(get_db)],
):
    return attendance_service.create_session(
        db,
        section_id=section_id,
        values=payload.model_dump(exclude_unset=True),
        current_user=current_user,
    )


@router.post("/attendance-sessions", response_model=AttendanceSessionRead)
def create_attendance_session_alias(
    payload: AttendanceSessionCreateForSection,
    current_user: TeacherUser,
    db: Annotated[Session, Depends(get_db)],
):
    return attendance_service.create_session(
        db,
        section_id=payload.section_id,
        values=payload.model_dump(exclude={"section_id"}, exclude_unset=True),
        current_user=current_user,
    )


@router.get("/attendance-sessions/{session_id}", response_model=AttendanceSessionRead)
def attendance_session_detail(session_id: UUID, current_user: TeacherOrAdminUser, db: Annotated[Session, Depends(get_db)]):
    return attendance_service.get_session_detail(db, session_id=session_id, current_user=current_user)


@router.post("/attendance-sessions/{session_id}/open", response_model=OpenAttendanceSessionResponse)
def open_attendance_session(session_id: UUID, current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]):
    return attendance_service.open_session(db, session_id=session_id, current_user=current_user)


@router.post("/timetable-entries/{entry_id}/attendance/open", response_model=OpenAttendanceSessionResponse)
def open_attendance_for_timetable_entry(
    entry_id: UUID,
    current_user: TeacherUser,
    db: Annotated[Session, Depends(get_db)],
):
    entry = timetable_repo.get_timetable_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable entry not found")
    return attendance_service.open_session_for_timetable_entry(db, entry=entry, current_user=current_user)


@router.post("/attendance-sessions/{session_id}/refresh-qr", response_model=OpenAttendanceSessionResponse)
def refresh_attendance_qr(session_id: UUID, current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]):
    return attendance_service.refresh_qr(db, session_id=session_id, current_user=current_user)


@router.post("/attendance-sessions/{session_id}/close", response_model=AttendanceSessionRead)
def close_attendance_session(session_id: UUID, current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]):
    return attendance_service.close_session(db, session_id=session_id, current_user=current_user)


@router.patch("/attendance-sessions/{session_id}/close", response_model=AttendanceSessionRead)
def close_attendance_session_alias(session_id: UUID, current_user: TeacherUser, db: Annotated[Session, Depends(get_db)]):
    return close_attendance_session(session_id=session_id, current_user=current_user, db=db)


@router.get("/attendance-sessions/{session_id}/records", response_model=list[AttendanceRecordRead])
def session_records(session_id: UUID, current_user: TeacherOrAdminUser, db: Annotated[Session, Depends(get_db)]):
    return attendance_service.list_session_records_enriched(db, session_id=session_id, current_user=current_user)


@router.put("/attendance-sessions/{session_id}/records/{student_external_id}", response_model=AttendanceRecordRead)
def update_attendance_record(
    session_id: UUID,
    student_external_id: str,
    payload: AttendanceRecordUpdate,
    current_user: TeacherOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    return attendance_service.update_record_manual(
        db,
        session_id=session_id,
        student_external_id=student_external_id,
        status_value=payload.status,
        note=payload.note,
        current_user=current_user,
    )


@router.patch("/attendance-records/{record_id}", response_model=AttendanceRecordRead)
def update_attendance_record_by_id(
    record_id: UUID,
    payload: AttendanceRecordUpdate,
    current_user: TeacherOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    return attendance_service.update_record_manual_by_id(
        db,
        record_id=record_id,
        status_value=payload.status,
        note=payload.note,
        current_user=current_user,
    )


@router.get("/sections/{section_id}/attendance-summary", response_model=list[AttendanceSummaryItem])
def section_attendance_summary(
    section: Annotated[CourseSection, Depends(ensure_teacher_owns_section)],
    db: Annotated[Session, Depends(get_db)],
) -> list[AttendanceSummaryItem]:
    return attendance_service.get_section_attendance_summary(db, section.id)


@router.get("/sections/{section_id}/attendance-report")
def section_attendance_report(
    section: Annotated[CourseSection, Depends(ensure_teacher_owns_section)],
    current_user: TeacherOrAdminUser,
    db: Annotated[Session, Depends(get_db)],
):
    records = []
    for session in section.attendance_sessions:
        records.extend(attendance_service.list_session_records_enriched(db, session_id=session.id, current_user=current_user))
    return {"section": CourseSectionRead.model_validate(section), "records": records}
