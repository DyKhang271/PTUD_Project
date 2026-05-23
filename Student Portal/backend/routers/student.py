from fastapi import APIRouter, Query

from student_data_store import get_student_record

router = APIRouter(prefix="/api", tags=["student"])


@router.get("/student")
def get_student(mssv: str | None = Query(default=None)):
    return get_student_record(mssv)["student"]
