from fastapi import APIRouter, Query
from mock_data.grades import GRADES_DATA, GRADES_SUMMARY

router = APIRouter(prefix="/api", tags=["grades"])


@router.get("/grades")
def get_grades(semester: str = Query(default="HK1-2024")):
    if semester in GRADES_DATA:
        return GRADES_DATA[semester]
    return {"error": "Không tìm thấy học kỳ", "mon_hoc": [], "gpa_hoc_ky": 0}


@router.get("/grades/summary")
def get_grades_summary():
    return GRADES_SUMMARY
