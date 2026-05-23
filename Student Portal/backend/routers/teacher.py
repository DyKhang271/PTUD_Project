from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from student_data_store import (
    get_teacher_course_students,
    get_teacher_courses,
    get_teacher_overview,
    import_teacher_course_grades,
    update_teacher_student_grade,
)

router = APIRouter(prefix="/api/teacher", tags=["teacher"])


class TeacherGradeUpdateRequest(BaseModel):
    username: str
    mssv: str
    term: str
    class_section_code: str
    diem_thuong_ky_1: float | None = None
    diem_thuong_ky_2: float | None = None
    diem_thuc_hanh_1: float | None = None
    diem_thuc_hanh_2: float | None = None
    diem_qt: float | None = None
    diem_gk: float | None = None
    diem_ck: float | None = None


class TeacherGradeImportRow(BaseModel):
    row_number: int | None = None
    mssv: str
    class_section_code: str | None = None
    diem_thuong_ky_1: float | None = None
    diem_thuong_ky_2: float | None = None
    diem_thuc_hanh_1: float | None = None
    diem_thuc_hanh_2: float | None = None
    diem_qt: float | None = None
    diem_gk: float | None = None
    diem_ck: float | None = None


class TeacherGradeImportRequest(BaseModel):
    username: str
    course_code: str
    term: str
    rows: list[TeacherGradeImportRow]


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
            diem_thuong_ky_1=payload.diem_thuong_ky_1,
            diem_thuong_ky_2=payload.diem_thuong_ky_2,
            diem_thuc_hanh_1=payload.diem_thuc_hanh_1,
            diem_thuc_hanh_2=payload.diem_thuc_hanh_2,
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


@router.post("/grades/import")
def teacher_import_grades(payload: TeacherGradeImportRequest):
    try:
        result = import_teacher_course_grades(
            username=payload.username,
            course_code=payload.course_code,
            term=payload.term,
            rows=[row.model_dump() for row in payload.rows],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    return {
        "success": True,
        "message": "Import file CSV điểm thành công.",
        **result,
    }
