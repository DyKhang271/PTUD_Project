from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional

from student_data_store import (
    get_all_students_for_admin,
    add_new_student,
    change_student_password,
    get_current_system_config,
    update_system_config,
    update_student_profile,
    delete_student_profile,
    bulk_add_students,
    get_all_teachers_for_admin,
    add_new_teacher,
    change_teacher_password,
    get_teacher_assignments_admin,
    assign_course_to_teacher,
    remove_course_from_teacher,
    update_teacher_profile,
    delete_teacher_profile,
    bulk_add_teachers,
    get_all_schedule_admin,
    add_schedule_item,
    update_schedule_item,
    delete_schedule_item,
    get_all_notifications_admin,
    add_notification_admin,
    update_notification_admin,
    delete_notification_admin,
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

@router.put("/students/{mssv}")
def update_student(mssv: str, data: dict):
    success, msg = update_student_profile(mssv, data)
    return {"success": success, "message": msg}

@router.delete("/students/{mssv}")
def delete_student(mssv: str):
    success, msg = delete_student_profile(mssv)
    return {"success": success, "message": msg}

@router.post("/students/bulk")
def import_students_bulk(data: list[dict]):
    success, msg = bulk_add_students(data)
    return {"success": success, "message": msg}


# API Giáo viên
class AddTeacherRequest(BaseModel):
    username: str
    password: str
    name: str = "Tên giảng viên"
    department: str = "Bộ môn chung"
    title: str = "Giảng viên"

class AssignCourseRequest(BaseModel):
    course_code: str
    course_name: str
    term: str

@router.get("/teachers")
def get_teachers():
    return get_all_teachers_for_admin()

@router.post("/teachers")
def create_teacher(data: AddTeacherRequest):
    success, msg = add_new_teacher(data.username, data.password, data.name, data.department, data.title)
    return {"success": success, "message": msg}

@router.put("/teachers/{username}/password")
def change_teacher_pwd(username: str, data: ChangePasswordRequest):
    success, msg = change_teacher_password(username, data.new_password)
    return {"success": success, "message": msg}

@router.put("/teachers/{username}")
def update_teacher(username: str, data: dict):
    success, msg = update_teacher_profile(username, data)
    return {"success": success, "message": msg}

@router.delete("/teachers/{username}")
def delete_teacher(username: str):
    success, msg = delete_teacher_profile(username)
    return {"success": success, "message": msg}

@router.post("/teachers/bulk")
def import_teachers_bulk(data: list[dict]):
    success, msg = bulk_add_teachers(data)
    return {"success": success, "message": msg}

@router.get("/teachers/{username}/assignments")
def get_teacher_assignments(username: str):
    return get_teacher_assignments_admin(username)

@router.post("/teachers/{username}/assignments")
def admin_assign_course(username: str, data: AssignCourseRequest):
    success, msg = assign_course_to_teacher(username, data.course_code, data.course_name, data.term)
    return {"success": success, "message": msg}

@router.delete("/teachers/{username}/assignments")
def admin_remove_course(username: str, course_code: str, term: str):
    success, msg = remove_course_from_teacher(username, course_code, term)
    return {"success": success, "message": msg}


# API Schedule
@router.get("/schedule")
def get_admin_schedule():
    return get_all_schedule_admin()

@router.post("/schedule")
def create_schedule(data: dict):
    success, msg = add_schedule_item(data)
    return {"success": success, "message": msg}

@router.put("/schedule/{item_id}")
def update_schedule(item_id: str, data: dict):
    success, msg = update_schedule_item(item_id, data)
    return {"success": success, "message": msg}

@router.delete("/schedule/{item_id}")
def delete_schedule(item_id: str):
    success, msg = delete_schedule_item(item_id)
    return {"success": success, "message": msg}


# API Notifications
@router.get("/notifications")
def get_admin_notifications():
    return get_all_notifications_admin()

@router.post("/notifications")
def create_notification(data: dict):
    success, msg = add_notification_admin(data)
    return {"success": success, "message": msg}

@router.put("/notifications/{item_id}")
def update_notification(item_id: str, data: dict):
    success, msg = update_notification_admin(item_id, data)
    return {"success": success, "message": msg}

@router.delete("/notifications/{item_id}")
def delete_notification(item_id: str):
    success, msg = delete_notification_admin(item_id)
    return {"success": success, "message": msg}


# API Config
@router.get("/system/config")
def get_system_config():
    return get_current_system_config()

@router.put("/system/config")
def update_config(data: dict):
    success, msg = update_system_config(data)
    return {"success": success, "message": msg}
