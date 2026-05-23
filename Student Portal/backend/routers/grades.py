from fastapi import APIRouter, Query

from student_data_store import get_student_record

router = APIRouter(prefix="/api", tags=["grades"])


@router.get("/grades")
def get_grades(
    semester: str | None = Query(default=None),
    mssv: str | None = Query(default=None),
):
    record = get_student_record(mssv)
    semesters = record["grades_summary"]["semesters"]
    semester_key = semester or record["grades_summary"]["latest_completed_term"]

    if semester_key == "all":
        all_courses = []
        for term, term_data in record["grades"].items():
            for course in term_data["mon_hoc"]:
                c_copy = course.copy()
                c_copy["hoc_ky_goc"] = term
                all_courses.append(c_copy)
                
        # re-index stt
        for i, course in enumerate(all_courses):
            course["stt"] = i + 1
            
        return {
            "hoc_ky": "Tất cả kỳ học",
            "gpa_hoc_ky": record["grades_summary"].get("gpa_tich_luy", 0),
            "mon_hoc": all_courses
        }

    if semester_key in record["grades"]:
        return record["grades"][semester_key]

    fallback_key = semester_key or (semesters[0] if semesters else None)
    if fallback_key and fallback_key in record["grades"]:
        return record["grades"][fallback_key]

    return {"error": "Không tìm thấy học kỳ", "mon_hoc": [], "gpa_hoc_ky": 0}


@router.get("/grades/summary")
def get_grades_summary(mssv: str | None = Query(default=None)):
    return get_student_record(mssv)["grades_summary"]
