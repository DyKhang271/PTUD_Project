from fastapi import APIRouter
from student_data_store import get_all_schedule_admin

router = APIRouter(prefix="/api", tags=["schedule"])

@router.get("/schedule")
def get_schedule():
    return get_all_schedule_admin()
