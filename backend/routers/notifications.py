from fastapi import APIRouter
from student_data_store import get_all_notifications_admin

router = APIRouter(prefix="/api", tags=["notifications"])

@router.get("/notifications")
def get_notifications():
    return get_all_notifications_admin()
