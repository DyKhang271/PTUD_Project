from fastapi import APIRouter
from pydantic import BaseModel

from student_data_store import (
    get_available_accounts,
    validate_parent_login,
    validate_student_login,
    validate_admin_login,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


class StudentLogin(BaseModel):
    mssv: str
    password: str


class ParentLogin(BaseModel):
    ho_ten: str
    mssv: str
    ngay_sinh: str
    sdt: str

class AdminLogin(BaseModel):
    username: str
    password: str


@router.post("/student-login")
def student_login(data: StudentLogin):
    student = validate_student_login(data.mssv, data.password)
    if student:
        return {
            "success": True,
            "role": "student",
            "student": student,
            "token": f"student-token-{data.mssv}",
        }
    return {"success": False, "message": "Mã số sinh viên hoặc mật khẩu không đúng."}


@router.post("/parent-login")
def parent_login(data: ParentLogin):
    student = validate_parent_login(
        data.ho_ten,
        data.mssv,
        data.ngay_sinh,
        data.sdt,
    )
    if student:
        return {
            "success": True,
            "role": "parent",
            "student": student,
            "token": f"parent-token-{data.mssv}",
        }
    return {
        "success": False,
        "message": "Thông tin xác thực không chính xác. Vui lòng kiểm tra lại.",
    }


@router.get("/accounts")
def get_accounts():
    return get_available_accounts()

@router.post("/admin-login")
def admin_login(data: AdminLogin):
    user = validate_admin_login(data.username, data.password)
    if user:
        return {
            "success": True,
            "role": "admin",
            "admin": user,
            "token": f"admin-token-{data.username}",
        }
    return {"success": False, "message": "Tài khoản hoặc mật khẩu quản trị không đúng."}
