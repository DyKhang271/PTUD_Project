from fastapi import APIRouter
from mock_data.schedule import SCHEDULE_DATA

router = APIRouter(prefix="/api", tags=["schedule"])


@router.get("/schedule")
def get_schedule():
    return SCHEDULE_DATA
