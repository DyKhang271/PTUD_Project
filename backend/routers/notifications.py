from fastapi import APIRouter
from mock_data.notifications import NOTIFICATIONS_DATA

router = APIRouter(prefix="/api", tags=["notifications"])


@router.get("/notifications")
def get_notifications():
    return NOTIFICATIONS_DATA
