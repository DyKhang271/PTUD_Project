from __future__ import annotations

import csv
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from decimal import Decimal
import io
import re
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import distinct, func, select
from sqlalchemy.orm import Session

from app.models.academic_term import AcademicTerm
from app.models.attendance import AttendanceRecord, AttendanceSession
from app.models.course_section import CourseSection, CourseSectionStudent
from app.models.external_user import ExternalUserCache
from app.models.policy import AttendancePolicy
from app.models.timetable import TimetableEntry
from app.repositories import attendance_repo, external_user_repo, policy_repo, section_repo, timetable_repo
from app.schemas.import_schema import ImportDebugSummaryResponse, ImportFromCoreResponse, SourceTermsResponse
from app.schemas.import_schema import (
    ImportDebugSummaryDuplicateSection,
    ImportDebugSummaryLatestSection,
    ImportDebugSummaryLatestTimetableEntry,
    ImportDebugSummaryStatusCounts,
    ImportDebugSummaryTerm,
    ImportDebugSummaryTimetableStatusCounts,
    TimetableCsvInvalidRow,
    TimetableEntriesCsvImportResponse,
    TimetableEntriesImportResponse,
)
from app.services.core_api_client import CoreApiClient, normalize_student_payload, normalize_teacher_payload


DEFAULT_FACULTY = "Khoa Công nghệ Thông tin"
DEFAULT_TERM_START = date(2026, 2, 1)
DEFAULT_TERM_END = date(2026, 6, 30)
DEFAULT_TIMETABLE_VALID_FROM = date(2026, 4, 20)
DEFAULT_TIMETABLE_VALID_TO = date(2026, 6, 30)
MAX_TIMETABLE_CSV_BYTES = 2 * 1024 * 1024
REQUIRED_TIMETABLE_CSV_COLUMNS = [
    "term_code",
    "section_code",
    "day_of_week",
    "start_time",
    "end_time",
    "room",
    "weeks",
    "status",
]

FALLBACK_COURSE_SECTIONS: list[dict[str, Any]] = [
    {
        "section_code": "420300344304",
        "course_code": "4203003443",
        "course_name": "Khai thac du lieu va ung dung",
        "student_ids": [],
    },
    {
        "section_code": "420300350101",
        "course_code": "4203003501",
        "course_name": "Phat trien ung dung",
        "student_ids": [],
    },
    {
        "section_code": "420300371101",
        "course_code": "4203003711",
        "course_name": "May hoc",
        "student_ids": [],
    },
    {
        "section_code": "420301411502",
        "course_code": "4203014115",
        "course_name": "Khai pha do thi",
        "student_ids": [],
    },
    {
        "section_code": "420300114603",
        "course_code": "4203001146",
        "course_name": "He co so du lieu",
        "student_ids": [],
    },
]

SAMPLE_TIMETABLE_BY_SECTION: dict[str, dict[str, Any]] = {
    "420300344304": {
        "day_of_week": 2,
        "start_period": 4,
        "end_period": 6,
        "start_time": time(9, 15),
        "end_time": time(11, 45),
        "room": "H8.01",
        "location": "H (CS1)",
        "session_type": "practice",
    },
    "420300350101": {
        "day_of_week": 1,
        "start_period": 7,
        "end_period": 9,
        "start_time": time(13, 0),
        "end_time": time(15, 30),
        "room": "B1.12.2",
        "location": "B (CS1)",
        "session_type": "practice",
    },
    "420300371101": {
        "day_of_week": 5,
        "start_period": 4,
        "end_period": 6,
        "start_time": time(9, 15),
        "end_time": time(11, 45),
        "room": "H6.1",
        "location": "H (CS1)",
        "session_type": "practice",
    },
    "420301411502": {
        "day_of_week": 4,
        "start_period": 4,
        "end_period": 6,
        "start_time": time(9, 15),
        "end_time": time(11, 45),
        "room": "B1.11.2",
        "location": "B (CS1)",
        "session_type": "practice",
    },
    "420300114603": {
        "day_of_week": 6,
        "start_period": 7,
        "end_period": 9,
        "start_time": time(13, 0),
        "end_time": time(15, 30),
        "room": "A2.05",
        "location": "Co so 1",
        "session_type": "study",
    },
}

SAMPLE_ATTENDANCE_BY_SECTION: dict[str, dict[str, Any]] = {
    "420300344304": {"status": "present", "method": "qr"},
    "420300350101": {"status": "late", "method": "code"},
    "420300371101": {"status": "present", "method": "qr"},
    "420301411502": {"status": "absent", "method": None},
    "420300114603": {"status": "excused", "method": "manual"},
}


@dataclass
class _ImportCounters:
    imported_terms: int = 0
    imported_sections: int = 0
    imported_students: int = 0
    linked_students: int = 0
    created_timetable_entries: int = 0
    created_attendance_sessions: int = 0
    created_attendance_records: int = 0


def _extract_items(payload: dict | list | None, *keys: str) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _extract_ids(values: list[Any] | None) -> list[str]:
    if not values:
        return []
    clean_ids: list[str] = []
    seen: set[str] = set()
    for value in values:
        normalized = str(value).strip()
        if normalized and normalized not in seen:
            clean_ids.append(normalized)
            seen.add(normalized)
    return clean_ids


def _pick_most_common(values: list[str | None]) -> str | None:
    normalized = [str(value).strip() for value in values if str(value or "").strip()]
    if not normalized:
        return None
    return Counter(normalized).most_common(1)[0][0]


def _get_term_by_code(db: Session, term_code: str) -> AcademicTerm | None:
    return db.scalar(select(AcademicTerm).where(AcademicTerm.term_code == term_code))


def _normalize_term_lookup_value(value: str | None) -> str | None:
    raw_value = str(value or "").strip()
    if not raw_value:
        return None
    return re.sub(r"[\s()_\-]+", "", raw_value).lower()


def _resolve_db_terms(
    db: Session,
    *,
    term: str | None = None,
    term_code: str | None = None,
    term_id: UUID | None = None,
) -> list[AcademicTerm]:
    if term_id:
        term = db.scalar(select(AcademicTerm).where(AcademicTerm.id == term_id))
        return [term] if term else []

    all_terms = list(
        db.scalars(select(AcademicTerm).order_by(AcademicTerm.start_date.desc().nullslast(), AcademicTerm.term_code))
    )
    if not term and not term_code:
        return all_terms

    lookup_values = {
        value
        for value in (
            _normalize_term_lookup_value(term),
            _normalize_term_lookup_value(term_code),
        )
        if value
    }
    if not lookup_values:
        return all_terms

    matched: list[AcademicTerm] = []
    for current_term in all_terms:
        candidates = {
            value
            for value in (
                _normalize_term_lookup_value(current_term.term_code),
                _normalize_term_lookup_value(current_term.term_name),
            )
            if value
        }
        if lookup_values.intersection(candidates):
            matched.append(current_term)
    return matched


def _upsert_term(db: Session, *, term_code: str, term_name: str) -> tuple[AcademicTerm, bool]:
    term = _get_term_by_code(db, term_code)
    created = False
    if term is None:
        term = section_repo.create_term(
            db,
            {
                "term_code": term_code,
                "term_name": term_name,
                "start_date": DEFAULT_TERM_START,
                "end_date": DEFAULT_TERM_END,
                "status": "active",
            },
        )
        created = True
    else:
        section_repo.update_term(
            db,
            term,
            {
                "term_name": term_name,
                "start_date": term.start_date or DEFAULT_TERM_START,
                "end_date": term.end_date or DEFAULT_TERM_END,
                "status": term.status or "active",
            },
        )
    return term, created


def _get_section_by_term_and_code(db: Session, *, term_id: UUID, section_code: str) -> CourseSection | None:
    return db.scalar(
        select(CourseSection).where(
            CourseSection.term_id == term_id,
            CourseSection.section_code == section_code,
        )
    )


def _upsert_section(
    db: Session,
    *,
    term_id: UUID,
    section_code: str,
    course_code: str,
    course_name: str,
    faculty: str | None,
    program_name: str | None = None,
    teacher_external_id: str | None = None,
) -> tuple[CourseSection, bool]:
    section = _get_section_by_term_and_code(db, term_id=term_id, section_code=section_code)
    resolved_teacher_external_id = teacher_external_id
    if section is not None and not resolved_teacher_external_id:
        resolved_teacher_external_id = section.teacher_external_id
    values = {
        "term_id": term_id,
        "course_code": course_code,
        "course_name": course_name,
        "section_code": section_code,
        "teacher_external_id": resolved_teacher_external_id,
        "faculty": faculty or DEFAULT_FACULTY,
        "program_name": program_name,
        "total_sessions": 15,
        "status": "active",
    }
    created = False
    if section is None:
        section = section_repo.create_section(db, values)
        created = True
    else:
        section_repo.update_section(db, section, values)
    return section, created


def _get_timetable_entry(
    db: Session,
    *,
    section_id: UUID,
    day_of_week: int,
    start_period: int | None,
    end_period: int | None,
) -> TimetableEntry | None:
    return db.scalar(
        select(TimetableEntry).where(
            TimetableEntry.section_id == section_id,
            TimetableEntry.day_of_week == day_of_week,
            TimetableEntry.start_period == start_period,
            TimetableEntry.end_period == end_period,
        )
    )


def _upsert_timetable_entry(db: Session, *, section_id: UUID, blueprint: dict[str, Any]) -> tuple[TimetableEntry, bool]:
    entry = _get_timetable_entry(
        db,
        section_id=section_id,
        day_of_week=int(blueprint["day_of_week"]),
        start_period=blueprint.get("start_period"),
        end_period=blueprint.get("end_period"),
    )
    values = {
        "section_id": section_id,
        "day_of_week": int(blueprint["day_of_week"]),
        "start_period": blueprint.get("start_period"),
        "end_period": blueprint.get("end_period"),
        "start_time": blueprint.get("start_time"),
        "end_time": blueprint.get("end_time"),
        "room": blueprint.get("room"),
        "location": blueprint.get("location"),
        "weeks": blueprint.get("weeks"),
        "valid_from": DEFAULT_TIMETABLE_VALID_FROM,
        "valid_to": DEFAULT_TIMETABLE_VALID_TO,
        "status": blueprint.get("status", "published"),
        "session_type": blueprint.get("session_type", "study"),
        "note": blueprint.get("note"),
    }
    created = False
    if entry is None:
        entry = timetable_repo.create_timetable_entry(db, values)
        created = True
    else:
        timetable_repo.update_timetable_entry(db, entry, values)
    return entry, created


def _upsert_global_policy(db: Session) -> AttendancePolicy:
    existing = policy_repo.resolve_policy(db, section_id=None, course_code=None, faculty=None)
    values = {
        "scope_type": "global",
        "scope_id": None,
        "max_absent_percent": Decimal("20.00"),
        "allow_late_minutes": 15,
        "late_count_as_absent_ratio": Decimal("0.50"),
        "warning_threshold_percent": Decimal("15.00"),
    }
    if existing and existing.scope_type == "global" and existing.scope_id is None:
        return policy_repo.update_policy(db, existing, values)
    return policy_repo.create_policy(db, values)


def _resolve_session_date(day_of_week: int) -> date:
    # App timetable uses Monday=1 via Python weekday()+1.
    return DEFAULT_TIMETABLE_VALID_FROM + timedelta(days=max(day_of_week - 1, 0))


def _build_generated_timetable_blueprint(section: CourseSection, index: int) -> dict[str, Any]:
    fallback_by_slot = [
        {
            "day_of_week": 1,
            "start_period": 1,
            "end_period": 3,
            "start_time": time(7, 0),
            "end_time": time(9, 30),
            "room": "A1.01",
            "location": "Co so 1",
            "session_type": "study",
        },
        {
            "day_of_week": 2,
            "start_period": 4,
            "end_period": 6,
            "start_time": time(9, 15),
            "end_time": time(11, 45),
            "room": "B2.03",
            "location": "Co so 1",
            "session_type": "practice",
        },
        {
            "day_of_week": 3,
            "start_period": 7,
            "end_period": 9,
            "start_time": time(13, 0),
            "end_time": time(15, 30),
            "room": "C3.05",
            "location": "Co so 2",
            "session_type": "study",
        },
        {
            "day_of_week": 4,
            "start_period": 10,
            "end_period": 12,
            "start_time": time(18, 0),
            "end_time": time(20, 30),
            "room": "Online",
            "location": "Truc tuyen",
            "session_type": "online",
        },
        {
            "day_of_week": 5,
            "start_period": 1,
            "end_period": 3,
            "start_time": time(7, 0),
            "end_time": time(9, 30),
            "room": "H6.01",
            "location": "Co so 1",
            "session_type": "study",
        },
        {
            "day_of_week": 6,
            "start_period": 7,
            "end_period": 9,
            "start_time": time(13, 0),
            "end_time": time(15, 30),
            "room": "Lab A2",
            "location": "Co so 1",
            "session_type": "practice",
        },
    ]
    if section.section_code in SAMPLE_TIMETABLE_BY_SECTION:
        sample = SAMPLE_TIMETABLE_BY_SECTION[section.section_code].copy()
        sample.setdefault("status", "published")
        sample.setdefault("weeks", "1-15")
        return sample
    generated = fallback_by_slot[index % len(fallback_by_slot)].copy()
    generated["room"] = generated["room"] if generated["room"] == "Online" else f"{generated['room']}-{(index % 3) + 1}"
    generated["weeks"] = "1-15"
    generated["status"] = "published"
    generated["note"] = f"Lich hoc demo cho {section.section_code}"
    return generated


def _blueprint_slot_key(blueprint: dict[str, Any]) -> tuple[int, str, str]:
    start_value = blueprint.get("start_time")
    end_value = blueprint.get("end_time")
    start_key = start_value.strftime("%H:%M") if hasattr(start_value, "strftime") else str(start_value or "")
    end_key = end_value.strftime("%H:%M") if hasattr(end_value, "strftime") else str(end_value or "")
    return int(blueprint["day_of_week"]), start_key, end_key


def _choose_non_conflicting_blueprint(
    *,
    section: CourseSection,
    index: int,
    linked_student_ids: list[str],
    occupied_slots_by_student: dict[str, set[tuple[int, str, str]]],
) -> dict[str, Any]:
    fallback_count = 6
    primary = _build_generated_timetable_blueprint(section, index)
    candidates = [primary]
    for offset in range(1, fallback_count + 1):
        candidates.append(_build_generated_timetable_blueprint(section, index + offset))

    for blueprint in candidates:
        slot_key = _blueprint_slot_key(blueprint)
        has_conflict = any(slot_key in occupied_slots_by_student.setdefault(student_id, set()) for student_id in linked_student_ids)
        if not has_conflict:
            for student_id in linked_student_ids:
                occupied_slots_by_student.setdefault(student_id, set()).add(slot_key)
            return blueprint

    chosen = candidates[0]
    chosen_slot_key = _blueprint_slot_key(chosen)
    for student_id in linked_student_ids:
        occupied_slots_by_student.setdefault(student_id, set()).add(chosen_slot_key)
    return chosen


def _upsert_attendance_session(
    db: Session,
    *,
    section_id: UUID,
    timetable_entry: TimetableEntry,
) -> tuple[AttendanceSession, bool]:
    session_date = _resolve_session_date(timetable_entry.day_of_week)
    existing = db.scalar(
        select(AttendanceSession).where(
            AttendanceSession.section_id == section_id,
            AttendanceSession.session_date == session_date,
            AttendanceSession.start_time == timetable_entry.start_time,
        )
    )
    opened_at = None
    closed_at = None
    if timetable_entry.start_time:
        opened_at = datetime.combine(session_date, timetable_entry.start_time) - timedelta(minutes=5)
    if timetable_entry.end_time:
        closed_at = datetime.combine(session_date, timetable_entry.end_time)
    values = {
        "section_id": section_id,
        "timetable_entry_id": timetable_entry.id,
        "session_date": session_date,
        "start_time": timetable_entry.start_time,
        "end_time": timetable_entry.end_time,
        "status": "closed",
        "created_by_external_id": "system",
        "opened_at": opened_at,
        "closed_at": closed_at,
        "note": "Seeded from Student Portal core import",
    }
    created = False
    if existing is None:
        existing = attendance_repo.create_attendance_session(db, values)
        created = True
    else:
        for key, value in values.items():
            setattr(existing, key, value)
        db.flush()
    return existing, created


def _upsert_attendance_record(
    db: Session,
    *,
    session_id: UUID,
    session_date: date,
    start_time_value: time | None,
    student_external_id: str,
    status_value: str,
    method: str | None,
) -> tuple[AttendanceRecord, bool]:
    existing = attendance_repo.get_attendance_record(
        db,
        session_id=session_id,
        student_external_id=student_external_id,
    )
    checkin_time = None
    if method and start_time_value:
        offset_minutes = 0 if status_value == "present" else 10
        checkin_time = datetime.combine(session_date, start_time_value) + timedelta(minutes=offset_minutes)
    values = {
        "status": status_value,
        "checkin_time": checkin_time,
        "method": method,
        "note": "Seeded sample attendance",
        "updated_by_external_id": "system",
    }
    record = attendance_repo.upsert_attendance_record(
        db,
        session_id=session_id,
        student_external_id=student_external_id,
        values=values,
    )
    return record, existing is None


def _get_course_source_items(
    *,
    client: CoreApiClient,
    term: str,
    student_ids: list[str],
) -> list[dict[str, Any]]:
    merged: dict[str, dict[str, Any]] = {}

    def add_item(item: dict[str, Any]) -> None:
        section_code = str(item.get("section_code") or "").strip()
        if not section_code:
            return
        current = merged.get(section_code)
        base_student_ids = _extract_ids(item.get("student_ids") or [])
        normalized_item = {
            "term": item.get("term") or term,
            "term_code": item.get("term_code") or term,
            "section_code": section_code,
            "course_code": str(item.get("course_code") or section_code[:10]).strip(),
            "course_name": str(item.get("course_name") or "").strip(),
            "student_ids": base_student_ids,
            "teacher_id": item.get("teacher_id"),
            "teacher_name": item.get("teacher_name"),
            "teacher_email": item.get("teacher_email"),
            "teacher_department": item.get("teacher_department"),
        }
        if current is None:
            merged[section_code] = normalized_item
            return
        current_ids = set(current.get("student_ids") or [])
        for student_id in base_student_ids:
            if student_id not in current_ids:
                current.setdefault("student_ids", []).append(student_id)
                current_ids.add(student_id)
        if not current.get("course_name") and normalized_item["course_name"]:
            current["course_name"] = normalized_item["course_name"]
        if not current.get("course_code") and normalized_item["course_code"]:
            current["course_code"] = normalized_item["course_code"]
        if not current.get("teacher_id") and normalized_item.get("teacher_id"):
            current["teacher_id"] = normalized_item.get("teacher_id")
        for teacher_key in ("teacher_name", "teacher_email", "teacher_department"):
            if not current.get(teacher_key) and normalized_item.get(teacher_key):
                current[teacher_key] = normalized_item.get(teacher_key)

    if student_ids:
        for student_id in student_ids:
            payload = client.get_course_sections_source(term=term, student_id=student_id, limit=100)
            for item in _extract_items(payload, "items"):
                add_item(item)
        payload = client.get_course_sections_source(term=term, limit=100)
        for item in _extract_items(payload, "items"):
            add_item(item)
    else:
        payload = client.get_course_sections_source(term=term, limit=100)
        for item in _extract_items(payload, "items"):
            add_item(item)

    fallback_student_ids = student_ids.copy()
    for fallback in FALLBACK_COURSE_SECTIONS:
        section_code = fallback["section_code"]
        if section_code not in merged:
            merged[section_code] = {
                "term": term,
                "term_code": term,
                "section_code": section_code,
                "course_code": fallback["course_code"],
                "course_name": fallback["course_name"],
                "student_ids": fallback_student_ids.copy(),
                "teacher_id": None,
                "teacher_name": None,
                "teacher_email": None,
                "teacher_department": None,
            }
        else:
            current_ids = set(merged[section_code].get("student_ids") or [])
            for student_id in fallback_student_ids:
                if student_id not in current_ids:
                    merged[section_code].setdefault("student_ids", []).append(student_id)
                    current_ids.add(student_id)
            if not merged[section_code].get("course_name"):
                merged[section_code]["course_name"] = fallback["course_name"]
            if not merged[section_code].get("course_code"):
                merged[section_code]["course_code"] = fallback["course_code"]

    return list(merged.values())


def import_seed_from_core(db: Session, payload: dict[str, Any]) -> ImportFromCoreResponse:
    client = CoreApiClient()
    term_name = str(payload.get("term") or "HK2 (2025 - 2026)").strip()
    term_code = str(payload.get("term_code") or term_name).strip()
    requested_student_ids = _extract_ids(payload.get("student_ids"))
    create_sample_timetable = bool(payload.get("create_sample_timetable", True))
    create_sample_attendance = bool(payload.get("create_sample_attendance", True))

    counters = _ImportCounters()
    missing_students: set[str] = set()
    errors: list[str] = []
    imported_student_ids: set[str] = set()

    try:
        term, created_term = _upsert_term(db, term_code=term_code, term_name=term_name)
        if created_term:
            counters.imported_terms += 1

        student_profiles: dict[str, dict[str, Any]] = {}
        for student_id in requested_student_ids:
            try:
                profile = normalize_student_payload(client.get_student(student_id))
                if not profile["student_external_id"]:
                    missing_students.add(student_id)
                    continue
                student_profiles[profile["student_external_id"]] = profile
                external_user_repo.upsert_external_user(
                    db,
                    external_user_id=profile["student_external_id"],
                    role="student",
                    full_name=profile.get("full_name"),
                    email=profile.get("email"),
                    class_name=profile.get("class_name"),
                    faculty=profile.get("faculty"),
                    program_name=profile.get("program_name"),
                )
                imported_student_ids.add(profile["student_external_id"])
            except Exception:
                missing_students.add(student_id)
                errors.append(f"Student '{student_id}' could not be loaded from Student Portal")

        source_items = _get_course_source_items(client=client, term=term_name, student_ids=list(student_profiles.keys()) or requested_student_ids)
        all_source_student_ids: set[str] = set()
        for item in source_items:
            for student_id in _extract_ids(item.get("student_ids") or []):
                all_source_student_ids.add(student_id)

        unresolved_ids = sorted(all_source_student_ids.difference(student_profiles.keys()))
        if unresolved_ids:
            batch_payload = client.get_students_batch(unresolved_ids)
            for student in _extract_items(batch_payload, "items", "students"):
                profile = normalize_student_payload(student)
                if not profile["student_external_id"]:
                    continue
                student_profiles[profile["student_external_id"]] = profile
                external_user_repo.upsert_external_user(
                    db,
                    external_user_id=profile["student_external_id"],
                    role="student",
                    full_name=profile.get("full_name"),
                    email=profile.get("email"),
                    class_name=profile.get("class_name"),
                    faculty=profile.get("faculty"),
                    program_name=profile.get("program_name"),
                )
                imported_student_ids.add(profile["student_external_id"])
            for missing_id in _extract_ids((batch_payload or {}).get("missing_ids") or []):
                missing_students.add(missing_id)

        section_lookup: dict[str, CourseSection] = {}
        timetable_lookup: dict[str, TimetableEntry] = {}
        occupied_slots_by_student: dict[str, set[tuple[int, str, str]]] = {}
        preferred_faculty = next(
            (profile.get("faculty") for profile in student_profiles.values() if profile.get("faculty")),
            DEFAULT_FACULTY,
        )

        for item_index, item in enumerate(source_items):
            section_code = str(item.get("section_code") or "").strip()
            course_code = str(item.get("course_code") or section_code[:10]).strip()
            course_name = str(item.get("course_name") or "").strip()
            if not section_code or not course_code or not course_name:
                errors.append(f"Skipped invalid course source item '{section_code or 'unknown'}'")
                continue

            teacher_external_id = None
            raw_teacher_id = str(item.get("teacher_id") or "").strip()
            if raw_teacher_id:
                try:
                    teacher_payload = client.get_teacher(raw_teacher_id)
                    teacher = normalize_teacher_payload(teacher_payload)
                    teacher_external_id = teacher["teacher_external_id"] or raw_teacher_id
                    external_user_repo.upsert_external_user(
                        db,
                        external_user_id=teacher_external_id,
                        role="teacher",
                        full_name=teacher.get("full_name") or item.get("teacher_name"),
                        email=teacher.get("email") or item.get("teacher_email"),
                        faculty=teacher.get("faculty") or item.get("teacher_department"),
                    )
                except HTTPException as exc:
                    if exc.status_code != status.HTTP_404_NOT_FOUND:
                        raise
                    errors.append(f"Teacher '{raw_teacher_id}' could not be loaded from Student Portal")

            linked_ids = _extract_ids(item.get("student_ids") or [])
            if requested_student_ids:
                requested_set = set(student_profiles.keys()) or set(requested_student_ids)
                linked_ids = [student_id for student_id in linked_ids if student_id in requested_set]
                if not linked_ids:
                    linked_ids = [student_id for student_id in student_profiles.keys()]

            derived_faculty = _pick_most_common(
                [student_profiles[student_id].get("faculty") for student_id in linked_ids if student_id in student_profiles]
            ) or preferred_faculty
            derived_program_name = _pick_most_common(
                [student_profiles[student_id].get("program_name") for student_id in linked_ids if student_id in student_profiles]
            )

            section, created_section = _upsert_section(
                db,
                term_id=term.id,
                section_code=section_code,
                course_code=course_code,
                course_name=course_name,
                faculty=derived_faculty,
                program_name=derived_program_name,
                teacher_external_id=teacher_external_id,
            )
            section_lookup[section_code] = section
            if created_section:
                counters.imported_sections += 1

            for student_id in linked_ids:
                if student_id not in student_profiles:
                    missing_students.add(student_id)
                    continue
                _, created_link = section_repo.add_student_to_section(
                    db,
                    section_id=section.id,
                    student_external_id=student_id,
                    enrollment_status="active",
                )
                if created_link:
                    counters.linked_students += 1
            if create_sample_timetable:
                blueprint = _choose_non_conflicting_blueprint(
                    section=section,
                    index=item_index,
                    linked_student_ids=linked_ids,
                    occupied_slots_by_student=occupied_slots_by_student,
                )
                entry, created_entry = _upsert_timetable_entry(
                    db,
                    section_id=section.id,
                    blueprint=blueprint,
                )
                timetable_lookup[section_code] = entry
                if created_entry:
                    counters.created_timetable_entries += 1

        _upsert_global_policy(db)

        if create_sample_attendance:
            for section_code, section in section_lookup.items():
                entry = timetable_lookup.get(section_code)
                if entry is None:
                    entry = db.scalar(
                        select(TimetableEntry)
                        .where(TimetableEntry.section_id == section.id)
                        .order_by(TimetableEntry.day_of_week, TimetableEntry.start_period.nullslast(), TimetableEntry.start_time)
                    )
                if entry is None:
                    errors.append(f"No timetable entry available for section '{section_code}' to create attendance session")
                    continue

                session, created_session = _upsert_attendance_session(db, section_id=section.id, timetable_entry=entry)
                if created_session:
                    counters.created_attendance_sessions += 1

                attendance_blueprint = SAMPLE_ATTENDANCE_BY_SECTION.get(
                    section_code,
                    {"status": "present", "method": "qr"},
                )
                target_student_ids = [
                    student.student_external_id
                    for student in section.students
                    if student.enrollment_status == "active"
                ]
                for student_id in target_student_ids:
                    _, created_record = _upsert_attendance_record(
                        db,
                        session_id=session.id,
                        session_date=session.session_date,
                        start_time_value=session.start_time,
                        student_external_id=student_id,
                        status_value=str(attendance_blueprint["status"]),
                        method=attendance_blueprint.get("method"),
                    )
                    if created_record:
                        counters.created_attendance_records += 1

        db.commit()
    except Exception:
        db.rollback()
        raise

    counters.imported_students = len(imported_student_ids)
    return ImportFromCoreResponse(
        imported_terms=counters.imported_terms,
        imported_sections=counters.imported_sections,
        imported_students=counters.imported_students,
        linked_students=counters.linked_students,
        created_timetable_entries=counters.created_timetable_entries,
        created_attendance_sessions=counters.created_attendance_sessions,
        created_attendance_records=counters.created_attendance_records,
        missing_students=sorted(missing_students),
        errors=errors,
    )


def get_import_debug_summary(
    db: Session,
    term: str | None = None,
    term_code: str | None = None,
    term_id: UUID | None = None,
) -> ImportDebugSummaryResponse:
    terms = _resolve_db_terms(db, term=term, term_code=term_code, term_id=term_id)
    requested_filter = bool(term or term_code or term_id)

    if requested_filter and not terms:
        return ImportDebugSummaryResponse(
            terms_count=0,
            course_sections_count=0,
            course_section_students_count=0,
            external_users_cache_count=int(db.scalar(select(func.count()).select_from(ExternalUserCache)) or 0),
            timetable_entries_count=0,
            terms=[],
            sections_by_status=ImportDebugSummaryStatusCounts(draft=0, published=0, archived=0),
            duplicate_sections=[],
            latest_sections=[],
            timetable_entries_by_status=ImportDebugSummaryTimetableStatusCounts(draft=0, published=0, cancelled=0),
            latest_timetable_entries=[],
            attendance_sessions=int(db.scalar(select(func.count()).select_from(AttendanceSession)) or 0),
            attendance_records=int(db.scalar(select(func.count()).select_from(AttendanceRecord)) or 0),
        )

    term_ids = [term.id for term in terms]
    overall_term_filter = []
    if term_ids:
        overall_term_filter.append(CourseSection.term_id.in_(term_ids))

    def _apply_term_filter(stmt):
        if overall_term_filter:
            return stmt.where(*overall_term_filter)
        return stmt

    course_sections_count = int(db.scalar(_apply_term_filter(select(func.count()).select_from(CourseSection))) or 0)
    course_section_students_count = int(
        db.scalar(
            _apply_term_filter(
                select(func.count()).select_from(CourseSectionStudent).join(CourseSection, CourseSectionStudent.section_id == CourseSection.id)
            )
        )
        or 0
    )
    timetable_entries_count = int(
        db.scalar(
            _apply_term_filter(
                select(func.count()).select_from(TimetableEntry).join(CourseSection, CourseSection.id == TimetableEntry.section_id)
            )
        )
        or 0
    )

    term_rows = db.execute(
        select(
            AcademicTerm.id,
            AcademicTerm.term_code,
            AcademicTerm.term_name,
            func.count(distinct(CourseSection.id)).label("sections_count"),
            func.count(CourseSectionStudent.id).label("student_links_count"),
        )
        .outerjoin(CourseSection, CourseSection.term_id == AcademicTerm.id)
        .outerjoin(CourseSectionStudent, CourseSectionStudent.section_id == CourseSection.id)
        .group_by(AcademicTerm.id)
        .order_by(AcademicTerm.start_date.desc().nullslast(), AcademicTerm.term_code)
        .where(AcademicTerm.id.in_(term_ids))
    ).all()

    sections_by_status_rows = db.execute(
        select(CourseSection.status, func.count().label("count"))
        .where(*overall_term_filter)
        .group_by(CourseSection.status)
    ).all()
    status_counts = {"draft": 0, "published": 0, "archived": 0}
    for status, count in sections_by_status_rows:
        if status in status_counts:
            status_counts[status] = int(count)
        elif status == "active":
            status_counts["published"] += int(count)

    duplicate_rows = db.execute(
        select(
            CourseSection.term_id,
            CourseSection.section_code,
            func.count().label("count"),
        )
        .where(*overall_term_filter)
        .group_by(CourseSection.term_id, CourseSection.section_code)
        .having(func.count() > 1)
    ).all()

    latest_rows = db.execute(
        select(
            CourseSection.id,
            AcademicTerm.term_code,
            CourseSection.section_code,
            CourseSection.course_code,
            CourseSection.course_name,
            CourseSection.teacher_external_id,
            CourseSection.student_count,
            CourseSection.status,
        )
        .join(AcademicTerm, CourseSection.term_id == AcademicTerm.id, isouter=True)
        .where(*overall_term_filter)
        .order_by(CourseSection.updated_at.desc())
        .limit(10)
    ).all()

    timetable_status_rows = db.execute(
        _apply_term_filter(
            select(TimetableEntry.status, func.count().label("count"))
            .select_from(TimetableEntry)
            .join(CourseSection, CourseSection.id == TimetableEntry.section_id)
            .group_by(TimetableEntry.status)
        )
    ).all()
    timetable_status_counts = {"draft": 0, "published": 0, "cancelled": 0}
    for status, count in timetable_status_rows:
        if status in timetable_status_counts:
            timetable_status_counts[status] = int(count)

    latest_timetable_rows = db.execute(
        _apply_term_filter(
            select(
                TimetableEntry.id,
                AcademicTerm.term_code,
                CourseSection.section_code,
                CourseSection.course_code,
                CourseSection.course_name,
                TimetableEntry.day_of_week,
                TimetableEntry.start_time,
                TimetableEntry.end_time,
                TimetableEntry.room,
                TimetableEntry.weeks,
                TimetableEntry.status,
            )
            .select_from(TimetableEntry)
            .join(CourseSection, CourseSection.id == TimetableEntry.section_id)
            .join(AcademicTerm, AcademicTerm.id == CourseSection.term_id, isouter=True)
            .order_by(TimetableEntry.updated_at.desc())
            .limit(10)
        )
    ).all()

    return ImportDebugSummaryResponse(
        terms_count=len(terms),
        course_sections_count=course_sections_count,
        course_section_students_count=course_section_students_count,
        external_users_cache_count=int(db.scalar(select(func.count()).select_from(ExternalUserCache)) or 0),
        timetable_entries_count=timetable_entries_count,
        terms=[
            ImportDebugSummaryTerm(
                id=str(row.id),
                term_code=row.term_code,
                term_name=row.term_name,
                sections_count=int(row.sections_count),
                student_links_count=int(row.student_links_count),
            )
            for row in term_rows
        ],
        sections_by_status=ImportDebugSummaryStatusCounts(**status_counts),
        duplicate_sections=[
            ImportDebugSummaryDuplicateSection(
                term_id=str(row.term_id),
                section_code=row.section_code,
                count=int(row.count),
            )
            for row in duplicate_rows
        ],
        latest_sections=[
            ImportDebugSummaryLatestSection(
                id=str(row.id),
                term_code=row.term_code,
                section_code=row.section_code,
                course_code=row.course_code,
                course_name=row.course_name,
                teacher_external_id=row.teacher_external_id,
                student_count=int(row.student_count or 0),
                status=row.status,
            )
            for row in latest_rows
        ],
        timetable_entries_by_status=ImportDebugSummaryTimetableStatusCounts(**timetable_status_counts),
        latest_timetable_entries=[
            ImportDebugSummaryLatestTimetableEntry(
                id=str(row.id),
                term_code=row.term_code,
                section_code=row.section_code,
                course_code=row.course_code,
                course_name=row.course_name,
                day_of_week=int(row.day_of_week),
                start_time=row.start_time,
                end_time=row.end_time,
                room=row.room,
                weeks=row.weeks,
                status=row.status,
            )
            for row in latest_timetable_rows
        ],
        attendance_sessions=int(db.scalar(select(func.count()).select_from(AttendanceSession)) or 0),
        attendance_records=int(db.scalar(select(func.count()).select_from(AttendanceRecord)) or 0),
    )


def get_source_terms() -> SourceTermsResponse:
    payload = CoreApiClient().get_source_terms() or {}
    terms = payload.get("terms") or []
    return SourceTermsResponse(
        terms=terms,
        latest_term_code=payload.get("latest_term_code"),
        total=int(payload.get("total") or len(terms)),
    )


def _normalize_csv_value(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _parse_csv_time(value: str | None, *, row_number: int, field_name: str, section_code: str | None) -> time | None:
    normalized = _normalize_csv_value(value)
    if normalized is None:
        return None
    try:
        return datetime.strptime(normalized, "%H:%M").time()
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name} format, expected HH:mm") from exc


def _parse_csv_int(
    value: str | None,
    *,
    row_number: int,
    field_name: str,
    minimum: int | None = None,
    maximum: int | None = None,
) -> int | None:
    normalized = _normalize_csv_value(value)
    if normalized is None:
        return None
    try:
        parsed = int(normalized)
    except ValueError as exc:
        raise ValueError(f"Invalid {field_name}, expected integer") from exc
    if minimum is not None and parsed < minimum:
        raise ValueError(f"Invalid {field_name}, expected >= {minimum}")
    if maximum is not None and parsed > maximum:
        raise ValueError(f"Invalid {field_name}, expected <= {maximum}")
    return parsed


def _upsert_timetable_entry_for_section(
    db: Session,
    *,
    section: CourseSection,
    values: dict[str, Any],
) -> str:
    existing = db.scalar(
        select(TimetableEntry).where(
            TimetableEntry.section_id == section.id,
            TimetableEntry.day_of_week == values["day_of_week"],
            TimetableEntry.start_time == values.get("start_time"),
            TimetableEntry.end_time == values.get("end_time"),
            TimetableEntry.room == values.get("room"),
        )
    )
    if existing is None:
        timetable_repo.create_timetable_entry(db, values)
        return "created"

    timetable_repo.update_timetable_entry(db, existing, values)
    return "updated"


def import_timetable_entries_from_payload(db: Session, payload: dict[str, Any]) -> TimetableEntriesImportResponse:
    term_code = str(payload.get("term_code") or "").strip()
    term = _get_term_by_code(db, term_code)
    if term is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Academic term '{term_code}' not found")

    entries = payload.get("entries") or []
    created = 0
    updated = 0
    skipped = 0
    missing_sections: set[str] = set()
    warnings: list[str] = []
    errors: list[str] = []

    try:
        for index, entry in enumerate(entries, start=1):
            section_code = str(entry.get("section_code") or "").strip()
            if not section_code:
                skipped += 1
                errors.append(f"Entry #{index} is missing section_code")
                continue

            section = section_repo.get_section_by_term_and_code(db, term_id=term.id, section_code=section_code)
            if section is None:
                skipped += 1
                missing_sections.add(section_code)
                warnings.append(f"Entry #{index} skipped because section_code '{section_code}' was not found in term {term_code}.")
                continue

            start_time = entry.get("start_time")
            end_time = entry.get("end_time")
            room = entry.get("room")
            day_of_week = int(entry["day_of_week"])

            existing = db.scalar(
                select(TimetableEntry).where(
                    TimetableEntry.section_id == section.id,
                    TimetableEntry.day_of_week == day_of_week,
                    TimetableEntry.start_time == start_time,
                    TimetableEntry.end_time == end_time,
                    TimetableEntry.room == room,
                )
            )

            values = {
                "section_id": section.id,
                "day_of_week": day_of_week,
                "start_period": entry.get("start_period"),
                "end_period": entry.get("end_period"),
                "start_time": start_time,
                "end_time": end_time,
                "room": room,
                "weeks": entry.get("weeks"),
                "location": entry.get("location"),
                "valid_from": entry.get("valid_from"),
                "valid_to": entry.get("valid_to"),
                "status": entry.get("status") or "published",
                "session_type": entry.get("session_type") or "study",
                "note": entry.get("note"),
            }

            if existing is None:
                timetable_repo.create_timetable_entry(db, values)
                created += 1
            else:
                timetable_repo.update_timetable_entry(db, existing, values)
                updated += 1

        db.commit()
    except Exception:
        db.rollback()
        raise

    return TimetableEntriesImportResponse(
        term_code=term.term_code,
        term_id=term.id,
        received_entries=len(entries),
        created=created,
        updated=updated,
        skipped=skipped,
        missing_sections=sorted(missing_sections),
        warnings=warnings,
        errors=errors,
    )


def import_timetable_entries_from_csv(
    db: Session,
    *,
    filename: str,
    content: bytes,
) -> TimetableEntriesCsvImportResponse:
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .csv files are supported")
    if len(content) > MAX_TIMETABLE_CSV_BYTES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is too large")

    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV must be UTF-8 or UTF-8-SIG encoded") from exc

    reader = csv.DictReader(io.StringIO(decoded))
    fieldnames = [str(name or "").strip() for name in (reader.fieldnames or [])]
    missing_columns = [column for column in REQUIRED_TIMETABLE_CSV_COLUMNS if column not in fieldnames]
    if missing_columns:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Missing required CSV columns: {', '.join(missing_columns)}",
        )

    created = 0
    updated = 0
    skipped = 0
    missing_sections: set[str] = set()
    invalid_rows: list[TimetableCsvInvalidRow] = []
    warnings: list[str] = []
    errors: list[str] = []

    try:
        rows = list(reader)
        for row_number, row in enumerate(rows, start=2):
            section_code = _normalize_csv_value(row.get("section_code"))
            term_code = _normalize_csv_value(row.get("term_code"))

            try:
                if term_code is None:
                    raise ValueError("Missing term_code")
                if section_code is None:
                    raise ValueError("Missing section_code")

                day_of_week = _parse_csv_int(row.get("day_of_week"), row_number=row_number, field_name="day_of_week", minimum=1, maximum=7)
                if day_of_week is None:
                    raise ValueError("Missing day_of_week")

                start_time = _parse_csv_time(row.get("start_time"), row_number=row_number, field_name="start_time", section_code=section_code)
                end_time = _parse_csv_time(row.get("end_time"), row_number=row_number, field_name="end_time", section_code=section_code)
                if start_time is None:
                    raise ValueError("Missing start_time")
                if end_time is None:
                    raise ValueError("Missing end_time")
                if end_time <= start_time:
                    raise ValueError("end_time must be greater than start_time")

                start_period = _parse_csv_int(row.get("start_period"), row_number=row_number, field_name="start_period", minimum=1)
                end_period = _parse_csv_int(row.get("end_period"), row_number=row_number, field_name="end_period", minimum=1)
                if start_period is not None and end_period is not None and end_period < start_period:
                    raise ValueError("end_period must be greater than or equal to start_period")

                term = _get_term_by_code(db, term_code)
                if term is None:
                    skipped += 1
                    warnings.append(f"Row {row_number} skipped because term_code '{term_code}' was not found.")
                    continue

                section = section_repo.get_section_by_term_and_code(db, term_id=term.id, section_code=section_code)
                if section is None:
                    skipped += 1
                    missing_sections.add(section_code)
                    warnings.append(
                        f"Row {row_number} skipped because section_code '{section_code}' was not found in term {term_code}."
                    )
                    continue

                values = {
                    "section_id": section.id,
                    "day_of_week": day_of_week,
                    "start_period": start_period,
                    "end_period": end_period,
                    "start_time": start_time,
                    "end_time": end_time,
                    "room": _normalize_csv_value(row.get("room")),
                    "weeks": _normalize_csv_value(row.get("weeks")),
                    "location": _normalize_csv_value(row.get("location")) or _normalize_csv_value(row.get("building")),
                    "valid_from": None,
                    "valid_to": None,
                    "status": _normalize_csv_value(row.get("status")) or "published",
                    "session_type": _normalize_csv_value(row.get("session_type")) or _normalize_csv_value(row.get("lesson_type")) or "study",
                    "note": _normalize_csv_value(row.get("note")),
                }

                result = _upsert_timetable_entry_for_section(db, section=section, values=values)
                if result == "created":
                    created += 1
                else:
                    updated += 1
            except ValueError as exc:
                skipped += 1
                invalid_rows.append(
                    TimetableCsvInvalidRow(
                        row=row_number,
                        section_code=section_code,
                        error=str(exc),
                    )
                )

        db.commit()
    except Exception:
        db.rollback()
        raise

    return TimetableEntriesCsvImportResponse(
        filename=filename,
        received_rows=len(rows),
        created=created,
        updated=updated,
        skipped=skipped,
        missing_sections=sorted(missing_sections),
        invalid_rows=invalid_rows,
        warnings=warnings,
        errors=errors,
    )


def build_timetable_entries_csv_scaffold(
    db: Session,
    *,
    term_code: str,
    include_optional: bool = True,
) -> tuple[str, bytes]:
    normalized_term_code = str(term_code or "").strip()
    term = _get_term_by_code(db, normalized_term_code)
    if term is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Academic term not found for term_code={normalized_term_code}",
        )

    sections = section_repo.list_sections(db, term_id=term.id)
    if not sections:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No course sections found for term_code={normalized_term_code}. Import course sections first.",
        )

    base_columns = [
        "term_code",
        "section_code",
        "course_code",
        "course_name",
        "teacher_external_id",
        "student_count",
        "day_of_week",
        "start_time",
        "end_time",
        "room",
        "weeks",
        "status",
    ]
    optional_columns = ["note", "building", "lesson_type", "start_period", "end_period", "location"]
    fieldnames = base_columns + (optional_columns if include_optional else [])

    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=fieldnames, lineterminator="\n")
    writer.writeheader()

    for section in sections:
        row = {
            "term_code": term.term_code,
            "section_code": section.section_code,
            "course_code": section.course_code,
            "course_name": section.course_name,
            "teacher_external_id": section.teacher_external_id or "",
            "student_count": section.student_count or 0,
            "day_of_week": "",
            "start_time": "",
            "end_time": "",
            "room": "",
            "weeks": "1-15",
            "status": "published",
        }
        if include_optional:
            row.update(
                {
                    "note": "",
                    "building": "",
                    "lesson_type": "",
                    "start_period": "",
                    "end_period": "",
                    "location": "",
                }
            )
        writer.writerow(row)

    filename = f"timetable_entries_scaffold_{term.term_code}.csv"
    return filename, buffer.getvalue().encode("utf-8-sig")
