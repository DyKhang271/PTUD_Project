from __future__ import annotations

import re
import unicodedata
from collections import OrderedDict
from typing import Any

from fastapi import HTTPException, status

import student_data_store as store


def _normalize_text(value: str | None) -> str:
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"\s+", " ", ascii_text).strip()


def _normalize_term(value: str | None) -> str | None:
    normalized = _normalize_text(value)
    if not normalized:
        return None

    patterns = [
        r"\bhk\s*([123])\b.*?(\d{4}).*?(\d{4})",
        r"\bhoc ky\s*([123])\b.*?(\d{4}).*?(\d{4})",
    ]
    for pattern in patterns:
        match = re.search(pattern, normalized)
        if match:
            semester, start_year, end_year = match.groups()
            return f"HK{semester}_{start_year}_{end_year}"

    match = re.fullmatch(r"hk([123])_(\d{4})_(\d{4})", normalized.replace(" ", "_"))
    if match:
        semester, start_year, end_year = match.groups()
        return f"HK{semester}_{start_year}_{end_year}"

    return normalized.upper().replace(" ", "_")


def _extract_term_metadata(term_code: str | None) -> tuple[int | None, int | None]:
    raw_value = str(term_code or "").strip().upper()
    match = re.fullmatch(r"HK([123])_(\d{4})_(\d{4})", raw_value)
    if not match:
        return None, None
    semester, start_year, _ = match.groups()
    return int(semester), int(start_year)


def _normalize_cohort_year(raw_value: str | int | None) -> str | None:
    if raw_value is None:
        return None
    value = str(raw_value).strip()
    if re.fullmatch(r"\d{4}", value):
        return value
    if re.fullmatch(r"\d{2}", value):
        return f"20{int(value):02d}"
    return None


def _derive_student_cohort(student: dict[str, Any]) -> tuple[str | None, str | None]:
    explicit = _normalize_cohort_year(student.get("cohort"))
    if explicit:
        return explicit, "student.cohort"

    admission_year = _normalize_cohort_year(student.get("admission_year"))
    if admission_year:
        return admission_year, "student.admission_year"

    student_id = str(student.get("student_id") or "").strip()
    if re.fullmatch(r"\d{8,}", student_id):
        prefix_year = _normalize_cohort_year(student_id[:2])
        if prefix_year:
            return prefix_year, "student_id_prefix"

    class_name = str(student.get("class_name") or "").strip().upper()
    match = re.search(r"(\d{2})[A-Z]?$", class_name)
    if match:
        return None, f"class_name:{match.group(1)}"

    return None, None


def _collect_available_options() -> dict[str, Any]:
    available_program_names: set[str] = set()
    available_terms: set[str] = set()
    available_cohorts: set[str] = set()
    program_cohorts: dict[str, set[str]] = {}

    for raw_record in store.RAW_STUDENT_DB.values():
        student = _normalize_student(raw_record)
        program_name = str(student.get("program_name") or "").strip()
        if program_name:
            available_program_names.add(program_name)
            program_cohorts.setdefault(program_name, set())

        derived_cohort, _ = _derive_student_cohort(student)
        if derived_cohort:
            available_cohorts.add(derived_cohort)
            if program_name:
                program_cohorts.setdefault(program_name, set()).add(derived_cohort)

        for transcript in raw_record.get("transcript_courses") or []:
            normalized_transcript_term = _normalize_term(transcript.get("term"))
            if normalized_transcript_term:
                available_terms.add(normalized_transcript_term)

    return {
        "available_program_names": sorted(available_program_names),
        "available_terms": sorted(available_terms),
        "available_cohorts": sorted(available_cohorts),
        "programs": [
            {
                "name": program_name,
                "cohorts": sorted(program_cohorts.get(program_name, set())),
            }
            for program_name in sorted(available_program_names)
        ],
    }


def _validate_curriculum_semester(*, term_code: str, cohort: str | None, curriculum_semester: int) -> list[str]:
    warnings: list[str] = []
    if curriculum_semester < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="curriculum_semester must be >= 1")

    cohort_year = int(str(cohort).strip()) if str(cohort or "").strip().isdigit() else None
    term_semester, term_start_year = _extract_term_metadata(term_code)
    if cohort_year is None or term_semester is None or term_start_year is None:
        warnings.append("curriculum_semester may not match cohort and term_code")
        return warnings

    estimated_current_semester = (term_start_year - cohort_year) * 2 + term_semester
    if estimated_current_semester <= 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="cohort and term_code combination is invalid")

    if abs(curriculum_semester - estimated_current_semester) > 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="curriculum_semester is not compatible with cohort and term_code",
        )
    if abs(curriculum_semester - estimated_current_semester) > 2:
        warnings.append("curriculum_semester may not match cohort and term_code")
    return warnings


def _matches_program(student: dict[str, Any], program_name: str | None, program_id: str | None) -> bool:
    expected_program_id = _normalize_text(program_id)
    if expected_program_id:
        student_program_id = _normalize_text(student.get("program_id"))
        if student_program_id:
            return student_program_id == expected_program_id

    expected_program_name = _normalize_text(program_name)
    if not expected_program_name:
        return True

    candidates = {
        _normalize_text(student.get("program_name")),
        _normalize_text(student.get("program_id")),
    }
    return expected_program_name in candidates


def _matches_cohort(student: dict[str, Any], cohort: str | None) -> tuple[bool, str | None]:
    normalized_cohort = _normalize_cohort_year(cohort) or str(cohort or "").strip()
    if not normalized_cohort:
        return True, None

    derived_cohort, source = _derive_student_cohort(student)
    if derived_cohort is None:
        return True, source or "unknown"
    return derived_cohort == normalized_cohort, source


def _extract_course_code_from_transcript(course: dict[str, Any]) -> str:
    course_code = str(course.get("course_code") or "").strip()
    if course_code:
        return course_code
    return str(course.get("class_section_code") or "").strip()[:10]


def _normalize_student(raw_record: dict[str, Any]) -> dict[str, Any]:
    student = raw_record.get("student") or {}
    return {
        "student_id": str(student.get("student_id") or "").strip(),
        "full_name": student.get("full_name"),
        "class_name": student.get("class_name"),
        "program_name": student.get("program_name"),
        "program_id": student.get("program_id"),
        "faculty": student.get("faculty"),
        "education_level": student.get("education_level"),
        "cohort": student.get("cohort"),
        "admission_year": student.get("admission_year"),
    }


def _resolve_teacher(term_label: str, section_code: str, course_code: str | None) -> dict[str, Any] | None:
    normalized_term = _normalize_term(term_label)
    for teacher_id, teacher in store.TEACHER_USERS.items():
        for assignment in teacher.get("assignments") or []:
            assignment_term = _normalize_term(assignment.get("term"))
            if assignment_term != normalized_term:
                continue
            if str(assignment.get("section_code") or "").strip() == section_code:
                return {
                    "teacher_id": teacher_id,
                    "full_name": teacher.get("name") or teacher.get("full_name"),
                }

    if not course_code:
        return None

    for teacher_id, teacher in store.TEACHER_USERS.items():
        for assignment in teacher.get("assignments") or []:
            assignment_term = _normalize_term(assignment.get("term"))
            if assignment_term != normalized_term:
                continue
            if str(assignment.get("course_code") or "").strip() == course_code:
                return {
                    "teacher_id": teacher_id,
                    "full_name": teacher.get("name") or teacher.get("full_name"),
                }
    return None


def _upsert_grouped_section(
    grouped_sections: OrderedDict[tuple[str, str], dict[str, Any]],
    *,
    normalized_term_code: str,
    class_section_code: str,
    course_code: str,
    course_name: str,
) -> dict[str, Any]:
    key = (normalized_term_code, class_section_code)
    section = grouped_sections.get(key)
    if section is None:
        section = {
            "class_section_code": class_section_code,
            "course_code": course_code,
            "course_name": course_name,
            "term": normalized_term_code,
            "teacher": None,
            "students": [],
        }
        grouped_sections[key] = section
        return section

    if not section.get("course_code"):
        section["course_code"] = course_code
    if not section.get("course_name"):
        section["course_name"] = course_name
    return section


def build_academic_scheduling_source(
    *,
    term_code: str,
    program_name: str | None = None,
    program_id: str | None = None,
    cohort: str | None = None,
    curriculum_semester: int,
    strict_curriculum_match: bool = False,
) -> dict[str, Any]:
    store.initialize_store()
    normalized_term_code = _normalize_term(term_code)
    warnings = _validate_curriculum_semester(
        term_code=normalized_term_code or term_code,
        cohort=cohort,
        curriculum_semester=curriculum_semester,
    )

    option_sets = _collect_available_options()
    available_program_names: set[str] = set(option_sets["available_program_names"])
    available_terms: set[str] = set(option_sets["available_terms"])
    available_cohorts: set[str] = set(option_sets["available_cohorts"])
    available_curriculum_semesters: set[int] = set()
    cohort_derivation_issues: set[str] = set()

    matched_students_by_program = 0
    matched_students_by_cohort = 0
    students_after_program: list[tuple[dict[str, Any], dict[str, Any]]] = []
    matching_students: list[dict[str, Any]] = []
    raw_records_by_student_id: dict[str, dict[str, Any]] = {}

    for raw_record in store.RAW_STUDENT_DB.values():
        student = _normalize_student(raw_record)
        student_id = student["student_id"]
        if not student_id:
            continue
        for course in raw_record.get("curriculum_courses") or []:
            semester = int(course.get("semester") or 0)
            if semester > 0:
                available_curriculum_semesters.add(semester)

        if not _matches_program(student, program_name, program_id):
            continue

        matched_students_by_program += 1
        students_after_program.append((student, raw_record))

    for student, raw_record in students_after_program:
        matches_cohort, derivation_source = _matches_cohort(student, cohort)
        if derivation_source and derivation_source.startswith("class_name:"):
            cohort_derivation_issues.add("Could not derive cohort from class_name with enough confidence")
        if not matches_cohort:
            continue
        matched_students_by_cohort += 1
        matching_students.append(student)
        raw_records_by_student_id[student["student_id"]] = raw_record

    curriculum_course_codes_in_selected_semester: set[str] = set()
    curriculum_course_names: dict[str, str] = {}
    resolved_program_name = program_name
    resolved_cohort = _normalize_cohort_year(cohort) or str(cohort or "").strip() or None

    for raw_record in raw_records_by_student_id.values():
        student = raw_record.get("student") or {}
        if not resolved_program_name:
            resolved_program_name = student.get("program_name")
        if not resolved_cohort:
            derived_cohort, _ = _derive_student_cohort(student)
            if derived_cohort is not None:
                resolved_cohort = derived_cohort

        for course in raw_record.get("curriculum_courses") or []:
            course_code = str(course.get("course_code") or "").strip()
            semester = int(course.get("semester") or 0)
            if not course_code:
                warnings.append("Skipped curriculum course without course_code")
                continue
            if semester == int(curriculum_semester):
                curriculum_course_codes_in_selected_semester.add(course_code)
                curriculum_course_names.setdefault(course_code, str(course.get("course_name") or "").strip())

    grouped_sections: OrderedDict[tuple[str, str], dict[str, Any]] = OrderedDict()
    transcript_course_codes_in_term: set[str] = set()
    imported_course_codes: set[str] = set()
    transcript_courses_in_term = 0

    for student in matching_students:
        raw_record = raw_records_by_student_id.get(student["student_id"]) or {}
        for transcript in raw_record.get("transcript_courses") or []:
            transcript_term_code = _normalize_term(transcript.get("term"))
            if transcript_term_code != normalized_term_code:
                continue

            transcript_courses_in_term += 1
            course_code = _extract_course_code_from_transcript(transcript)
            if course_code:
                transcript_course_codes_in_term.add(course_code)

            if strict_curriculum_match and course_code not in curriculum_course_codes_in_selected_semester:
                continue

            class_section_code = str(transcript.get("class_section_code") or "").strip()
            course_name = str(transcript.get("course_name") or "").strip() or curriculum_course_names.get(course_code, "")
            if not class_section_code or not course_code or not course_name:
                continue

            imported_course_codes.add(course_code)
            section = _upsert_grouped_section(
                grouped_sections,
                normalized_term_code=normalized_term_code or "",
                class_section_code=class_section_code,
                course_code=course_code,
                course_name=course_name,
            )

            if section["teacher"] is None:
                section["teacher"] = _resolve_teacher(
                    str(transcript.get("term") or term_code),
                    class_section_code,
                    course_code,
                )

            section["students"].append(
                {
                    "student_id": student["student_id"],
                    "full_name": student.get("full_name"),
                    "class_name": student.get("class_name"),
                }
            )

    sections = list(grouped_sections.values())
    overlap_course_codes = sorted(transcript_course_codes_in_term & curriculum_course_codes_in_selected_semester)
    transcript_only_course_codes = sorted(transcript_course_codes_in_term - curriculum_course_codes_in_selected_semester)
    curriculum_only_course_codes = sorted(curriculum_course_codes_in_selected_semester - transcript_course_codes_in_term)

    if matched_students_by_program == 0 or matched_students_by_cohort == 0 or not matching_students:
        warnings.append("No students matched selected program/cohort")
        status_value = "empty"
    elif transcript_courses_in_term == 0:
        warnings.append("No transcript courses found for selected term")
        status_value = "empty"
    elif strict_curriculum_match and not imported_course_codes:
        warnings.append("No transcript courses matched selected curriculum semester")
        status_value = "empty"
    elif sections:
        status_value = "success"
    else:
        warnings.append("No sections matched the selected filters. Check transcript data and course sections.")
        status_value = "empty"

    for issue in sorted(cohort_derivation_issues):
        warnings.append(issue)

    debug = {
        "selected_program_name": program_name,
        "selected_cohort": cohort,
        "selected_term_code": term_code,
        "selected_curriculum_semester": int(curriculum_semester),
        "strict_curriculum_match": strict_curriculum_match,
        "matched_students_by_program": matched_students_by_program,
        "matched_students_by_cohort": matched_students_by_cohort,
        "matched_students_final": len(matching_students),
        "transcript_courses_in_term": transcript_courses_in_term,
        "imported_courses_count": len(imported_course_codes),
        "curriculum_courses_in_selected_semester": len(curriculum_course_codes_in_selected_semester),
        "overlap_course_codes": overlap_course_codes,
        "transcript_only_course_codes": transcript_only_course_codes,
        "curriculum_only_course_codes": curriculum_only_course_codes,
        "available_program_names": sorted(available_program_names),
        "available_cohorts": sorted(available_cohorts),
        "available_terms": sorted(available_terms),
        "available_curriculum_semesters": sorted(available_curriculum_semesters),
    }

    return {
        "status": status_value,
        "term_code": normalized_term_code,
        "program_name": resolved_program_name,
        "cohort": resolved_cohort,
        "curriculum_semester": int(curriculum_semester),
        "strict_curriculum_match": strict_curriculum_match,
        "warnings": list(dict.fromkeys(warnings)),
        "debug": debug,
        "sections": sections,
        "total_sections": len(sections),
        "total_students": sum(len(section["students"]) for section in sections),
    }


def get_academic_scheduling_options() -> dict[str, Any]:
    store.initialize_store()
    option_sets = _collect_available_options()
    return {
        "terms": [{"value": term, "label": term} for term in option_sets["available_terms"]],
        "programs": option_sets["programs"],
    }
