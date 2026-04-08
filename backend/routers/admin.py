from fastapi import APIRouter
from pydantic import BaseModel

from student_data_store import (
    get_all_students_for_admin,
    add_new_student,
    change_student_password,
)

router = APIRouter(prefix="/api/admin", tags=["admin"])


class AddStudentRequest(BaseModel):
    mssv: str
    password: str
    ho_ten: str = "Sinh viên mới"
    ngay_sinh: str = "01/01/2000"


class ChangePasswordRequest(BaseModel):
    new_password: str


@router.get("/students")
def get_students():
    return get_all_students_for_admin()


@router.post("/students")
def create_student(data: AddStudentRequest):
    success, msg = add_new_student(data.mssv, data.password, data.ho_ten, data.ngay_sinh)
    return {"success": success, "message": msg}


@router.put("/students/{mssv}/password")
def change_password(mssv: str, data: ChangePasswordRequest):
    success, msg = change_student_password(mssv, data.new_password)
    return {"success": success, "message": msg}
