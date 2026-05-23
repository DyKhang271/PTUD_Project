from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import require_role
from app.repositories import policy_repo, section_repo, timetable_repo
from app.schemas.course_opening_plan_schema import CohortRead, CourseOpeningPlanResponse, FacultyRead, ProgramRead
from app.schemas.policy_schema import AttendancePolicyCreate, AttendancePolicyRead, AttendancePolicyUpdate
from app.schemas.report_schema import AttendanceDashboard, AttendanceGroupSummary
from app.schemas.section_schema import (
    CoreCourseSectionsImportRequest,
    CoreCourseSectionsImportResponse,
    CourseSectionCreate,
    CourseSectionRead,
    CourseSectionUpdate,
    SectionTeacherAssignRequest,
    SectionStudentCreate,
    SectionStudentRead,
    SectionStudentsImportRequest,
    SectionStudentsImportResponse,
)
from app.schemas.term_schema import TermCreate, TermRead, TermUpdate
from app.schemas.timetable_schema import (
    ExamScheduleCreate,
    ExamScheduleRead,
    ExamScheduleUpdate,
    SectionTimetableCreate,
    SectionTimetableUpdate,
    TimetableEntryCreate,
    TimetableEntryRead,
    TimetableEntryUpdate,
)
from app.services import course_opening_plan_service, policy_service, report_service, section_service, timetable_service

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_role(["admin"]))])


@router.get("/faculties", response_model=list[FacultyRead])
def list_faculties(db: Annotated[Session, Depends(get_db)]):
    return course_opening_plan_service.list_faculties(db)


@router.get("/programs", response_model=list[ProgramRead])
def list_programs(faculty_id: str, db: Annotated[Session, Depends(get_db)]):
    return course_opening_plan_service.list_programs(db, faculty_id)


@router.get("/cohorts", response_model=list[CohortRead])
def list_cohorts(program_id: str, db: Annotated[Session, Depends(get_db)]):
    return course_opening_plan_service.list_cohorts(db, program_id)


@router.get("/course-opening-plan", response_model=CourseOpeningPlanResponse)
def get_course_opening_plan(
    faculty_id: str,
    program_id: str,
    cohort_id: str,
    curriculum_semester: int,
    term_code: str,
    db: Annotated[Session, Depends(get_db)],
):
    return course_opening_plan_service.get_course_opening_plan(
        db,
        faculty_id=faculty_id,
        program_id=program_id,
        cohort_id=cohort_id,
        curriculum_semester=curriculum_semester,
        term_code=term_code,
    )


@router.post("/terms", response_model=TermRead, status_code=status.HTTP_201_CREATED)
def create_term(payload: TermCreate, db: Annotated[Session, Depends(get_db)]):
    return section_service.create_term(db, payload.model_dump())


@router.get("/terms", response_model=list[TermRead])
def list_terms(db: Annotated[Session, Depends(get_db)]):
    return section_repo.list_terms(db)


@router.put("/terms/{term_id}", response_model=TermRead)
def update_term(term_id: UUID, payload: TermUpdate, db: Annotated[Session, Depends(get_db)]):
    return section_service.update_term(db, term_id, payload.model_dump(exclude_unset=True))


@router.post("/course-sections", response_model=CourseSectionRead, status_code=status.HTTP_201_CREATED)
def create_course_section(payload: CourseSectionCreate, db: Annotated[Session, Depends(get_db)]):
    return section_service.create_section(db, payload.model_dump())


@router.get("/course-sections", response_model=list[CourseSectionRead])
def list_course_sections(db: Annotated[Session, Depends(get_db)], term_id: UUID | None = None, teacher_external_id: str | None = None):
    return section_repo.list_sections(db, term_id=term_id, teacher_external_id=teacher_external_id)


@router.get("/terms/{term_id}/sections", response_model=list[CourseSectionRead])
def list_sections_by_term(term_id: UUID, db: Annotated[Session, Depends(get_db)]):
    return section_repo.list_sections(db, term_id=term_id)


@router.get("/course-sections/{section_id}", response_model=CourseSectionRead)
def get_course_section(section_id: UUID, db: Annotated[Session, Depends(get_db)]):
    return section_service.get_section_or_404(db, section_id)


@router.put("/course-sections/{section_id}", response_model=CourseSectionRead)
def update_course_section(section_id: UUID, payload: CourseSectionUpdate, db: Annotated[Session, Depends(get_db)]):
    return section_service.update_section(db, section_id, payload.model_dump(exclude_unset=True))


@router.put("/sections/{section_id}/teacher", response_model=CourseSectionRead)
def assign_section_teacher(section_id: UUID, payload: SectionTeacherAssignRequest, db: Annotated[Session, Depends(get_db)]):
    return section_service.assign_teacher(db, section_id, payload.teacher_id)


@router.delete("/course-sections/{section_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_course_section(section_id: UUID, db: Annotated[Session, Depends(get_db)]):
    section_service.delete_section(db, section_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/course-sections/{section_id}/students", response_model=SectionStudentRead, status_code=status.HTTP_201_CREATED)
def add_section_student(section_id: UUID, payload: SectionStudentCreate, db: Annotated[Session, Depends(get_db)]):
    return section_service.add_student(db, section_id, payload.student_external_id, payload.enrollment_status)


@router.post("/course-sections/{section_id}/students/import", response_model=SectionStudentsImportResponse)
def import_section_students(section_id: UUID, payload: SectionStudentsImportRequest, db: Annotated[Session, Depends(get_db)]):
    return section_service.import_students(db, section_id, payload.model_dump(exclude_none=True))


@router.post("/import/course-sections-from-core", response_model=CoreCourseSectionsImportResponse)
def import_course_sections_from_core(payload: CoreCourseSectionsImportRequest, db: Annotated[Session, Depends(get_db)]):
    return section_service.import_course_sections_from_core(db, payload.model_dump(exclude_none=True))


@router.post("/import", response_model=CoreCourseSectionsImportResponse)
def import_course_sections_alias(payload: CoreCourseSectionsImportRequest, db: Annotated[Session, Depends(get_db)]):
    return import_course_sections_from_core(payload=payload, db=db)


@router.get("/course-sections/{section_id}/students", response_model=list[SectionStudentRead])
def list_section_students(section_id: UUID, db: Annotated[Session, Depends(get_db)]):
    return section_service.list_section_students_enriched(db, section_id)


@router.get("/sections/{section_id}/timetable", response_model=list[TimetableEntryRead])
def list_section_timetable(section_id: UUID, db: Annotated[Session, Depends(get_db)]):
    section_service.get_section_or_404(db, section_id)
    return timetable_repo.list_timetable_entries(db, section_id=section_id)


@router.post("/sections/{section_id}/timetable", response_model=TimetableEntryRead, status_code=status.HTTP_201_CREATED)
def create_section_timetable(section_id: UUID, payload: SectionTimetableCreate, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.create_section_timetable_entry(db, section_id=section_id, values=payload.model_dump())


@router.post("/timetable", response_model=TimetableEntryRead, status_code=status.HTTP_201_CREATED)
def create_timetable(payload: TimetableEntryCreate, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.create_timetable_entry(db, payload.model_dump())


@router.get("/timetable", response_model=list[TimetableEntryRead])
def list_timetable(db: Annotated[Session, Depends(get_db)], section_id: UUID | None = None):
    return timetable_repo.list_timetable_entries(db, section_id=section_id)


@router.put("/timetable/{entry_id}", response_model=TimetableEntryRead)
def update_timetable(entry_id: UUID, payload: TimetableEntryUpdate, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.update_timetable_entry(db, entry_id, payload.model_dump(exclude_unset=True))


@router.put("/timetable-entries/{entry_id}", response_model=TimetableEntryRead)
def update_timetable_entry_alias(entry_id: UUID, payload: SectionTimetableUpdate, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.update_section_timetable_entry(db, entry_id=entry_id, values=payload.model_dump(exclude_unset=True))


@router.delete("/timetable/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable(entry_id: UUID, db: Annotated[Session, Depends(get_db)]):
    timetable_service.delete_timetable_entry(db, entry_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/timetable-entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_timetable_entry_alias(entry_id: UUID, db: Annotated[Session, Depends(get_db)]):
    return delete_timetable(entry_id=entry_id, db=db)


@router.post("/exams", response_model=ExamScheduleRead, status_code=status.HTTP_201_CREATED)
def create_exam(payload: ExamScheduleCreate, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.create_exam_schedule(db, payload.model_dump())


@router.get("/exams", response_model=list[ExamScheduleRead])
def list_exams(db: Annotated[Session, Depends(get_db)], section_id: UUID | None = None):
    return timetable_repo.list_exam_schedules(db, section_id=section_id)


@router.put("/exams/{exam_id}", response_model=ExamScheduleRead)
def update_exam(exam_id: UUID, payload: ExamScheduleUpdate, db: Annotated[Session, Depends(get_db)]):
    return timetable_service.update_exam_schedule(db, exam_id, payload.model_dump(exclude_unset=True))


@router.delete("/exams/{exam_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_exam(exam_id: UUID, db: Annotated[Session, Depends(get_db)]):
    timetable_service.delete_exam_schedule(db, exam_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/attendance-policies", response_model=AttendancePolicyRead, status_code=status.HTTP_201_CREATED)
def create_policy(payload: AttendancePolicyCreate, db: Annotated[Session, Depends(get_db)]):
    return policy_service.create_policy(db, payload.model_dump())


@router.get("/attendance-policies", response_model=list[AttendancePolicyRead])
def list_policies(db: Annotated[Session, Depends(get_db)]):
    return policy_repo.list_policies(db)


@router.get("/policies", response_model=list[AttendancePolicyRead])
def list_policies_alias(db: Annotated[Session, Depends(get_db)]):
    return list_policies(db=db)


@router.put("/attendance-policies/{policy_id}", response_model=AttendancePolicyRead)
def update_policy(policy_id: UUID, payload: AttendancePolicyUpdate, db: Annotated[Session, Depends(get_db)]):
    return policy_service.update_policy(db, policy_id, payload.model_dump(exclude_unset=True))


@router.delete("/attendance-policies/{policy_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_policy(policy_id: UUID, db: Annotated[Session, Depends(get_db)]):
    policy_service.delete_policy(db, policy_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/attendance/dashboard", response_model=AttendanceDashboard)
def attendance_dashboard(db: Annotated[Session, Depends(get_db)]):
    return report_service.get_dashboard(db)


@router.get("/attendance/by-section", response_model=list[AttendanceGroupSummary])
def attendance_by_section(db: Annotated[Session, Depends(get_db)]):
    return report_service.summarize_by_section(db)


@router.get("/attendance/by-course", response_model=list[AttendanceGroupSummary])
def attendance_by_course(db: Annotated[Session, Depends(get_db)]):
    return report_service.summarize_by_course(db)


@router.get("/attendance/by-faculty", response_model=list[AttendanceGroupSummary])
def attendance_by_faculty(db: Annotated[Session, Depends(get_db)]):
    return report_service.summarize_by_faculty(db)
