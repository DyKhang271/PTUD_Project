from __future__ import annotations

from collections.abc import Iterable
import re
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.academic_term import AcademicTerm
from app.models.course_section import CourseSection
from app.repositories import external_user_repo, section_repo
from app.schemas.section_schema import CoreCourseSectionsImportResponse, SectionStudentRead, SectionStudentsImportResponse
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


def get_section_or_404(db: Session, section_id: UUID):
    section = section_repo.get_section(db, section_id)
    if section is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course section not found")
    return section


def create_term(db: Session, values: dict):
    try:
        term = section_repo.create_term(db, values)
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
        updated = section_repo.update_term(db, term, values)
        db.commit()
        return updated
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Term update conflicts with existing data") from exc


def create_section(db: Session, values: dict):
    try:
        section = section_repo.create_section(db, values)
        db.commit()
        return section
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Section already exists in this term") from exc


def update_section(db: Session, section_id: UUID, values: dict):
    section = get_section_or_404(db, section_id)
    try:
        updated = section_repo.update_section(db, section, values)
        db.commit()
        return updated
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
        },
    )
    if commit:
        db.commit()
    return updated


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
                    {
                        "term_code": term_code,
                        "term_name": str(item.get("term") or term_code),
                        "status": "active",
                    },
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

            section_values = {
                "term_id": term.id,
                "course_code": course_code,
                "course_name": course_name,
                "section_code": section_code,
                "teacher_external_id": resolved_teacher_external_id,
                "faculty": resolved_faculty if resolved_faculty else (section.faculty if section else None),
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
