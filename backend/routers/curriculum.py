from fastapi import APIRouter, Query

from student_data_store import get_student_record

router = APIRouter(prefix="/api", tags=["curriculum"])


@router.get("/curriculum")
def get_curriculum(mssv: str | None = Query(default=None)):
    return get_student_record(mssv)["curriculum"]
