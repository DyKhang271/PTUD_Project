from __future__ import annotations

import os
import re
import secrets
from collections import OrderedDict

import jwt
from fastapi import HTTPException, status

from auth_tokens import decode_token
import student_data_store as store

DEFAULT_INTERNAL_API_KEY = "dev-internal-secret"


def verify_internal_api_key(api_key: str | None) -> None:
    expected_key = os.getenv("INTERNAL_API_KEY", DEFAULT_INTERNAL_API_KEY)
    if not expected_key or not api_key or not secrets.compare_digest(api_key, expected_key):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal API key")


def _ensure_store_loaded() -> None:
    store.initialize_store()


def _normalize_student_profile_from_public(public_student: dict | None) -> dict | None:
    if not public_student:
        return None
    data = public_student.get("student") or public_student
    student_id = data.get("student_id") or data.get("mssv")
    if not student_id:
        return None
    return {
        "student_id": str(student_id),
        "full_name": data.get("full_name") or data.get("ho_ten"),
        "class_name": data.get("class_name") or data.get("lop"),
        "faculty": data.get("faculty") or data.get("khoa"),
        "program_name": data.get("program_name") or data.get("nganh"),
        "education_level": data.get("education_level"),
    }


def _normalize_student_profile_from_raw(raw_record: dict | None) -> dict | None:
    if not raw_record:
        return None
    student = raw_record.get("student") or {}
    student_id = student.get("student_id")
    if not student_id:
        return None
    return {
        "student_id": str(student_id),
        "full_name": student.get("full_name"),
        "class_name": student.get("class_name"),
        "faculty": student.get("faculty"),
        "program_name": student.get("program_name"),
        "education_level": student.get("education_level"),
    }


def _get_all_public_student_records() -> dict[str, dict]:
    _ensure_store_loaded()
    return store.get_student_records()


def _get_all_raw_student_records() -> dict[str, dict]:
    _ensure_store_loaded()
    return store.RAW_STUDENT_DB


def _normalize_teacher(teacher_id: str, teacher: dict | None) -> dict | None:
    if not teacher:
        return None
    return {
        "teacher_id": teacher_id,
        "full_name": teacher.get("name") or teacher.get("full_name"),
        "email": teacher.get("email"),
        "faculty": teacher.get("faculty") or teacher.get("department"),
        "department": teacher.get("department") or teacher.get("faculty"),
    }


def _normalize_admin(admin_id: str, admin: dict | None) -> dict | None:
    if not admin:
        return None
    return {
        "admin_id": admin_id,
        "full_name": admin.get("name") or admin.get("full_name"),
    }


def verify_external_token(token: str) -> dict:
    raw_token = (token or "").strip()
    if not raw_token:
        return {"valid": False}

    if "." in raw_token:
        try:
            payload = decode_token(raw_token, expected_type="access")
        except jwt.PyJWTError:
            return {"valid": False}

        role = str(payload.get("role") or "").strip().lower()
        user_id = str(payload.get("sub") or "").strip()
        if not role or not user_id:
            return {"valid": False}

        claims = {
            "full_name": payload.get("full_name"),
            "email": payload.get("email"),
            "class_name": payload.get("class_name"),
            "faculty": payload.get("faculty"),
            "program_name": payload.get("program_name"),
        }
        return {"valid": True, "user_id": user_id, "role": role, **claims}

    if ":" not in raw_token:
        return {"valid": False}

    role, user_id = raw_token.split(":", 1)
    role = role.strip().lower()
    user_id = user_id.strip()
    if not role or not user_id:
        return {"valid": False}

    if role == "student":
        student = get_student_profile_internal(user_id)
        if not student:
            return {"valid": False}
        return {"valid": True, "user_id": user_id, "role": "student", **student}

    if role == "teacher":
        teacher = get_teacher_internal(user_id)
        if not teacher:
            return {"valid": False}
        return {"valid": True, "user_id": user_id, "role": "teacher", **teacher}

    if role == "admin":
        _ensure_store_loaded()
        admin = _normalize_admin(user_id, store.ADMIN_USERS.get(user_id))
        if not admin:
            return {"valid": False}
        return {"valid": True, "user_id": user_id, "role": "admin", **admin}

    return {"valid": False}


def get_student_profile_internal(student_id: str) -> dict | None:
    public_records = _get_all_public_student_records()
    normalized = _normalize_student_profile_from_public(public_records.get(student_id))
    if normalized:
        return normalized

    raw_record = store.get_raw_student_payload(student_id)
    return _normalize_student_profile_from_raw(raw_record)


def get_students_batch_internal(student_ids: list[str]) -> dict:
    items: list[dict] = []
    missing_ids: list[str] = []

    seen: OrderedDict[str, None] = OrderedDict()
    for student_id in student_ids:
        normalized_id = str(student_id).strip()
        if normalized_id:
            seen[normalized_id] = None

    for student_id in seen.keys():
        student = get_student_profile_internal(student_id)
        if student:
            items.append(student)
        else:
            missing_ids.append(student_id)

    return {
        "items": items,
        "students": items,
        "missing_ids": missing_ids,
    }


def get_students_by_class_internal(class_name: str) -> dict:
    normalized_class = class_name.strip().lower()
    items = [
        student
        for record in _get_all_public_student_records().values()
        if (student := _normalize_student_profile_from_public(record))
        and (student.get("class_name") or "").strip().lower() == normalized_class
    ]
    return {
        "items": items,
        "students": items,
        "total": len(items),
    }


def get_teacher_internal(teacher_id: str) -> dict | None:
    _ensure_store_loaded()
    teacher = store.TEACHER_USERS.get(teacher_id)
    return _normalize_teacher(teacher_id, teacher)


def get_teachers_batch_internal(teacher_ids: list[str]) -> dict:
    items: list[dict] = []
    missing_ids: list[str] = []

    seen: OrderedDict[str, None] = OrderedDict()
    for teacher_id in teacher_ids:
        normalized_id = str(teacher_id).strip()
        if normalized_id:
            seen[normalized_id] = None

    for teacher_id in seen.keys():
        teacher = get_teacher_internal(teacher_id)
        if teacher:
            items.append(teacher)
        else:
            missing_ids.append(teacher_id)

    return {
        "items": items,
        "teachers": items,
        "missing_ids": missing_ids,
    }


def _derive_course_code(section_code: str | None) -> str | None:
    if not section_code:
        return None
    return section_code[:10]


def _normalize_term_key(term: str | None) -> str | None:
    raw_value = str(term or "").strip()
    if not raw_value:
        return None

    compact = re.sub(r"[\s()\-]+", "", raw_value).lower()
    if compact:
        return compact

    normalized = raw_value.replace("_", " ").strip().lower()
    return re.sub(r"\s+", " ", normalized)


def _build_term_code(term: str | None) -> str | None:
    raw_value = str(term or "").strip()
    if not raw_value:
        return None

    match = re.search(r"hk\s*([123])\s*[\(_ ]*\s*(\d{4})\s*[-_]\s*(\d{4})", raw_value, flags=re.IGNORECASE)
    if match:
        semester, start_year, end_year = match.groups()
        return f"HK{semester}_{start_year}_{end_year}"

    if re.fullmatch(r"hk[123]_\d{4}_\d{4}", raw_value, flags=re.IGNORECASE):
        return raw_value.upper()

    return raw_value.replace(" ", "_")


def _parse_term_metadata(term: str | None) -> dict[str, str | None]:
    raw_value = str(term or "").strip()
    if not raw_value:
        return {
            "term_name": None,
            "term_code": None,
            "semester": None,
            "academic_year": None,
        }

    term_code = _build_term_code(raw_value)
    match = re.search(r"hk\s*([123])\s*[\(_ ]*\s*(\d{4})\s*[-_]\s*(\d{4})", raw_value, flags=re.IGNORECASE)
    semester = None
    academic_year = None
    if match:
        semester_number, start_year, end_year = match.groups()
        semester = f"HK{semester_number}"
        academic_year = f"{start_year} - {end_year}"

    return {
        "term_name": raw_value,
        "term_code": term_code,
        "semester": semester,
        "academic_year": academic_year,
    }


def _term_sort_key(term: str | None) -> tuple[int, int, int]:
    metadata = _parse_term_metadata(term)
    term_code = metadata.get("term_code") or ""
    match = re.fullmatch(r"HK([123])_(\d{4})_(\d{4})", term_code)
    if match:
        semester_number, start_year, end_year = match.groups()
        return (int(end_year), int(start_year), int(semester_number))
    return (0, 0, 0)


def _get_teacher_assignment_lookup() -> tuple[dict[tuple[str, str], dict], dict[tuple[str, str], dict]]:
    _ensure_store_loaded()
    by_section: dict[tuple[str, str], dict] = {}
    by_course: dict[tuple[str, str], dict] = {}

    for teacher_id, teacher in store.TEACHER_USERS.items():
        teacher_payload = _normalize_teacher(teacher_id, teacher)
        if not teacher_payload:
            continue

        for assignment in teacher.get("assignments") or []:
            normalized_term = _normalize_term_key(assignment.get("term"))
            if not normalized_term:
                continue

            course_code = str(assignment.get("course_code") or "").strip()
            section_code = str(assignment.get("section_code") or "").strip()
            if section_code:
                by_section.setdefault((normalized_term, section_code), teacher_payload)
            if course_code:
                by_course.setdefault((normalized_term, course_code), teacher_payload)

    return by_section, by_course


def _resolve_course_section_teacher(*, term: str, section_code: str, course_code: str | None) -> dict | None:
    by_section, by_course = _get_teacher_assignment_lookup()
    normalized_term = _normalize_term_key(term)
    if not normalized_term:
        return None

    teacher = by_section.get((normalized_term, section_code))
    if teacher:
        return teacher

    if course_code:
        return by_course.get((normalized_term, course_code))
    return None


def _iter_filtered_transcript_courses(
    *,
    term: str | None = None,
    student_id: str | None = None,
    class_name: str | None = None,
):
    normalized_term = _normalize_term_key(term)
    normalized_class = class_name.strip().lower() if class_name else None
    raw_records = _get_all_raw_student_records()

    for current_student_id, raw_record in raw_records.items():
        if student_id and current_student_id != student_id:
            continue

        student_profile = _normalize_student_profile_from_raw(raw_record)
        if normalized_class and (student_profile or {}).get("class_name", "").strip().lower() != normalized_class:
            continue

        for course in raw_record.get("transcript_courses", []):
            current_term = str(course.get("term") or "")
            if normalized_term and _normalize_term_key(current_term) != normalized_term:
                continue
            yield current_student_id, course


def get_course_sections_source_internal(
    term: str | None = None,
    student_id: str | None = None,
    class_name: str | None = None,
    limit: int = 100,
) -> dict:
    grouped: OrderedDict[tuple[str, str, str], dict] = OrderedDict()

    for current_student_id, course in _iter_filtered_transcript_courses(
        term=term,
        student_id=student_id,
        class_name=class_name,
    ):
        current_term = str(course.get("term") or "")
        section_code = str(course.get("class_section_code") or "").strip()
        course_name = str(course.get("course_name") or "").strip()
        if not current_term or not section_code or not course_name:
            continue

        key = (current_term, section_code, course_name)
        item = grouped.setdefault(
            key,
            {
                "term": current_term,
                "term_code": _build_term_code(current_term),
                "section_code": section_code,
                "course_code": _derive_course_code(section_code),
                "course_name": course_name,
                "student_ids": [],
                "student_count": 0,
                "teacher_id": None,
                "teacher_name": None,
                "teacher_email": None,
                "teacher_department": None,
            },
        )
        if current_student_id not in item["student_ids"]:
            item["student_ids"].append(current_student_id)
            item["student_count"] += 1

        if item["teacher_id"] is None:
            teacher = _resolve_course_section_teacher(
                term=current_term,
                section_code=section_code,
                course_code=item.get("course_code"),
            )
            if teacher:
                item["teacher_id"] = teacher["teacher_id"]
                item["teacher_name"] = teacher.get("full_name")
                item["teacher_email"] = teacher.get("email")
                item["teacher_department"] = teacher.get("department")

    all_items = list(grouped.values())
    items = all_items[: max(limit, 0)]
    return {
        "items": items,
        "total": len(all_items),
    }


def get_source_terms_internal() -> dict:
    seen: OrderedDict[str, dict] = OrderedDict()

    for raw_record in _get_all_raw_student_records().values():
        student = raw_record.get("student") or {}
        student_id = str(student.get("student_id") or "").strip()
        for transcript_term in raw_record.get("transcript_terms", []):
            metadata = _parse_term_metadata(transcript_term.get("term"))
            term_name = metadata["term_name"]
            if not term_name:
                continue
            entry = seen.setdefault(
                term_name,
                {
                    "term_name": term_name,
                    "term_code": metadata["term_code"],
                    "academic_year": metadata["academic_year"],
                    "semester": metadata["semester"],
                    "course_count": 0,
                    "student_count": 0,
                    "has_course_sections": False,
                    "has_transcript_courses": False,
                    "source": [],
                    "_student_ids": set(),
                    "_course_keys": set(),
                },
            )
            if "transcript_terms" not in entry["source"]:
                entry["source"].append("transcript_terms")
            if student_id:
                entry["_student_ids"].add(student_id)

        for course in raw_record.get("transcript_courses", []):
            metadata = _parse_term_metadata(course.get("term"))
            term_name = metadata["term_name"]
            if not term_name:
                continue
            entry = seen.setdefault(
                term_name,
                {
                    "term_name": term_name,
                    "term_code": metadata["term_code"],
                    "academic_year": metadata["academic_year"],
                    "semester": metadata["semester"],
                    "course_count": 0,
                    "student_count": 0,
                    "has_course_sections": False,
                    "has_transcript_courses": False,
                    "source": [],
                    "_student_ids": set(),
                    "_course_keys": set(),
                },
            )
            if "transcript_courses" not in entry["source"]:
                entry["source"].append("transcript_courses")
            entry["has_transcript_courses"] = True
            section_code = str(course.get("class_section_code") or "").strip()
            course_name = str(course.get("course_name") or "").strip()
            if student_id:
                entry["_student_ids"].add(student_id)
            if section_code and course_name:
                entry["_course_keys"].add((section_code, course_name))
            entry["has_course_sections"] = bool(entry["_course_keys"])

    terms: list[dict] = []
    for item in seen.values():
        course_keys = item.pop("_course_keys", set())
        student_ids = item.pop("_student_ids", set())
        item["course_count"] = len(course_keys)
        item["student_count"] = len(student_ids)
        item["has_course_sections"] = bool(course_keys)
        terms.append(item)

    terms.sort(key=lambda item: _term_sort_key(item.get("term_name")), reverse=True)
    latest_term = terms[0]["term_code"] if terms else None
    return {
        "terms": terms,
        "latest_term_code": latest_term,
        "total": len(terms),
    }


def get_student_course_sections_internal(student_id: str) -> dict:
    raw_record = store.get_raw_student_payload(student_id)
    if not raw_record:
        return {"student_id": student_id, "items": []}

    items: list[dict] = []
    seen: set[tuple[str, str, str]] = set()
    for course in raw_record.get("transcript_courses", []):
        term = str(course.get("term") or "")
        section_code = str(course.get("class_section_code") or "").strip()
        course_name = str(course.get("course_name") or "").strip()
        if not term or not section_code or not course_name:
            continue

        key = (term, section_code, course_name)
        if key in seen:
            continue
        seen.add(key)

        items.append(
            {
                "term": term,
                "term_code": _build_term_code(term),
                "section_code": section_code,
                "course_code": _derive_course_code(section_code),
                "course_name": course_name,
            }
        )

    return {
        "student_id": student_id,
        "items": items,
    }
