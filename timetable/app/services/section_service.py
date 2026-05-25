from __future__ import annotations

from collections import Counter, defaultdict
from collections.abc import Iterable
from datetime import date
import re
import unicodedata
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic_term import AcademicTerm
from app.models.course_section import CourseSection
from app.repositories import external_user_repo, section_repo
from app.schemas.section_schema import (
    CoreCourseSectionsImportResponse,
    CourseSubjectSummaryRead,
    CourseSectionRead,
    SectionStudentRead,
    SectionStudentsImportResponse,
    TeacherOptionRead,
)
from app.repositories import timetable_repo
from app.services.core_api_client import CoreApiClient, normalize_student_payload, normalize_teacher_payload


def _extract_items(payload: dict | list | None, *keys: str) -> list[dict]:
    if isinstance(payload, list):
        return [item for item in payload if isinstance(item, dict)]
    if not isinstance(payload, dict):
        return []
    for key in keys:
        value = payload.get(key)
        if isinstance(value, list):
            return [item for item in value if isinstance(item, dict)]
    return []


def _extract_string_ids(values: Iterable[object]) -> list[str]:
    clean_ids: list[str] = []
    for value in values:
        normalized = str(value).strip()
        if normalized:
            clean_ids.append(normalized)
    return clean_ids


def _pick_most_common(values: Iterable[str | None]) -> str | None:
    normalized = [str(value).strip() for value in values if str(value or "").strip()]
    if not normalized:
        return None
    counts = Counter(normalized)
    return counts.most_common(1)[0][0]


def _pick_best_source_term(source_terms: list[dict]) -> dict | None:
    if not source_terms:
        return None

    preferred = [term for term in source_terms if bool(term.get("has_course_sections"))]
    if preferred:
        return preferred[0]

    fallback = [term for term in source_terms if int(term.get("course_count") or 0) > 0]
    if fallback:
        return fallback[0]

    return source_terms[0]


def _normalize_term_lookup(value: str | None) -> str:
    return re.sub(r"[\s()_\-]+", "", str(value or "").strip()).lower()


def _normalize_search_text(value: str | None) -> str:
    raw = unicodedata.normalize("NFKD", str(value or "").strip().lower())
    return "".join(char for char in raw if not unicodedata.combining(char))


def _find_source_term(source_terms: list[dict], value: str | None) -> dict | None:
    normalized_value = _normalize_term_lookup(value)
    if not normalized_value:
        return None

    for term in source_terms:
        candidates = {
            _normalize_term_lookup(term.get("term_name")),
            _normalize_term_lookup(term.get("term_code")),
        }
        if normalized_value in candidates:
            return term
    return None


def _infer_term_date_range(term_code: str | None) -> tuple[date, date] | None:
    normalized = str(term_code or "").strip().upper()
    match = re.fullmatch(r"HK([123])_(\d{4})_(\d{4})", normalized)
    if not match:
        return None

    term_number = int(match.group(1))
    year_start = int(match.group(2))
    year_end = int(match.group(3))
    if year_end != year_start + 1:
        return None

    if term_number == 1:
        return date(year_start, 9, 1), date(year_start, 12, 31)
    if term_number == 2:
        return date(year_end, 2, 1), date(year_end, 6, 30)
    return date(year_end, 7, 1), date(year_end, 8, 31)


def _apply_inferred_term_dates(values: dict) -> dict:
    normalized = dict(values)
    if normalized.get("start_date") and normalized.get("end_date"):
        return normalized
    inferred = _infer_term_date_range(normalized.get("term_code"))
    if inferred is None:
        return normalized
    normalized.setdefault("start_date", inferred[0])
    normalized.setdefault("end_date", inferred[1])
    return normalized


def _derive_section_academic_profile(
    *,
    linked_student_ids: list[str],
    student_profiles_by_id: dict[str, dict],
    fallback_faculty: str | None = None,
    fallback_program_name: str | None = None,
) -> tuple[str | None, str | None]:
    matched_profiles = [
        student_profiles_by_id[student_id]
        for student_id in linked_student_ids
        if student_id in student_profiles_by_id
    ]
    faculty = _pick_most_common(profile.get("faculty") for profile in matched_profiles) or fallback_faculty
    program_name = _pick_most_common(profile.get("program_name") for profile in matched_profiles) or fallback_program_name
    return faculty, program_name


def _to_course_section_read(db: Session, section: CourseSection) -> CourseSectionRead:
    teacher = None
    if section.teacher_external_id:
        teacher = external_user_repo.get_cached_user(db, section.teacher_external_id, role="teacher")
    return CourseSectionRead(
        id=section.id,
        term_id=section.term_id,
        course_code=section.course_code,
        course_name=section.course_name,
        section_code=section.section_code,
        teacher_external_id=section.teacher_external_id,
        teacher_name=teacher.full_name if teacher else None,
        faculty=section.faculty,
        program_name=section.program_name,
        student_count=section.student_count,
        total_sessions=section.total_sessions,
        note=section.note,
        status=section.status,
        term_code=section.term.term_code if section.term else None,
        term_name=section.term.term_name if section.term else None,
        created_at=section.created_at,
        updated_at=section.updated_at,
    )


def get_section_or_404(db: Session, section_id: UUID):
    section = section_repo.get_section(db, section_id)
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course section not found")
    return section


def create_term(db: Session, values: dict):
    try:
        term = section_repo.create_term(db, _apply_inferred_term_dates(values))
        db.commit()
        return term
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Term code already exists") from exc


def update_term(db: Session, term_id: UUID, values: dict):
    term = section_repo.get_term(db, term_id)
    if term is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic term not found")
    try:
        updated = section_repo.update_term(db, term, _apply_inferred_term_dates(values))
        db.commit()
        return updated
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Term update conflicts with existing data") from exc


def backfill_term_date_ranges(db: Session) -> dict[str, list[str] | int]:
    updated_term_codes: list[str] = []
    skipped_term_codes: list[str] = []
    for term in section_repo.list_terms(db):
        if term.start_date and term.end_date:
            skipped_term_codes.append(term.term_code)
            continue
        inferred = _infer_term_date_range(term.term_code)
        if inferred is None:
            skipped_term_codes.append(term.term_code)
            continue
        term.start_date = term.start_date or inferred[0]
        term.end_date = term.end_date or inferred[1]
        updated_term_codes.append(term.term_code)
    db.commit()
    return {
        "updated_count": len(updated_term_codes),
        "updated_term_codes": updated_term_codes,
        "skipped_term_codes": skipped_term_codes,
    }


def sync_teacher_cache_from_portal(db: Session) -> int:
    teacher_accounts = CoreApiClient().get_teacher_accounts() or []
    synced_count = 0
    for teacher in teacher_accounts:
        teacher_id = str(teacher.get("username") or "").strip()
        if not teacher_id:
            continue
        external_user_repo.upsert_external_user(
            db,
            external_user_id=teacher_id,
            role="teacher",
            full_name=teacher.get("name"),
            email=teacher.get("email"),
            faculty=teacher.get("faculty") or teacher.get("department"),
        )
        synced_count += 1
    db.commit()
    return synced_count


def search_teachers(
    db: Session,
    *,
    q: str | None = None,
    faculty: str | None = None,
    limit: int = 50,
    refresh: bool = False,
) -> list[TeacherOptionRead]:
    if refresh:
        sync_teacher_cache_from_portal(db)
    teachers = external_user_repo.search_cached_users(
        db,
        role="teacher",
        q=q,
        faculty=faculty,
        limit=limit,
    )
    if not teachers and q:
        sync_teacher_cache_from_portal(db)
        teachers = external_user_repo.search_cached_users(
            db,
            role="teacher",
            q=q,
            faculty=faculty,
            limit=limit,
        )
    if q and not teachers:
        normalized_query = _normalize_search_text(q)
        fallback_teachers = external_user_repo.search_cached_users(
            db,
            role="teacher",
            faculty=faculty,
            limit=max(limit * 5, 200),
        )
        teachers = [
            teacher
            for teacher in fallback_teachers
            if normalized_query in _normalize_search_text(teacher.external_user_id)
            or normalized_query in _normalize_search_text(teacher.full_name)
            or normalized_query in _normalize_search_text(teacher.faculty)
        ][:limit]
    return [
        TeacherOptionRead(
            teacher_id=teacher.external_user_id,
            teacher_name=teacher.full_name,
            faculty=teacher.faculty,
            email=teacher.email,
        )
        for teacher in teachers
    ]


def list_sections_enriched(
    db: Session,
    *,
    term_id: UUID | None = None,
    teacher_external_id: str | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    status: str | None = None,
) -> list[CourseSectionRead]:
    sections = section_repo.list_sections(
        db,
        term_id=term_id,
        teacher_external_id=teacher_external_id,
        faculty=faculty,
        program_name=program_name,
        course_code=course_code,
        status=status,
    )
    teacher_ids = [section.teacher_external_id for section in sections if section.teacher_external_id]
    teachers = external_user_repo.get_cached_users(db, teacher_ids, role="teacher")
    return [
        CourseSectionRead(
            id=section.id,
            term_id=section.term_id,
            course_code=section.course_code,
            course_name=section.course_name,
            section_code=section.section_code,
            teacher_external_id=section.teacher_external_id,
            teacher_name=teachers.get(section.teacher_external_id).full_name if section.teacher_external_id and teachers.get(section.teacher_external_id) else None,
            faculty=section.faculty,
            program_name=section.program_name,
            student_count=section.student_count,
            total_sessions=section.total_sessions,
            note=section.note,
            status=section.status,
            term_code=section.term.term_code if section.term else None,
            term_name=section.term.term_name if section.term else None,
            created_at=section.created_at,
            updated_at=section.updated_at,
        )
        for section in sections
    ]


def list_course_subjects(
    db: Session,
    *,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
) -> list[CourseSubjectSummaryRead]:
    sections = section_repo.list_sections(
        db,
        term_id=term_id,
        faculty=faculty,
        program_name=program_name,
    )
    scheduled_rows = timetable_repo.list_timetable_entries_with_sections(
        db,
        term_id=term_id,
        faculty=faculty,
        program_name=program_name,
    )

    grouped_sections: dict[tuple[UUID | None, str | None, str | None, str, str], set[UUID]] = defaultdict(set)
    scheduled_counts: dict[tuple[UUID | None, str | None, str | None, str, str], int] = defaultdict(int)
    term_meta: dict[tuple[UUID | None, str | None, str | None, str, str], tuple[str | None, str | None]] = {}

    for section in sections:
        key = (section.term_id, section.faculty, section.program_name, section.course_code, section.course_name)
        grouped_sections[key].add(section.id)
        term_meta[key] = (
            section.term.term_code if section.term else None,
            section.term.term_name if section.term else None,
        )

    for entry, section in scheduled_rows:
        key = (section.term_id, section.faculty, section.program_name, section.course_code, section.course_name)
        grouped_sections[key].add(section.id)
        scheduled_counts[key] += 1
        term_meta[key] = (
            section.term.term_code if section.term else None,
            section.term.term_name if section.term else None,
        )

    items = [
        CourseSubjectSummaryRead(
            course_id=course_code,
            course_code=course_code,
            course_name=course_name,
            term_id=term_key,
            term_code=term_meta.get(key, (None, None))[0],
            term_name=term_meta.get(key, (None, None))[1],
            faculty=faculty_name,
            program_name=program,
            section_count=len(section_ids),
            scheduled_count=scheduled_counts.get(key, 0),
        )
        for key, section_ids in grouped_sections.items()
        for term_key, faculty_name, program, course_code, course_name in [key]
    ]
    return sorted(
        items,
        key=lambda item: (
            item.faculty or "",
            item.program_name or "",
            item.course_name,
            item.course_code,
        ),
    )


def get_section_enriched(db: Session, section_id: UUID) -> CourseSectionRead:
    return _to_course_section_read(db, get_section_or_404(db, section_id))


def create_section(db: Session, values: dict):
    try:
        section = section_repo.create_section(db, values)
        db.commit()
        return _to_course_section_read(db, section)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Section already exists in this term") from exc


def update_section(db: Session, section_id: UUID, values: dict):
    section = get_section_or_404(db, section_id)
    try:
        updated = section_repo.update_section(db, section, values)
        db.commit()
        return _to_course_section_read(db, updated)
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Section update conflicts with existing data") from exc


def delete_section(db: Session, section_id: UUID) -> None:
    section = get_section_or_404(db, section_id)
    section_repo.delete_section(db, section)
    db.commit()


def add_student(db: Session, section_id: UUID, student_external_id: str, enrollment_status: str = "active"):
    get_section_or_404(db, section_id)
    enrollment, _ = section_repo.add_student_to_section(
        db,
        section_id=section_id,
        student_external_id=student_external_id,
        enrollment_status=enrollment_status,
    )
    db.commit()
    return enrollment


def import_students(db: Session, section_id: UUID, payload: dict) -> SectionStudentsImportResponse:
    get_section_or_404(db, section_id)
    student_ids = payload.get("student_ids")
    source = payload.get("source")
    if source in {"class_name", "portal"} and payload.get("class_name"):
        class_name = payload.get("class_name")
        students_payload = CoreApiClient().get_students_by_class(class_name)
        normalized = [normalize_student_payload(student) for student in _extract_items(students_payload, "items", "students")]
        student_ids = [item["student_external_id"] for item in normalized if item["student_external_id"]]
        for item in normalized:
            if item["student_external_id"]:
                external_user_repo.upsert_external_user(
                    db,
                    external_user_id=item["student_external_id"],
                    role="student",
                    full_name=item.get("full_name"),
                    email=item.get("email"),
                    class_name=item.get("class_name"),
                    faculty=item.get("faculty"),
                    program_name=item.get("program_name"),
                )
    elif source == "portal" and student_ids:
        students_payload = CoreApiClient().get_students_batch(_extract_string_ids(student_ids))
        normalized = [normalize_student_payload(student) for student in _extract_items(students_payload, "items", "students")]
        student_ids = [item["student_external_id"] for item in normalized if item["student_external_id"]]
        for item in normalized:
            if item["student_external_id"]:
                external_user_repo.upsert_external_user(
                    db,
                    external_user_id=item["student_external_id"],
                    role="student",
                    full_name=item.get("full_name"),
                    email=item.get("email"),
                    class_name=item.get("class_name"),
                    faculty=item.get("faculty"),
                    program_name=item.get("program_name"),
                )
    if not student_ids:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="student_ids or class_name source is required")

    imported = 0
    skipped = 0
    clean_ids = [str(student_id).strip() for student_id in student_ids if str(student_id).strip()]
    for student_id in clean_ids:
        _, created = section_repo.add_student_to_section(db, section_id=section_id, student_external_id=student_id)
        imported += 1 if created else 0
        skipped += 0 if created else 1
    db.commit()
    return SectionStudentsImportResponse(imported_count=imported, skipped_count=skipped, student_ids=clean_ids)


def list_section_students_enriched(db: Session, section_id: UUID) -> list[SectionStudentRead]:
    get_section_or_404(db, section_id)
    enrollments = section_repo.list_section_students(db, section_id)
    cached = external_user_repo.get_cached_users(
        db, [enrollment.student_external_id for enrollment in enrollments], role="student"
    )
    return [
        SectionStudentRead(
            id=enrollment.id,
            section_id=enrollment.section_id,
            student_external_id=enrollment.student_external_id,
            enrollment_status=enrollment.enrollment_status,
            created_at=enrollment.created_at,
            full_name=cached.get(enrollment.student_external_id).full_name if cached.get(enrollment.student_external_id) else None,
            class_name=cached.get(enrollment.student_external_id).class_name if cached.get(enrollment.student_external_id) else None,
            faculty=cached.get(enrollment.student_external_id).faculty if cached.get(enrollment.student_external_id) else None,
        )
        for enrollment in enrollments
    ]


def _get_term_by_code(db: Session, term_code: str) -> AcademicTerm | None:
    return section_repo.get_term_by_code(db, term_code)


def _get_section_by_term_and_code(db: Session, *, term_id: UUID | None, section_code: str) -> CourseSection | None:
    if term_id is None:
        return None
    return section_repo.get_section_by_term_and_code(db, term_id=term_id, section_code=section_code)


def assign_teacher(db: Session, section_id: UUID, teacher_id: str, *, commit: bool = True):
    section = get_section_or_404(db, section_id)
    teacher_payload = CoreApiClient().get_teacher(teacher_id)
    teacher = normalize_teacher_payload(teacher_payload)
    teacher_external_id = teacher["teacher_external_id"] or teacher_id
    external_user_repo.upsert_external_user(
        db,
        external_user_id=teacher_external_id,
        role="teacher",
        full_name=teacher.get("full_name"),
        email=teacher.get("email"),
        faculty=teacher.get("faculty"),
    )
    updated = section_repo.update_section(
        db,
        section,
        {
            "teacher_external_id": teacher_external_id,
            "faculty": section.faculty or teacher.get("faculty"),
            "program_name": section.program_name,
        },
    )
    if commit:
        db.commit()
    return _to_course_section_read(db, updated) if commit else updated


def import_course_sections_from_core(db: Session, payload: dict) -> CoreCourseSectionsImportResponse:
    client = CoreApiClient()
    requested_term = str(payload.get("term") or "").strip() or None
    requested_term_code = str(payload.get("term_code") or "").strip() or None
    resolved_source_term = None
    selected_term: dict | None = None
    source_terms_payload = client.get_source_terms() or {}
    source_terms = _extract_items(source_terms_payload, "terms")
    warnings: list[str] = []

    if requested_term_code:
        selected_term = _find_source_term(source_terms, requested_term_code)
        if selected_term:
            resolved_source_term = str(selected_term.get("term_name") or "").strip() or None
        else:
            resolved_source_term = requested_term_code
            warnings.append(
                f"Could not resolve term_code '{requested_term_code}' to a source term name; falling back to direct source query."
            )
    elif requested_term:
        selected_term = _find_source_term(source_terms, requested_term)
        if selected_term:
            resolved_source_term = str(selected_term.get("term_name") or requested_term).strip() or None
        else:
            resolved_source_term = requested_term
    else:
        selected_term = _pick_best_source_term(source_terms)
        if selected_term:
            resolved_source_term = str(selected_term.get("term_name") or selected_term.get("term_code") or "").strip() or None
            warnings.append(
                "No term was provided; selected source term "
                f"{selected_term.get('term_name') or selected_term.get('term_code')} "
                f"(term_code={selected_term.get('term_code')}, course_count={int(selected_term.get('course_count') or 0)}, "
                f"student_count={int(selected_term.get('student_count') or 0)}, has_course_sections={bool(selected_term.get('has_course_sections'))})."
            )
        else:
            warnings.append("No term was provided and Student Portal returned no source terms to choose from.")
    source_payload = client.get_course_sections_source(
        term=resolved_source_term,
        term_code=str(selected_term.get("term_code") or requested_term_code or "").strip() or None,
        student_id=payload.get("student_id"),
        class_name=payload.get("class_name"),
        limit=int(payload.get("limit") or 100),
    )
    source_items = _extract_items(source_payload, "items")

    resolved_term_code = None
    imported_terms = 0
    sections_created = 0
    sections_updated = 0
    imported_students_set: set[str] = set()
    students_cached_set: set[str] = set()
    students_linked = 0
    teachers_cached_set: set[str] = set()
    missing_students: set[str] = set()
    errors: list[str] = []

    if selected_term and int(selected_term.get("course_count") or 0) <= 0:
        warnings.append(
            f"Selected term {selected_term.get('term_name') or selected_term.get('term_code')} has course_count=0 and student_count={int(selected_term.get('student_count') or 0)}."
        )
    if not source_items:
        if selected_term:
            warnings.append(
                "Student Portal returned no course section items for selected term "
                f"{selected_term.get('term_name') or selected_term.get('term_code')} "
                f"(term_code={selected_term.get('term_code')}, course_count={int(selected_term.get('course_count') or 0)}, "
                f"student_count={int(selected_term.get('student_count') or 0)}, has_course_sections={bool(selected_term.get('has_course_sections'))})."
            )
        elif resolved_source_term:
            warnings.append(f"Student Portal returned no course section items for requested term '{resolved_source_term}'.")
        else:
            warnings.append("Student Portal returned no course section items and no source term could be resolved.")

    try:
        all_student_ids: list[str] = []
        seen_student_ids: set[str] = set()
        for item in source_items:
            for student_id in _extract_string_ids(item.get("student_ids") or []):
                if student_id not in seen_student_ids:
                    all_student_ids.append(student_id)
                    seen_student_ids.add(student_id)

        student_profiles_by_id: dict[str, dict] = {}
        if all_student_ids:
            students_payload = client.get_students_batch(all_student_ids)
            for student in _extract_items(students_payload, "items", "students"):
                normalized_student = normalize_student_payload(student)
                student_external_id = normalized_student["student_external_id"]
                if not student_external_id:
                    continue
                student_profiles_by_id[student_external_id] = normalized_student
                imported_students_set.add(student_external_id)
                students_cached_set.add(student_external_id)
                external_user_repo.upsert_external_user(
                    db,
                    external_user_id=student_external_id,
                    role="student",
                    full_name=normalized_student.get("full_name"),
                    email=normalized_student.get("email"),
                    class_name=normalized_student.get("class_name"),
                    faculty=normalized_student.get("faculty"),
                    program_name=normalized_student.get("program_name"),
                )

            for missing_id in _extract_string_ids((students_payload or {}).get("missing_ids") or []):
                missing_students.add(missing_id)

        for item in source_items:
            term_code = str(item.get("term_code") or item.get("term") or "").strip()
            section_code = str(item.get("section_code") or "").strip()
            course_code = str(item.get("course_code") or "").strip()
            course_name = str(item.get("course_name") or "").strip()
            teacher_id = str(item.get("teacher_id") or "").strip() or None
            student_ids = _extract_string_ids(item.get("student_ids") or [])

            if not term_code or not section_code or not course_code or not course_name:
                errors.append(f"Skipped invalid source item for section '{section_code or 'unknown'}'")
                continue

            if resolved_term_code is None and term_code:
                resolved_term_code = term_code

            term = _get_term_by_code(db, term_code)
            if term is None:
                term = section_repo.create_term(
                    db,
                    _apply_inferred_term_dates({
                        "term_code": term_code,
                        "term_name": str(item.get("term") or term_code),
                        "status": "active",
                    }),
                )
                imported_terms += 1

            teacher_external_id = None
            teacher_faculty = None
            teacher_name = str(item.get("teacher_name") or "").strip() or None
            teacher_email = str(item.get("teacher_email") or "").strip() or None
            teacher_department = str(item.get("teacher_department") or "").strip() or None
            if teacher_id:
                try:
                    teacher_payload = client.get_teacher(teacher_id)
                    teacher = normalize_teacher_payload(teacher_payload)
                    teacher_external_id = teacher["teacher_external_id"] or teacher_id
                    teacher_name = teacher.get("full_name") or teacher_name
                    teacher_email = teacher.get("email") or teacher_email
                    teacher_faculty = teacher.get("faculty")
                    external_user_repo.upsert_external_user(
                        db,
                        external_user_id=teacher_external_id,
                        role="teacher",
                        full_name=teacher_name,
                        email=teacher_email,
                        faculty=teacher_faculty or teacher_department,
                    )
                    teachers_cached_set.add(teacher_external_id)
                except HTTPException as exc:
                    if exc.status_code != status.HTTP_404_NOT_FOUND:
                        raise
                    errors.append(f"Teacher '{teacher_id}' was not found in Student Portal")

            section = _get_section_by_term_and_code(db, term_id=term.id, section_code=section_code)
            resolved_teacher_external_id = teacher_external_id
            resolved_faculty = teacher_faculty or teacher_department
            resolved_program_name = None
            if section is not None:
                existing_teacher_id = section.teacher_external_id
                if existing_teacher_id and not teacher_external_id:
                    resolved_teacher_external_id = existing_teacher_id
                elif existing_teacher_id and teacher_external_id and existing_teacher_id != teacher_external_id:
                    warnings.append(
                        f"Section {section_code} has existing teacher {existing_teacher_id} but core returned {teacher_external_id}, kept existing teacher."
                    )
                    resolved_teacher_external_id = existing_teacher_id
                elif existing_teacher_id and teacher_external_id == existing_teacher_id:
                    resolved_teacher_external_id = existing_teacher_id
                resolved_program_name = section.program_name

            derived_faculty, derived_program_name = _derive_section_academic_profile(
                linked_student_ids=student_ids,
                student_profiles_by_id=student_profiles_by_id,
                fallback_faculty=resolved_faculty if resolved_faculty else (section.faculty if section else None),
                fallback_program_name=resolved_program_name,
            )

            section_values = {
                "term_id": term.id,
                "course_code": course_code,
                "course_name": course_name,
                "section_code": section_code,
                "teacher_external_id": resolved_teacher_external_id,
                "faculty": derived_faculty,
                "program_name": derived_program_name,
                "student_count": len(student_ids),
                "status": "active",
            }
            if section is None:
                section = section_repo.create_section(db, section_values)
                sections_created += 1
            else:
                section_repo.update_section(db, section, section_values)
                sections_updated += 1

            if not student_ids:
                continue

            for student_external_id in student_ids:
                if student_external_id not in student_profiles_by_id:
                    missing_students.add(student_external_id)
                    continue
                _, created = section_repo.add_student_to_section(
                    db,
                    section_id=section.id,
                    student_external_id=student_external_id,
                )
                students_linked += 1 if created else 0

        db.commit()
    except Exception:
        db.rollback()
        raise

    return CoreCourseSectionsImportResponse(
        term_code=resolved_term_code or str(selected_term.get("term_code") or requested_term_code or requested_term or "").strip() or None,
        selected_term=selected_term,
        imported_terms=imported_terms,
        imported_sections=sections_created,
        sections_created=sections_created,
        sections_updated=sections_updated,
        imported_students=len(imported_students_set),
        students_cached=len(students_cached_set),
        linked_students=students_linked,
        students_linked=students_linked,
        teachers_cached=len(teachers_cached_set),
        missing_students=sorted(missing_students),
        warnings=warnings,
        errors=errors,
    )
