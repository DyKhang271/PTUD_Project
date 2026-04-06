from fastapi import APIRouter
from mock_data.curriculum import CURRICULUM_DATA

router = APIRouter(prefix="/api", tags=["curriculum"])


@router.get("/curriculum")
def get_curriculum():
    return CURRICULUM_DATA
