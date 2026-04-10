from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from student_data_store import (
    get_teacher_course_students,
    get_teacher_courses,
    get_teacher_overview,
    update_teacher_student_grade,
)

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


class TeacherGradeUpdateRequest(BaseModel):
    username: str
    mssv: str
    term: str
    class_section_code: str
    diem_qt: float | None = None
    diem_gk: float | None = None
    diem_ck: float | None = None


@router.get("/overview")
def teacher_overview(username: str = Query(...)):
    try:
        return get_teacher_overview(username)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/courses")
def teacher_courses(username: str = Query(...)):
    try:
        return get_teacher_courses(username)
    except (ValueError, KeyError) as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/courses/{course_code}/students")
def teacher_course_students(course_code: str, username: str = Query(...), term: str = Query(...)):
    try:
        return get_teacher_course_students(username, course_code, term)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.put("/grades")
def teacher_update_grade(payload: TeacherGradeUpdateRequest):
    try:
        result = update_teacher_student_grade(
            username=payload.username,
            mssv=payload.mssv,
            term=payload.term,
            class_section_code=payload.class_section_code,
            diem_qt=payload.diem_qt,
            diem_gk=payload.diem_gk,
            diem_ck=payload.diem_ck,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "success": True,
        "message": "Cập nhật điểm sinh viên thành công.",
        **result,
    }
