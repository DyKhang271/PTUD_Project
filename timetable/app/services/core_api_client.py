from __future__ import annotations

from typing import Any

import httpx
from fastapi import HTTPException, status

from app.core.config import get_settings


class CoreApiClient:
    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.core_api_base_url.rstrip("/")
        self.api_key = settings.core_api_key
        self.timeout = settings.core_api_timeout_seconds

    def _headers(self) -> dict[str, str]:
        return {
            "X-Internal-Api-Key": self.api_key,
        }

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        headers = dict(kwargs.pop("headers", {}) or {})
        headers.update(self._headers())
        try:
            with httpx.Client(base_url=self.base_url, timeout=self.timeout) as client:
                response = client.request(method, path, headers=headers, **kwargs)
                response.raise_for_status()
                return response.json()
        except httpx.HTTPStatusError as exc:
            response_detail = ""
            try:
                payload = exc.response.json()
                response_detail = str(payload.get("detail") or "")
            except ValueError:
                response_detail = exc.response.text or ""

            if exc.response.status_code in {401, 403}:
                if "internal api key" in response_detail.lower():
                    detail = "Student Portal rejected internal API key"
                    status_code = status.HTTP_502_BAD_GATEWAY
                else:
                    detail = "Student Portal rejected authentication request"
                    status_code = status.HTTP_401_UNAUTHORIZED
            elif exc.response.status_code == 404:
                detail = "Resource not found in Student Portal"
                status_code = status.HTTP_404_NOT_FOUND
            else:
                detail = "Student Portal rejected the request"
                status_code = status.HTTP_502_BAD_GATEWAY
            raise HTTPException(
                status_code=status_code,
                detail=detail,
            ) from exc
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Cannot connect to Student Portal") from exc

    def verify_token(self, external_token: str) -> dict[str, Any]:
        payload = self._request(
            "POST",
            "/internal/auth/verify-token",
            json={"token": external_token},
        )
        return self._normalize_verified_user(payload)

    def login_student(self, username: str, password: str) -> dict[str, Any]:
        return self._request("POST", "/api/auth/student-login", json={"mssv": username, "password": password})

    def login_teacher(self, username: str, password: str) -> dict[str, Any]:
        return self._request("POST", "/api/auth/teacher-login", json={"username": username, "password": password})

    def login_admin(self, username: str, password: str) -> dict[str, Any]:
        return self._request("POST", "/api/auth/admin-login", json={"username": username, "password": password})

    def get_student(self, student_id: str) -> dict[str, Any]:
        return self._request("GET", f"/internal/students/{student_id}")

    def get_students_batch(self, student_ids: list[str]) -> dict[str, Any]:
        return self._request("POST", "/internal/students/batch", json={"student_ids": student_ids})

    def get_teacher(self, teacher_id: str) -> dict[str, Any]:
        return self._request("GET", f"/internal/teachers/{teacher_id}")

    def get_students_by_class(self, class_name: str) -> dict[str, Any]:
        return self._request("GET", "/internal/students", params={"class_name": class_name})

    def get_course_sections_source(
        self,
        *,
        term: str | None = None,
        term_code: str | None = None,
        student_id: str | None = None,
        class_name: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        params = {
            "limit": limit,
        }
        if term is not None:
            params["term"] = term
        if term_code is not None:
            params["term_code"] = term_code
        if student_id is not None:
            params["student_id"] = student_id
        if class_name is not None:
            params["class_name"] = class_name
        return self._request("GET", "/internal/course-sections/source", params=params)

    def get_source_terms(self) -> dict[str, Any]:
        return self._request("GET", "/internal/source-terms")

    def get_faculties(self) -> dict[str, Any]:
        return self._request("GET", "/internal/faculties")

    def get_programs(self, faculty_id: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if faculty_id is not None:
            params["faculty_id"] = faculty_id
        return self._request("GET", "/internal/programs", params=params)

    def get_cohorts(self, program_id: str | None = None) -> dict[str, Any]:
        params: dict[str, Any] = {}
        if program_id is not None:
            params["program_id"] = program_id
        return self._request("GET", "/internal/cohorts", params=params)

    def get_curriculum_courses(
        self,
        *,
        program_id: str,
        cohort_id: str | None = None,
        curriculum_semester: int | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"program_id": program_id}
        if cohort_id is not None:
            params["cohort_id"] = cohort_id
        if curriculum_semester is not None:
            params["curriculum_semester"] = curriculum_semester
        return self._request("GET", "/internal/curriculum/semester-courses", params=params)

    def get_students_by_program_cohort(
        self,
        *,
        program_id: str,
        cohort_id: str | None = None,
    ) -> dict[str, Any]:
        params: dict[str, Any] = {"program_id": program_id}
        if cohort_id is not None:
            params["cohort_id"] = cohort_id
        return self._request("GET", "/internal/students/by-program-cohort", params=params)

    @staticmethod
    def _normalize_verified_user(payload: dict[str, Any]) -> dict[str, Any]:
        data = payload.get("user") or payload
        role = data.get("role")
        external_id = (
            data.get("user_id")
            or data.get("external_id")
            or data.get("student_id")
            or data.get("teacher_id")
            or data.get("admin_id")
            or data.get("mssv")
            or data.get("username")
        )
        full_name = data.get("full_name") or data.get("ho_ten") or data.get("name")
        if not external_id or not role:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Core API token response")
        return {
            "external_user_id": str(external_id),
            "role": str(role),
            "full_name": full_name,
            "email": data.get("email"),
            "class_name": data.get("class_name") or data.get("lop"),
            "faculty": data.get("faculty") or data.get("khoa"),
            "program_name": data.get("program_name") or data.get("nganh"),
            "source_updated_at": data.get("source_updated_at"),
        }


def normalize_student_payload(payload: dict[str, Any]) -> dict[str, str | None]:
    data = payload.get("student") or payload
    return {
        "student_external_id": str(data.get("student_id") or data.get("external_id") or data.get("mssv") or ""),
        "full_name": data.get("full_name") or data.get("ho_ten"),
        "email": data.get("email"),
        "class_name": data.get("class_name") or data.get("lop"),
        "faculty": data.get("faculty") or data.get("khoa"),
        "program_name": data.get("program_name") or data.get("nganh"),
    }


def normalize_teacher_payload(payload: dict[str, Any]) -> dict[str, str | None]:
    data = payload.get("teacher") or payload
    return {
        "teacher_external_id": str(data.get("teacher_id") or data.get("external_id") or data.get("username") or ""),
        "full_name": data.get("full_name") or data.get("name"),
        "email": data.get("email"),
        "faculty": data.get("faculty") or data.get("department"),
    }
