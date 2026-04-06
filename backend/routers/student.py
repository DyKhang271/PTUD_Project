from fastapi import APIRouter
from mock_data.student import STUDENT_DATA

router = APIRouter(prefix="/api", tags=["student"])


@router.get("/student")
def get_student():
    return STUDENT_DATA
