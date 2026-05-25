from __future__ import annotations

import math
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.course_section import CourseSection, CourseSectionStudent
from app.models.external_user import ExternalUserCache
from app.models.timetable import ExamSchedule, TimetableEntry
from app.repositories import section_repo
from app.schemas.course_opening_plan_schema import (
    CohortRead,
    CourseOpeningPlanCourseRead,
    CourseOpeningPlanMeta,
    CourseOpeningPlanResponse,
    CourseOpeningPlanSectionRead,
    CourseOpeningPlanSummary,
    FacultyRead,
    ProgramRead,
)
from app.services.core_api_client import CoreApiClient

MAX_STUDENTS_PER_SECTION = 65

FACULTY_FALLBACKS = [
    {"id": "fit", "code": "FIT", "name": "Khoa Công nghệ Thông tin"},
]

PROGRAM_FALLBACKS = [
    {
        "id": "data-science",
        "code": "KHDL",
        "name": "Khoa học dữ liệu",
        "faculty_id": "fit",
        "prefixes": ["DHKHDL"],
        "aliases": ["khoa hoc du lieu"],
    },
    {
        "id": "computer-science",
        "code": "KHMT",
        "name": "Khoa học máy tính",
        "faculty_id": "fit",
        "prefixes": ["DHKHMT"],
        "aliases": ["khoa hoc may tinh"],
    },
]

COHORT_FALLBACKS = [
    {"id": "dhkhdl18", "code": "DHKHDL18", "name": "DHKHDL18", "program_id": "data-science", "start_year": 2022, "expected_students": 130},
    {"id": "dhkhdl19", "code": "DHKHDL19", "name": "DHKHDL19", "program_id": "data-science", "start_year": 2023, "expected_students": 95},
    {"id": "dhkhmt19", "code": "DHKHMT19", "name": "DHKHMT19", "program_id": "computer-science", "start_year": 2023, "expected_students": 110},
]

CURRICULUM_FALLBACKS = {
    ("data-science", "dhkhdl18", 5): [
        {"course_code": "4203001146", "course_name": "Hệ cơ sở dữ liệu", "credits": 4, "course_type": "Bắt buộc"},
        {"course_code": "4203002070", "course_name": "Lập trình hướng sự kiện với công nghệ Java", "credits": 4, "course_type": "Bắt buộc"},
        {"course_code": "4203002117", "course_name": "Những vấn đề xã hội và nghề nghiệp", "credits": 2, "course_type": "Bắt buộc"},
        {"course_code": "4203001545", "course_name": "Nhận dạng mẫu", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203003443", "course_name": "Khai thác dữ liệu và ứng dụng", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203003501", "course_name": "Phát triển ứng dụng", "credits": 3, "course_type": "Bắt buộc"},
    ],
    ("data-science", "dhkhdl18", 8): [
        {"course_code": "4203003443", "course_name": "Khai thác dữ liệu và ứng dụng", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203003501", "course_name": "Phát triển ứng dụng", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203003711", "course_name": "Máy học", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203014115", "course_name": "Khai phá đồ thị", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203001146", "course_name": "Hệ cơ sở dữ liệu", "credits": 4, "course_type": "Bắt buộc"},
    ],
    ("data-science", "dhkhdl19", 5): [
        {"course_code": "4203001146", "course_name": "Hệ cơ sở dữ liệu", "credits": 4, "course_type": "Bắt buộc"},
        {"course_code": "4203003443", "course_name": "Khai thác dữ liệu và ứng dụng", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203003501", "course_name": "Phát triển ứng dụng", "credits": 3, "course_type": "Bắt buộc"},
    ],
    ("computer-science", "dhkhmt19", 5): [
        {"course_code": "4203002137", "course_name": "Hệ thống máy tính", "credits": 4, "course_type": "Bắt buộc"},
        {"course_code": "4203000941", "course_name": "Kỹ thuật lập trình", "credits": 3, "course_type": "Bắt buộc"},
        {"course_code": "4203000901", "course_name": "Cấu trúc rời rạc", "credits": 3, "course_type": "Bắt buộc"},
    ],
}


@dataclass(frozen=True)
class ProgramDefinition:
    id: str
    code: str
    name: str
    faculty_id: str
    prefixes: tuple[str, ...]
    aliases: tuple[str, ...]


PROGRAM_DEFINITIONS = [
    ProgramDefinition(
        id=item["id"],
        code=item["code"],
        name=item["name"],
        faculty_id=item["faculty_id"],
        prefixes=tuple(item["prefixes"]),
        aliases=tuple(item["aliases"]),
    )
    for item in PROGRAM_FALLBACKS
]


def _slugify(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value or "")
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii").lower()
    ascii_value = re.sub(r"[^a-z0-9]+", "-", ascii_value).strip("-")
    return ascii_value


def _normalize_text(value: str | None) -> str:
    if not value:
        return ""
    normalized = unicodedata.normalize("NFKD", value)
    return normalized.encode("ascii", "ignore").decode("ascii").lower().strip()


def _extract_cohort_code(class_name: str | None) -> str | None:
    if not class_name:
        return None
    match = re.match(r"^([A-Z]+[0-9]{2})", class_name.strip().upper())
    return match.group(1) if match else None


def _infer_start_year_from_cohort(cohort_code: str | None) -> int | None:
    if not cohort_code:
        return None
    match = re.search(r"(\d{2})$", cohort_code)
    if not match:
        return None
    return 2004 + int(match.group(1))


def _faculty_id_for_name(name: str | None) -> str:
    normalized = _normalize_text(name)
    if "cong nghe thong tin" in normalized:
        return "fit"
    slug = _slugify(name or "")
    return slug or "unknown"


def _faculty_code_for_id(faculty_id: str) -> str:
    if faculty_id == "fit":
        return "FIT"
    return faculty_id.upper()


def _find_program_definition(program_id: str | None = None, program_name: str | None = None, class_name: str | None = None) -> ProgramDefinition | None:
    cohort_code = _extract_cohort_code(class_name)
    normalized_program_name = _normalize_text(program_name)

    for definition in PROGRAM_DEFINITIONS:
        if program_id and definition.id == program_id:
            return definition
        if normalized_program_name and (normalized_program_name == _normalize_text(definition.name) or normalized_program_name in definition.aliases):
            return definition
        if cohort_code and any(cohort_code.startswith(prefix) for prefix in definition.prefixes):
            return definition
    return None


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


def _build_empty_plan(*, faculty: str, program: str, cohort: str, curriculum_semester: int, term_code: str, notes: list[str] | None = None) -> CourseOpeningPlanResponse:
    return CourseOpeningPlanResponse(
        faculty=faculty,
        program=program,
        cohort=cohort,
        curriculum_semester=curriculum_semester,
        term_code=term_code,
        summary=CourseOpeningPlanSummary(
            planned_courses=0,
            opened_courses=0,
            missing_courses=0,
            extra_courses=0,
            total_sections=0,
            missing_teacher_sections=0,
            missing_schedule_sections=0,
            missing_exam_sections=0,
        ),
        courses=[],
        meta=CourseOpeningPlanMeta(source="empty", notes=notes or []),
    )


def _get_cached_students(db: Session) -> list[ExternalUserCache]:
    stmt = select(ExternalUserCache).where(ExternalUserCache.role == "student")
    return list(db.scalars(stmt).all())


def _get_cached_teachers_map(db: Session, teacher_ids: set[str]) -> dict[str, ExternalUserCache]:
    if not teacher_ids:
        return {}
    stmt = select(ExternalUserCache).where(
        ExternalUserCache.role == "teacher",
        ExternalUserCache.external_user_id.in_(teacher_ids),
    )
    return {teacher.external_user_id: teacher for teacher in db.scalars(stmt).all()}


def list_faculties(db: Session) -> list[FacultyRead]:
    client = CoreApiClient()
    try:
        payload = client.get_faculties()
        items = _extract_items(payload, "items", "faculties")
        if items:
            return [
                FacultyRead(
                    id=str(item.get("id") or _faculty_id_for_name(item.get("name"))),
                    code=str(item.get("code") or _faculty_code_for_id(str(item.get("id") or _faculty_id_for_name(item.get("name"))))),
                    name=str(item.get("name") or item.get("faculty") or ""),
                )
                for item in items
                if item.get("name") or item.get("faculty")
            ]
    except HTTPException:
        pass

    names = {
        faculty_name
        for faculty_name in db.scalars(select(CourseSection.faculty).where(CourseSection.faculty.is_not(None))).all()
        if faculty_name
    }
    names.update(
        user.faculty
        for user in _get_cached_students(db)
        if user.faculty
    )

    if not names:
        names = {item["name"] for item in FACULTY_FALLBACKS}

    faculties = [
        FacultyRead(
            id=_faculty_id_for_name(name),
            code=_faculty_code_for_id(_faculty_id_for_name(name)),
            name=name,
        )
        for name in sorted(names)
    ]
    return faculties


def list_programs(db: Session, faculty_id: str) -> list[ProgramRead]:
    client = CoreApiClient()
    try:
        payload = client.get_programs(faculty_id)
        items = _extract_items(payload, "items", "programs")
        if items:
            return [
                ProgramRead(
                    id=str(item.get("id") or _slugify(str(item.get("name") or item.get("program_name") or ""))),
                    code=str(item.get("code") or ""),
                    name=str(item.get("name") or item.get("program_name") or ""),
                    faculty_id=faculty_id,
                )
                for item in items
                if item.get("name") or item.get("program_name")
            ]
    except HTTPException:
        pass

    students = [user for user in _get_cached_students(db) if _faculty_id_for_name(user.faculty) == faculty_id]
    programs: dict[str, ProgramRead] = {}
    for student in students:
        definition = _find_program_definition(program_name=student.program_name, class_name=student.class_name)
        if definition:
            programs[definition.id] = ProgramRead(
                id=definition.id,
                code=definition.code,
                name=definition.name,
                faculty_id=faculty_id,
            )

    if not programs:
        for item in PROGRAM_FALLBACKS:
            if item["faculty_id"] == faculty_id:
                programs[item["id"]] = ProgramRead(
                    id=item["id"],
                    code=item["code"],
                    name=item["name"],
                    faculty_id=item["faculty_id"],
                )

    return sorted(programs.values(), key=lambda item: item.name)


def list_cohorts(db: Session, program_id: str) -> list[CohortRead]:
    client = CoreApiClient()
    try:
        payload = client.get_cohorts(program_id)
        items = _extract_items(payload, "items", "cohorts")
        if items:
            return [
                CohortRead(
                    id=str(item.get("id") or _slugify(str(item.get("code") or item.get("name") or ""))),
                    code=str(item.get("code") or item.get("name") or ""),
                    name=str(item.get("name") or item.get("code") or ""),
                    program_id=program_id,
                    start_year=item.get("start_year"),
                    expected_students=item.get("expected_students"),
                )
                for item in items
                if item.get("code") or item.get("name")
            ]
    except HTTPException:
        pass

    definition = _find_program_definition(program_id=program_id)
    cohort_counter: Counter[str] = Counter()
    for student in _get_cached_students(db):
        if definition is None:
            continue
        if _find_program_definition(program_name=student.program_name, class_name=student.class_name) != definition:
            continue
        cohort_code = _extract_cohort_code(student.class_name)
        if cohort_code:
            cohort_counter[cohort_code] += 1

    cohorts: dict[str, CohortRead] = {}
    for cohort_code, count in cohort_counter.items():
        cohort_id = _slugify(cohort_code)
        cohorts[cohort_id] = CohortRead(
            id=cohort_id,
            code=cohort_code,
            name=cohort_code,
            program_id=program_id,
            start_year=_infer_start_year_from_cohort(cohort_code),
            expected_students=count,
        )

    if not cohorts:
        for item in COHORT_FALLBACKS:
            if item["program_id"] == program_id:
                cohorts[item["id"]] = CohortRead(**item)

    return sorted(cohorts.values(), key=lambda item: item.code)


def _get_curriculum_courses(program_id: str, cohort_id: str, curriculum_semester: int) -> tuple[list[dict], list[str]]:
    notes: list[str] = []
    client = CoreApiClient()
    try:
        payload = client.get_curriculum_courses(
            program_id=program_id,
            cohort_id=cohort_id,
            curriculum_semester=curriculum_semester,
        )
        items = _extract_items(payload, "items", "courses", "curriculum_courses")
        if items:
            normalized = []
            for item in items:
                normalized.append(
                    {
                        "course_code": str(item.get("course_code") or ""),
                        "course_name": str(item.get("course_name") or ""),
                        "credits": item.get("credits"),
                        "course_type": item.get("course_type") or "Bắt buộc",
                    }
                )
            return normalized, notes
    except HTTPException:
        notes.append(
            "Student Portal chưa có endpoint /internal/curriculum/semester-courses; đang dùng curriculum fallback trong timetable."
        )

    return CURRICULUM_FALLBACKS.get((program_id, cohort_id, curriculum_semester), []), notes


def _get_cohort_expected_students(db: Session, program_id: str, cohort: CohortRead) -> int:
    definition = _find_program_definition(program_id=program_id)
    count = 0
    for student in _get_cached_students(db):
        if definition and _find_program_definition(program_name=student.program_name, class_name=student.class_name) != definition:
            continue
        if _extract_cohort_code(student.class_name) == cohort.code:
            count += 1
    if count:
        return count
    return cohort.expected_students or 0


def _load_term_related_maps(db: Session, term_id: UUID) -> tuple[list[CourseSection], dict[UUID, list[CourseSectionStudent]], dict[str, ExternalUserCache], dict[UUID, list[TimetableEntry]], dict[UUID, list[ExamSchedule]]]:
    sections = section_repo.list_sections(db, term_id=term_id)
    section_ids = [section.id for section in sections]
    if not section_ids:
        return sections, {}, {}, {}, {}

    student_rows = list(
        db.scalars(
            select(CourseSectionStudent).where(
                CourseSectionStudent.section_id.in_(section_ids),
                CourseSectionStudent.enrollment_status == "active",
            )
        ).all()
    )
    students_by_section: dict[UUID, list[CourseSectionStudent]] = defaultdict(list)
    student_ids: set[str] = set()
    for row in student_rows:
        students_by_section[row.section_id].append(row)
        student_ids.add(row.student_external_id)

    student_cache = {}
    if student_ids:
        stmt = select(ExternalUserCache).where(
            ExternalUserCache.role == "student",
            ExternalUserCache.external_user_id.in_(student_ids),
        )
        student_cache = {user.external_user_id: user for user in db.scalars(stmt).all()}

    timetable_rows = list(
        db.scalars(select(TimetableEntry).where(TimetableEntry.section_id.in_(section_ids))).all()
    )
    timetable_by_section: dict[UUID, list[TimetableEntry]] = defaultdict(list)
    for row in timetable_rows:
        timetable_by_section[row.section_id].append(row)

    exam_rows = list(
        db.scalars(select(ExamSchedule).where(ExamSchedule.section_id.in_(section_ids))).all()
    )
    exams_by_section: dict[UUID, list[ExamSchedule]] = defaultdict(list)
    for row in exam_rows:
        exams_by_section[row.section_id].append(row)

    return sections, students_by_section, student_cache, timetable_by_section, exams_by_section


def _section_matches_context(
    section: CourseSection,
    *,
    cohort_code: str,
    program_definition: ProgramDefinition | None,
    faculty_name: str,
    planned_course_codes: set[str],
    students_by_section: dict[UUID, list[CourseSectionStudent]],
    student_cache: dict[str, ExternalUserCache],
) -> bool:
    enrolled_students = students_by_section.get(section.id, [])
    for enrollment in enrolled_students:
        student = student_cache.get(enrollment.student_external_id)
        if student and _extract_cohort_code(student.class_name) == cohort_code:
            return True

    if planned_course_codes and section.course_code not in planned_course_codes:
        return False

    if _normalize_text(section.faculty) == _normalize_text(faculty_name):
        if program_definition is None:
            return True
        for enrollment in enrolled_students:
            student = student_cache.get(enrollment.student_external_id)
            if student and _find_program_definition(program_name=student.program_name, class_name=student.class_name) == program_definition:
                return True
    return False


def _resolve_class_name(
    section_id: UUID,
    *,
    cohort_code: str,
    students_by_section: dict[UUID, list[CourseSectionStudent]],
    student_cache: dict[str, ExternalUserCache],
) -> str:
    counter: Counter[str] = Counter()
    for enrollment in students_by_section.get(section_id, []):
        student = student_cache.get(enrollment.student_external_id)
        if student and student.class_name:
            counter[student.class_name] += 1
    if counter:
        for class_name, _ in counter.most_common():
            if _extract_cohort_code(class_name) == cohort_code:
                return class_name
        return counter.most_common(1)[0][0]
    return cohort_code


def _build_schedule_label(entries: list[TimetableEntry]) -> str | None:
    if not entries:
        return None
    return " | ".join(
        f"Thu {entry.day_of_week} {entry.start_time or '--'}-{entry.end_time or '--'} {entry.room or entry.location or '--'}"
        for entry in sorted(entries, key=lambda item: (item.day_of_week, item.start_time.isoformat() if item.start_time else ""))
    )


def _build_exam_label(entries: list[ExamSchedule]) -> str | None:
    if not entries:
        return None
    return " | ".join(
        f"{entry.exam_date} {entry.start_time or '--'}-{entry.end_time or '--'} {entry.room or entry.location or '--'}"
        for entry in sorted(entries, key=lambda item: (item.exam_date.isoformat(), item.start_time.isoformat() if item.start_time else ""))
    )


def _build_section_status(*, teacher_id: str | None, has_schedule: bool, has_exam: bool) -> str:
    if not teacher_id:
        return "missing_teacher"
    if not has_schedule:
        return "missing_schedule"
    if not has_exam:
        return "missing_exam"
    return "ready"


def get_course_opening_plan(
    db: Session,
    *,
    faculty_id: str,
    program_id: str,
    cohort_id: str,
    curriculum_semester: int,
    term_code: str,
) -> CourseOpeningPlanResponse:
    faculties = {item.id: item for item in list_faculties(db)}
    faculty = faculties.get(faculty_id)
    programs = {item.id: item for item in list_programs(db, faculty_id)}
    program = programs.get(program_id)
    cohorts = {item.id: item for item in list_cohorts(db, program_id)}
    cohort = cohorts.get(cohort_id)

    faculty_name = faculty.name if faculty else ""
    program_name = program.name if program else ""
    cohort_code = cohort.code if cohort else ""

    if not faculty or not program or not cohort:
        return _build_empty_plan(
            faculty=faculty_name,
            program=program_name,
            cohort=cohort_code,
            curriculum_semester=curriculum_semester,
            term_code=term_code,
            notes=["Không resolve được đầy đủ khoa/chương trình/khóa từ dữ liệu hiện có."],
        )

    curriculum_courses, notes = _get_curriculum_courses(program_id, cohort_id, curriculum_semester)
    term = section_repo.get_term_by_code(db, term_code)
    if term is None:
        notes.append(f"Chưa có academic_terms cho term_code={term_code}. Hãy import course sections cho học kỳ này trước.")
        return _build_empty_plan(
            faculty=faculty.name,
            program=program.name,
            cohort=cohort.code,
            curriculum_semester=curriculum_semester,
            term_code=term_code,
            notes=notes,
        )

    sections, students_by_section, student_cache, timetable_by_section, exams_by_section = _load_term_related_maps(db, term.id)
    teacher_cache = _get_cached_teachers_map(
        db,
        {section.teacher_external_id for section in sections if section.teacher_external_id},
    )

    planned_course_codes = {course["course_code"] for course in curriculum_courses if course.get("course_code")}
    program_definition = _find_program_definition(program_id=program_id)
    relevant_sections = [
        section
        for section in sections
        if _section_matches_context(
            section,
            cohort_code=cohort.code,
            program_definition=program_definition,
            faculty_name=faculty.name,
            planned_course_codes=planned_course_codes,
            students_by_section=students_by_section,
            student_cache=student_cache,
        )
    ]

    sections_by_course: dict[str, list[CourseSection]] = defaultdict(list)
    for section in relevant_sections:
        sections_by_course[section.course_code].append(section)

    expected_students = _get_cohort_expected_students(db, program_id, cohort)
    rendered_courses: list[CourseOpeningPlanCourseRead] = []
    all_rendered_sections: list[CourseOpeningPlanSectionRead] = []

    for course in curriculum_courses:
        course_sections = sections_by_course.get(course["course_code"], [])
        suggested_sections = max(1, math.ceil(expected_students / MAX_STUDENTS_PER_SECTION)) if expected_students else max(1, len(course_sections))
        rendered_sections: list[CourseOpeningPlanSectionRead] = []

        for section in course_sections:
            timetable_entries = timetable_by_section.get(section.id, [])
            exam_entries = exams_by_section.get(section.id, [])
            teacher = teacher_cache.get(section.teacher_external_id or "")
            has_schedule = bool(timetable_entries)
            has_exam = bool(exam_entries)
            section_status = _build_section_status(
                teacher_id=section.teacher_external_id,
                has_schedule=has_schedule,
                has_exam=has_exam,
            )
            rendered = CourseOpeningPlanSectionRead(
                section_id=str(section.id),
                section_code=section.section_code,
                class_name=_resolve_class_name(
                    section.id,
                    cohort_code=cohort.code,
                    students_by_section=students_by_section,
                    student_cache=student_cache,
                ),
                student_count=section.student_count,
                teacher_id=section.teacher_external_id,
                teacher_name=teacher.full_name if teacher else section.teacher_external_id,
                has_schedule=has_schedule,
                has_exam=has_exam,
                status=section_status,
                schedule_label=_build_schedule_label(timetable_entries),
                exam_label=_build_exam_label(exam_entries),
            )
            rendered_sections.append(rendered)
            all_rendered_sections.append(rendered)

        opened_sections = len(rendered_sections)
        if opened_sections == 0:
            course_status = "missing"
        elif opened_sections < suggested_sections:
            course_status = "under_opened"
        else:
            course_status = "opened"

        rendered_courses.append(
            CourseOpeningPlanCourseRead(
                course_code=course["course_code"],
                course_name=course["course_name"],
                credits=course.get("credits"),
                course_type=course.get("course_type") or "Bắt buộc",
                expected_students=expected_students,
                suggested_sections=suggested_sections,
                opened_sections=opened_sections,
                status=course_status,
                sections=rendered_sections,
            )
        )

    extra_courses: list[CourseOpeningPlanCourseRead] = []
    for course_code, course_sections in sections_by_course.items():
        if course_code in planned_course_codes:
            continue
        rendered_sections: list[CourseOpeningPlanSectionRead] = []
        for section in course_sections:
            timetable_entries = timetable_by_section.get(section.id, [])
            exam_entries = exams_by_section.get(section.id, [])
            teacher = teacher_cache.get(section.teacher_external_id or "")
            rendered = CourseOpeningPlanSectionRead(
                section_id=str(section.id),
                section_code=section.section_code,
                class_name=_resolve_class_name(
                    section.id,
                    cohort_code=cohort.code,
                    students_by_section=students_by_section,
                    student_cache=student_cache,
                ),
                student_count=section.student_count,
                teacher_id=section.teacher_external_id,
                teacher_name=teacher.full_name if teacher else section.teacher_external_id,
                has_schedule=bool(timetable_entries),
                has_exam=bool(exam_entries),
                status=_build_section_status(
                    teacher_id=section.teacher_external_id,
                    has_schedule=bool(timetable_entries),
                    has_exam=bool(exam_entries),
                ),
                schedule_label=_build_schedule_label(timetable_entries),
                exam_label=_build_exam_label(exam_entries),
            )
            rendered_sections.append(rendered)
            all_rendered_sections.append(rendered)

        extra_courses.append(
            CourseOpeningPlanCourseRead(
                course_code=course_code,
                course_name=course_sections[0].course_name if course_sections else course_code,
                credits=None,
                course_type="Ngoài CT khung",
                expected_students=sum(section.student_count for section in course_sections),
                suggested_sections=0,
                opened_sections=len(course_sections),
                status="extra",
                sections=rendered_sections,
            )
        )

    courses = rendered_courses + extra_courses

    return CourseOpeningPlanResponse(
        faculty=faculty.name,
        program=program.name,
        cohort=cohort.code,
        curriculum_semester=curriculum_semester,
        term_code=term_code,
        summary=CourseOpeningPlanSummary(
            planned_courses=len(rendered_courses),
            opened_courses=sum(1 for course in rendered_courses if course.opened_sections > 0),
            missing_courses=sum(1 for course in rendered_courses if course.opened_sections == 0),
            extra_courses=len(extra_courses),
            total_sections=len(all_rendered_sections),
            missing_teacher_sections=sum(1 for section in all_rendered_sections if section.status == "missing_teacher"),
            missing_schedule_sections=sum(1 for section in all_rendered_sections if section.status == "missing_schedule"),
            missing_exam_sections=sum(1 for section in all_rendered_sections if section.status == "missing_exam"),
        ),
        courses=courses,
        meta=CourseOpeningPlanMeta(source="db+core-fallback", notes=notes),
    )
