from fastapi import APIRouter
from pydantic import BaseModel
from mock_data.student import STUDENT_DATA

router = APIRouter(prefix="/api/auth", tags=["auth"])


class StudentLogin(BaseModel):
    mssv: str
    password: str


class ParentLogin(BaseModel):
    ho_ten: str
    mssv: str
    ngay_sinh: str
    sdt: str


@router.post("/student-login")
def student_login(data: StudentLogin):
    # Mock: accept mssv=21110001, password=123456
    if data.mssv == STUDENT_DATA["mssv"] and data.password == "123456":
        return {
            "success": True,
            "role": "student",
            "student": STUDENT_DATA,
            "token": "mock-student-token-xyz",
        }
    return {"success": False, "message": "Mã số sinh viên hoặc mật khẩu không đúng."}


@router.post("/parent-login")
def parent_login(data: ParentLogin):
    # Mock: validate against student data
    if (
        data.ho_ten.strip().lower() == STUDENT_DATA["ho_ten"].lower()
        and data.mssv == STUDENT_DATA["mssv"]
        and data.ngay_sinh == STUDENT_DATA["ngay_sinh"]
        and data.sdt == STUDENT_DATA["sdt"]
    ):
        return {
            "success": True,
            "role": "parent",
            "student": STUDENT_DATA,
            "token": "mock-parent-token-xyz",
        }
    return {"success": False, "message": "Thông tin xác thực không chính xác. Vui lòng kiểm tra lại."}
