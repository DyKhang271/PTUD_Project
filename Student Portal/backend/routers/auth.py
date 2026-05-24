from __future__ import annotations

from typing import Any

import jwt
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from auth_tokens import create_access_token, create_refresh_token, decode_token
from student_data_store import (
    get_available_accounts,
    get_available_teacher_accounts,
    validate_admin_login,
    validate_parent_login,
    validate_student_login,
    validate_teacher_login,
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


class TeacherLogin(BaseModel):
    username: str
    password: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str


def _build_user_payload(*, external_id: str, role: str, profile: dict[str, Any]) -> dict[str, Any]:
    full_name = profile.get("full_name") or profile.get("ho_ten") or profile.get("name")
    email = profile.get("email")
    payload = {
        "id": external_id,
        "external_id": external_id,
        "role": role,
        "full_name": full_name,
        "email": email,
    }
    for key in ("class_name", "faculty", "program_name"):
        value = profile.get(key)
        if value is not None:
            payload[key] = value
    return payload


def _issue_tokens(*, external_id: str, role: str, profile: dict[str, Any]) -> dict[str, Any]:
    user = _build_user_payload(external_id=external_id, role=role, profile=profile)
    token_claims = {
        "full_name": user.get("full_name"),
        "email": user.get("email"),
        "class_name": user.get("class_name"),
        "faculty": user.get("faculty"),
        "program_name": user.get("program_name"),
    }
    return {
        "access_token": create_access_token(subject=external_id, role=role, user_claims=token_claims),
        "refresh_token": create_refresh_token(subject=external_id, role=role, user_claims=token_claims),
        "token_type": "bearer",
        "user": user,
    }


def _success_response(*, role: str, profile_key: str, profile: dict[str, Any], external_id: str) -> dict[str, Any]:
    tokens = _issue_tokens(external_id=external_id, role=role, profile=profile)
    return {
        "success": True,
        "role": role,
        profile_key: profile,
        "token": tokens["access_token"],
        **tokens,
    }


@router.post("/student-login")
def student_login(data: StudentLogin):
    student = validate_student_login(data.mssv, data.password)
    if student:
        external_id = str(student.get("mssv") or data.mssv)
        return _success_response(role="student", profile_key="student", profile=student, external_id=external_id)
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
        tokens = _issue_tokens(external_id=data.mssv, role="parent", profile=student)
        return {
            "success": True,
            "role": "parent",
            "student": student,
            "token": tokens["access_token"],
            **tokens,
        }
    return {
        "success": False,
        "message": "Thông tin xác thực không chính xác. Vui lòng kiểm tra lại.",
    }


@router.post("/admin-login")
def admin_login(data: AdminLogin):
    user = validate_admin_login(data.username, data.password)
    if user:
        profile = {"username": data.username, **user, "full_name": user.get("name")}
        return _success_response(role="admin", profile_key="admin", profile=profile, external_id=data.username)
    return {
        "success": False,
        "message": "Tài khoản hoặc mật khẩu quản trị không đúng.",
    }


@router.post("/teacher-login")
def teacher_login(data: TeacherLogin):
    teacher = validate_teacher_login(data.username, data.password)
    if teacher:
        return _success_response(role="teacher", profile_key="teacher", profile=teacher, external_id=data.username)
    return {
        "success": False,
        "message": "Tài khoản hoặc mật khẩu giảng viên không đúng.",
    }


@router.post("/refresh")
def refresh_access_token(payload: RefreshTokenRequest):
    try:
        claims = decode_token(payload.refresh_token, expected_type="refresh")
    except jwt.ExpiredSignatureError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token has expired") from exc
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token") from exc

    subject = str(claims.get("sub") or "")
    role = str(claims.get("role") or "")
    if not subject or not role:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token payload")

    user_claims = {
        "full_name": claims.get("full_name"),
        "email": claims.get("email"),
        "class_name": claims.get("class_name"),
        "faculty": claims.get("faculty"),
        "program_name": claims.get("program_name"),
    }
    return {
        "access_token": create_access_token(subject=subject, role=role, user_claims=user_claims),
        "token_type": "bearer",
    }


@router.get("/accounts")
def get_accounts():
    return get_available_accounts()


@router.get("/teachers")
def get_teacher_accounts():
    return get_available_teacher_accounts()
