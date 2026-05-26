from __future__ import annotations

from collections import defaultdict
from datetime import date, time, timedelta
import logging
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.course_section import CourseSection, CourseSectionStudent
from app.models.scheduling_constraints import Room, SectionSchedulingRequirement, TeacherAvailability
from app.models.timetable import ExamSchedule, TimetableEntry
from app.repositories import external_user_repo, section_repo, timetable_repo
from app.schemas.timetable_schema import (
    AdminExamCourseGroupRead,
    AdminExamScheduleRead,
    AdminTimetableCourseGroupRead,
    AdminTimetableEntryRead,
    InvalidTimetableIssueRead,
    StudentExamScheduleItem,
    StudentTimetableItem,
    TimetableCleanupSummaryRead,
    TeacherTimetableItem,
)
from app.services.section_service import assign_teacher, get_section_or_404

VISIBLE_TIMETABLE_STATUSES = {"published"}
logger = logging.getLogger(__name__)


def _dates_matching_day(date_from: date, date_to: date, day_of_week: int) -> list[date]:
    current = date_from
    matches: list[date] = []
    while current <= date_to:
        if current.weekday() + 1 == day_of_week:
            matches.append(current)
        current += timedelta(days=1)
    return matches


def _date_ranges_overlap(
    start_a: date | None,
    end_a: date | None,
    start_b: date | None,
    end_b: date | None,
) -> bool:
    effective_start_a = start_a or date.min
    effective_end_a = end_a or date.max
    effective_start_b = start_b or date.min
    effective_end_b = end_b or date.max
    return effective_start_a <= effective_end_b and effective_end_a >= effective_start_b


def _entry_period_overlaps(entry: TimetableEntry, start_period: int, end_period: int) -> bool:
    if entry.start_period is None or entry.end_period is None:
        return False
    return start_period <= entry.end_period and end_period >= entry.start_period


def time_to_minutes(value) -> int | None:
    if value is None:
        return None
    if isinstance(value, time):
        return value.hour * 60 + value.minute
    hour, minute = map(int, str(value)[:5].split(":"))
    return hour * 60 + minute


def is_time_overlap(new_start, new_end, old_start, old_end) -> bool:
    new_start_minutes = time_to_minutes(new_start)
    new_end_minutes = time_to_minutes(new_end)
    old_start_minutes = time_to_minutes(old_start)
    old_end_minutes = time_to_minutes(old_end)
    if None in (new_start_minutes, new_end_minutes, old_start_minutes, old_end_minutes):
        return False
    return new_start_minutes < old_end_minutes and new_end_minutes > old_start_minutes


def _entry_time_overlaps(entry: TimetableEntry, start_time, end_time) -> bool:
    if entry.start_time is None or entry.end_time is None or start_time is None or end_time is None:
        return False
    return _time_ranges_overlap(start_time, end_time, entry.start_time, entry.end_time)


def _entry_is_conflicting_candidate(
    entry: TimetableEntry,
    *,
    day_of_week: int,
    start_period: int | None,
    end_period: int | None,
    start_time=None,
    end_time=None,
    effective_from: date | None,
    effective_to: date | None,
) -> bool:
    if entry.status == "cancelled":
        return False
    if entry.day_of_week != day_of_week:
        return False
    overlaps = False
    if start_time is not None and end_time is not None:
        overlaps = _entry_time_overlaps(entry, start_time, end_time)
    if not overlaps and start_period is not None and end_period is not None:
        overlaps = _entry_period_overlaps(entry, start_period, end_period)
    if not overlaps:
        return False
    return _date_ranges_overlap(effective_from, effective_to, entry.valid_from, entry.valid_to)


def _time_ranges_overlap(
    start_a,
    end_a,
    start_b,
    end_b,
) -> bool:
    return is_time_overlap(start_a, end_a, start_b, end_b)


def _format_time(value) -> str:
    if value is None:
        return "--"
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return str(value)[:5]


def _build_timetable_overlap_detail(entry: TimetableEntry, section: CourseSection) -> str:
    return (
        f"Lịch học bị trùng với môn {section.course_name} "
        f"từ {_format_time(entry.start_time)} đến {_format_time(entry.end_time)}"
    )


def _timetable_entry_has_invalid_time_range(entry: TimetableEntry) -> bool:
    if entry.start_time is None or entry.end_time is None:
        return False
    return entry.end_time <= entry.start_time


def _entry_is_outside_term(entry: TimetableEntry, section: CourseSection) -> bool:
    term = section.term
    if term is None or term.start_date is None or term.end_date is None:
        return False
    if entry.valid_from and (entry.valid_from < term.start_date or entry.valid_from > term.end_date):
        return True
    if entry.valid_to and (entry.valid_to < term.start_date or entry.valid_to > term.end_date):
        return True
    return False


def _build_invalid_issue(
    *,
    entry: TimetableEntry,
    section: CourseSection,
    reason: str,
    detail: str,
) -> InvalidTimetableIssueRead:
    return InvalidTimetableIssueRead(
        entry_id=entry.id,
        section_id=section.id,
        term_id=section.term_id,
        term_code=section.term.term_code if section.term else None,
        section_code=section.section_code,
        course_code=section.course_code,
        course_name=section.course_name,
        reason=reason,
        detail=detail,
        current_status=entry.status,
    )


def _detect_invalid_timetable_issues(
    db: Session,
    *,
    term_id: UUID | None = None,
) -> list[InvalidTimetableIssueRead]:
    rows = timetable_repo.list_timetable_entries_with_sections(db, term_id=term_id)
    issues_by_id: dict[UUID, InvalidTimetableIssueRead] = {}

    for entry, section in rows:
        if entry.status == "cancelled":
            continue
        if _timetable_entry_has_invalid_time_range(entry):
            issues_by_id[entry.id] = _build_invalid_issue(
                entry=entry,
                section=section,
                reason="invalid_time_range",
                detail="Giờ kết thúc phải lớn hơn giờ bắt đầu.",
            )
            continue
        if _entry_is_outside_term(entry, section):
            issues_by_id[entry.id] = _build_invalid_issue(
                entry=entry,
                section=section,
                reason="outside_term_range",
                detail="Lịch học nằm ngoài thời gian của học kỳ.",
            )

    section_groups: dict[UUID, list[tuple[TimetableEntry, CourseSection]]] = defaultdict(list)
    for entry, section in rows:
        if entry.status == "cancelled":
            continue
        if entry.id in issues_by_id:
            continue
        section_groups[section.id].append((entry, section))

    for grouped_rows in section_groups.values():
        grouped_rows.sort(key=lambda item: (item[0].created_at, item[0].id))
        for index, (entry, section) in enumerate(grouped_rows):
            for existing_entry, _ in grouped_rows[:index]:
                if not _entry_is_conflicting_candidate(
                    existing_entry,
                    day_of_week=entry.day_of_week,
                    start_period=entry.start_period,
                    end_period=entry.end_period,
                    start_time=entry.start_time,
                    end_time=entry.end_time,
                    effective_from=entry.valid_from,
                    effective_to=entry.valid_to,
                ):
                    continue
                issues_by_id[entry.id] = _build_invalid_issue(
                    entry=entry,
                    section=section,
                    reason="overlap_same_section",
                    detail="Lớp học phần có hai lịch học chồng thời gian cùng thứ/ngày hiệu lực.",
                )
                break

    return sorted(
        issues_by_id.values(),
        key=lambda issue: (
            issue.term_code or "",
            issue.course_code,
            issue.section_code,
            issue.reason,
        ),
    )


def _exam_is_conflicting_candidate(
    exam: ExamSchedule,
    *,
    exam_date,
    start_time,
    end_time,
) -> bool:
    if exam.status == "cancelled":
        return False
    if exam.exam_date != exam_date:
        return False
    return _time_ranges_overlap(start_time, end_time, exam.start_time, exam.end_time)


def _resolve_section_teacher(db: Session, *, section: CourseSection, teacher_id: str | None) -> CourseSection:
    if teacher_id:
        return assign_teacher(db, section.id, teacher_id, commit=False)
    if not section.teacher_external_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course section has no assigned teacher",
        )
    return section


def _validate_timetable_term_date_range(*, section: CourseSection, values: dict) -> None:
    term = section.term
    if term is None:
        return

    term_start = term.start_date
    term_end = term.end_date
    if term_start is None or term_end is None:
        logger.warning(
            "Skipping timetable term date validation for section %s because term %s has no full date range",
            section.section_code,
            term.term_code,
        )
        return

    valid_from = values.get("valid_from")
    valid_to = values.get("valid_to")
    if valid_from and (valid_from < term_start or valid_from > term_end):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ngày học nằm ngoài thời gian của học kỳ.",
        )
    if valid_to and (valid_to < term_start or valid_to > term_end):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ngày học nằm ngoài thời gian của học kỳ.",
        )


def _validate_exam_term_date_range(*, section: CourseSection, values: dict) -> None:
    term = section.term
    if term is None:
        return

    term_start = term.start_date
    term_end = term.end_date
    if term_start is None or term_end is None:
        logger.warning(
            "Skipping exam term date validation for section %s because term %s has no full date range",
            section.section_code,
            term.term_code,
        )
        return

    exam_date = values.get("exam_date")
    if exam_date and (exam_date < term_start or exam_date > term_end):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ngày thi nằm ngoài thời gian của học kỳ.",
        )


def _build_student_item(
    entry: TimetableEntry,
    section: CourseSection,
    teacher_name: str | None,
    resolved_date: date | None = None,
) -> StudentTimetableItem:
    return StudentTimetableItem(
        section_id=section.id,
        course_code=section.course_code,
        course_name=section.course_name,
        section_code=section.section_code,
        teacher_external_id=section.teacher_external_id,
        teacher_name=teacher_name,
        timetable_entry_id=entry.id,
        day_of_week=entry.day_of_week,
        date=resolved_date,
        start_period=entry.start_period,
        end_period=entry.end_period,
        start_time=entry.start_time,
        end_time=entry.end_time,
        room=entry.room,
        weeks=entry.weeks,
        location=entry.location,
        campus=entry.location,
        effective_from=entry.valid_from,
        effective_to=entry.valid_to,
        status=entry.status,
        session_type=entry.session_type,
        note=entry.note,
    )


def _build_teacher_item(entry: TimetableEntry, section: CourseSection, student_count: int) -> TeacherTimetableItem:
    return TeacherTimetableItem(
        section_id=section.id,
        timetable_entry_id=entry.id,
        term_id=section.term_id,
        section_code=section.section_code,
        course_code=section.course_code,
        course_name=section.course_name,
        student_count=student_count,
        day_of_week=entry.day_of_week,
        start_period=entry.start_period,
        end_period=entry.end_period,
        start_time=entry.start_time,
        end_time=entry.end_time,
        room=entry.room,
        weeks=entry.weeks,
        location=entry.location,
        campus=entry.location,
        effective_from=entry.valid_from,
        effective_to=entry.valid_to,
        status=entry.status,
    )


def _get_entry_or_404(db: Session, entry_id: UUID) -> TimetableEntry:
    entry = timetable_repo.get_timetable_entry(db, entry_id)
    if entry is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Timetable entry not found")
    return entry


def check_teacher_conflict(
    db: Session,
    *,
    section: CourseSection,
    day_of_week: int,
    start_period: int | None,
    end_period: int | None,
    start_time=None,
    end_time=None,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
) -> tuple[TimetableEntry, CourseSection] | None:
    if not section.teacher_external_id or not section.term_id:
        return None

    candidates = timetable_repo.list_timetable_entries(db, term_id=section.term_id)
    for entry in candidates:
        if exclude_entry_id and entry.id == exclude_entry_id:
            continue
        candidate_section = get_section_or_404(db, entry.section_id)
        if candidate_section.teacher_external_id != section.teacher_external_id:
            continue
        if _entry_is_conflicting_candidate(
            entry,
            day_of_week=day_of_week,
            start_period=start_period,
            end_period=end_period,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            return entry, candidate_section
    return None


def check_room_conflict(
    db: Session,
    *,
    section: CourseSection,
    room: str | None,
    campus: str | None,
    day_of_week: int,
    start_period: int | None,
    end_period: int | None,
    start_time=None,
    end_time=None,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
) -> tuple[TimetableEntry, CourseSection] | None:
    normalized_room = (room or "").strip()
    normalized_campus = (campus or "").strip()
    if not normalized_room or not section.term_id:
        return None

    candidates = timetable_repo.list_timetable_entries(db, term_id=section.term_id)
    for entry in candidates:
        if exclude_entry_id and entry.id == exclude_entry_id:
            continue
        if (entry.room or "").strip() != normalized_room:
            continue
        if normalized_campus and (entry.location or "").strip() != normalized_campus:
            continue
        if _entry_is_conflicting_candidate(
            entry,
            day_of_week=day_of_week,
            start_period=start_period,
            end_period=end_period,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            return entry, get_section_or_404(db, entry.section_id)
    return None


def check_student_conflict(
    db: Session,
    *,
    section: CourseSection,
    day_of_week: int,
    start_period: int | None,
    end_period: int | None,
    start_time=None,
    end_time=None,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
) -> tuple[CourseSection | None, TimetableEntry | None, int]:
    if not section.term_id:
        return None, None, 0

    student_ids = [
        row.student_external_id
        for row in section.students
        if row.enrollment_status == "active"
    ]
    if not student_ids:
        return None, None, 0

    candidates = (
        db.execute(
            select(TimetableEntry, CourseSection)
            .join(CourseSection, CourseSection.id == TimetableEntry.section_id)
            .where(
                CourseSection.term_id == section.term_id,
                CourseSection.id != section.id,
                TimetableEntry.status != "cancelled",
            )
            .order_by(CourseSection.section_code)
        ).all()
    )
    student_id_set = set(student_ids)
    for entry, candidate_section in candidates:
        if exclude_entry_id and entry.id == exclude_entry_id:
            continue
        if not _entry_is_conflicting_candidate(
            entry,
            day_of_week=day_of_week,
            start_period=start_period,
            end_period=end_period,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            continue

        conflict_count = int(
            db.scalar(
                select(func.count(func.distinct(CourseSectionStudent.student_external_id))).where(
                    CourseSectionStudent.section_id == candidate_section.id,
                    CourseSectionStudent.enrollment_status == "active",
                    CourseSectionStudent.student_external_id.in_(student_id_set),
                )
            )
            or 0
        )
        if conflict_count:
            return candidate_section, entry, conflict_count
    return None, None, 0


def _check_section_conflict(
    db: Session,
    *,
    section: CourseSection,
    day_of_week: int,
    start_period: int | None,
    end_period: int | None,
    start_time=None,
    end_time=None,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
) -> TimetableEntry | None:
    for entry in timetable_repo.list_timetable_entries(db, section_id=section.id):
        if exclude_entry_id and entry.id == exclude_entry_id:
            continue
        if _entry_is_conflicting_candidate(
            entry,
            day_of_week=day_of_week,
            start_period=start_period,
            end_period=end_period,
            start_time=start_time,
            end_time=end_time,
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            return entry
    return None


def _check_exam_section_conflict(
    db: Session,
    *,
    section: CourseSection,
    exam_date,
    start_time,
    end_time,
    exclude_exam_id: UUID | None = None,
) -> ExamSchedule | None:
    for exam in timetable_repo.list_exam_schedules(db, section_id=section.id):
        if exclude_exam_id and exam.id == exclude_exam_id:
            continue
        if _exam_is_conflicting_candidate(
            exam,
            exam_date=exam_date,
            start_time=start_time,
            end_time=end_time,
        ):
            return exam
    return None


def _check_exam_room_conflict(
    db: Session,
    *,
    section: CourseSection,
    room: str | None,
    location: str | None,
    exam_date,
    start_time,
    end_time,
    exclude_exam_id: UUID | None = None,
) -> tuple[ExamSchedule | None, CourseSection | None]:
    normalized_room = str(room or "").strip()
    normalized_location = str(location or "").strip()
    if not normalized_room or not section.term_id:
        return None, None

    rows = (
        db.execute(
            select(ExamSchedule, CourseSection)
            .join(CourseSection, CourseSection.id == ExamSchedule.section_id)
            .where(CourseSection.term_id == section.term_id)
            .order_by(ExamSchedule.exam_date, ExamSchedule.start_time)
        ).all()
    )
    for exam, candidate_section in rows:
        if exclude_exam_id and exam.id == exclude_exam_id:
            continue
        if str(exam.room or "").strip() != normalized_room:
            continue
        if normalized_location and str(exam.location or "").strip() != normalized_location:
            continue
        if _exam_is_conflicting_candidate(
            exam,
            exam_date=exam_date,
            start_time=start_time,
            end_time=end_time,
        ):
            return exam, candidate_section
    return None, None


def _check_exam_student_conflict(
    db: Session,
    *,
    section: CourseSection,
    exam_date,
    start_time,
    end_time,
    exclude_exam_id: UUID | None = None,
) -> tuple[CourseSection | None, int]:
    if not section.term_id:
        return None, 0

    student_ids = [
        row.student_external_id
        for row in section.students
        if row.enrollment_status == "active"
    ]
    if not student_ids:
        return None, 0

    rows = (
        db.execute(
            select(ExamSchedule, CourseSection)
            .join(CourseSection, CourseSection.id == ExamSchedule.section_id)
            .where(CourseSection.term_id == section.term_id, CourseSection.id != section.id)
            .order_by(ExamSchedule.exam_date, ExamSchedule.start_time, CourseSection.section_code)
        ).all()
    )
    student_id_set = set(student_ids)
    for exam, candidate_section in rows:
        if exclude_exam_id and exam.id == exclude_exam_id:
            continue
        if not _exam_is_conflicting_candidate(
            exam,
            exam_date=exam_date,
            start_time=start_time,
            end_time=end_time,
        ):
            continue

        conflict_count = int(
            db.scalar(
                select(func.count(func.distinct(CourseSectionStudent.student_external_id))).where(
                    CourseSectionStudent.section_id == candidate_section.id,
                    CourseSectionStudent.enrollment_status == "active",
                    CourseSectionStudent.student_external_id.in_(student_id_set),
                )
            )
            or 0
        )
        if conflict_count:
            return candidate_section, conflict_count
    return None, 0


def _validate_exam_conflicts(
    db: Session,
    *,
    section: CourseSection,
    values: dict,
    exclude_exam_id: UUID | None = None,
) -> None:
    _validate_exam_term_date_range(section=section, values=values)
    exam_date = values.get("exam_date")
    start_time = values.get("start_time")
    end_time = values.get("end_time")
    if exam_date is None or start_time is None or end_time is None:
        return

    section_conflict = _check_exam_section_conflict(
        db,
        section=section,
        exam_date=exam_date,
        start_time=start_time,
        end_time=end_time,
        exclude_exam_id=exclude_exam_id,
    )
    if section_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course section {section.section_code} already has a conflicting exam schedule",
        )

    room_conflict, conflicting_section = _check_exam_room_conflict(
        db,
        section=section,
        room=values.get("room"),
        location=values.get("location"),
        exam_date=exam_date,
        start_time=start_time,
        end_time=end_time,
        exclude_exam_id=exclude_exam_id,
    )
    if room_conflict and conflicting_section:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Exam room conflict with section {conflicting_section.section_code}",
        )

    conflicting_section, conflict_count = _check_exam_student_conflict(
        db,
        section=section,
        exam_date=exam_date,
        start_time=start_time,
        end_time=end_time,
        exclude_exam_id=exclude_exam_id,
    )
    if conflicting_section and conflict_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Không thể áp lịch thi vì có "
                f"{conflict_count} sinh viên bị trùng lịch với lớp học phần {conflicting_section.section_code}."
            ),
        )


def _get_room_by_code(db: Session, room_code: str | None) -> Room | None:
    normalized_room_code = str(room_code or "").strip()
    if not normalized_room_code:
        return None
    return db.scalar(select(Room).where(Room.room_code == normalized_room_code, Room.active.is_(True)))


def _get_section_requirement(db: Session, section_id: UUID) -> SectionSchedulingRequirement | None:
    return db.scalar(select(SectionSchedulingRequirement).where(SectionSchedulingRequirement.section_id == section_id))


def _teacher_is_unavailable(
    db: Session,
    *,
    teacher_external_id: str | None,
    term_id: UUID | None,
    day_of_week: int,
    start_period: int,
    end_period: int,
) -> bool:
    if not teacher_external_id or not term_id:
        return False
    rows = db.scalars(
        select(TeacherAvailability).where(
            TeacherAvailability.teacher_external_id == teacher_external_id,
            TeacherAvailability.term_id == term_id,
            TeacherAvailability.day_of_week == day_of_week,
        )
    ).all()
    for row in rows:
        overlaps = start_period <= row.end_period and end_period >= row.start_period
        if overlaps and row.availability_type == "unavailable":
            return True
    return False


def _validate_constraint_foundation(db: Session, *, section: CourseSection, values: dict) -> None:
    start_period = values.get("start_period")
    end_period = values.get("end_period")
    if start_period is None or end_period is None:
        return

    requirement = _get_section_requirement(db, section.id)
    room = _get_room_by_code(db, values.get("room"))

    if _teacher_is_unavailable(
        db,
        teacher_external_id=section.teacher_external_id,
        term_id=section.term_id,
        day_of_week=values["day_of_week"],
        start_period=start_period,
        end_period=end_period,
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Teacher is unavailable in the requested time range",
        )

    expected_students = requirement.expected_students if requirement and requirement.expected_students is not None else section.student_count
    if room and expected_students and room.capacity is not None and room.capacity < expected_students:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Room capacity is smaller than section student count",
        )

    if requirement and requirement.required_room_type:
        if room is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Room is not registered for the required scheduling constraint",
            )
        if room.room_type != requirement.required_room_type:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Room type does not satisfy section scheduling requirement",
            )


def _validate_conflicts(
    db: Session,
    *,
    section: CourseSection,
    values: dict,
    exclude_entry_id: UUID | None = None,
) -> None:
    _validate_timetable_term_date_range(section=section, values=values)
    start_period = values.get("start_period")
    end_period = values.get("end_period")
    start_time = values.get("start_time")
    end_time = values.get("end_time")
    has_period_range = start_period is not None and end_period is not None
    has_time_range = start_time is not None and end_time is not None
    if not has_period_range and not has_time_range:
        return

    day_of_week = values["day_of_week"]
    valid_from = values.get("valid_from")
    valid_to = values.get("valid_to")
    section_conflict = _check_section_conflict(
        db,
        section=section,
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        start_time=start_time,
        end_time=end_time,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if section_conflict:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_build_timetable_overlap_detail(section_conflict, section),
        )

    teacher_conflict = check_teacher_conflict(
        db,
        section=section,
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        start_time=start_time,
        end_time=end_time,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if teacher_conflict:
        conflict_entry, conflict_section = teacher_conflict
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_build_timetable_overlap_detail(conflict_entry, conflict_section),
        )

    room_conflict = check_room_conflict(
        db,
        section=section,
        room=values.get("room"),
        campus=values.get("location"),
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        start_time=start_time,
        end_time=end_time,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if room_conflict:
        conflict_entry, conflict_section = room_conflict
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_build_timetable_overlap_detail(conflict_entry, conflict_section),
        )

    conflicting_section, conflicting_entry, conflict_count = check_student_conflict(
        db,
        section=section,
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        start_time=start_time,
        end_time=end_time,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if conflicting_section and conflicting_entry and conflict_count:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=_build_timetable_overlap_detail(conflicting_entry, conflicting_section),
        )

    _validate_constraint_foundation(db, section=section, values=values)


def create_timetable_entry(db: Session, values: dict):
    section = get_section_or_404(db, values["section_id"])
    _validate_conflicts(db, section=section, values=values)
    entry = timetable_repo.create_timetable_entry(db, values)
    db.commit()
    return entry


def create_section_timetable_entry(db: Session, *, section_id: UUID, values: dict):
    section = get_section_or_404(db, section_id)
    section = _resolve_section_teacher(db, section=section, teacher_id=values.pop("teacher_id", None))
    mapped_values = {
        "section_id": section.id,
        "day_of_week": values["day_of_week"],
        "start_period": values["start_period"],
        "end_period": values["end_period"],
        "start_time": values.get("start_time"),
        "end_time": values.get("end_time"),
        "room": values.get("room"),
        "weeks": values.get("weeks"),
        "location": values.get("location") or values.get("campus"),
        "valid_from": values.get("valid_from") or values.get("effective_from"),
        "valid_to": values.get("valid_to") or values.get("effective_to"),
        "status": values.get("status", "published"),
        "session_type": values.get("session_type", "study"),
        "note": values.get("note"),
    }
    _validate_conflicts(db, section=section, values=mapped_values)
    entry = timetable_repo.create_timetable_entry(db, mapped_values)
    db.commit()
    return entry


def update_timetable_entry(db: Session, entry_id: UUID, values: dict):
    entry = _get_entry_or_404(db, entry_id)
    current_section = get_section_or_404(db, entry.section_id)
    teacher_id = values.pop("teacher_id", None)

    target_section_id = values.get("section_id", entry.section_id)
    section = get_section_or_404(db, target_section_id)
    if teacher_id or not section.teacher_external_id:
        section = _resolve_section_teacher(db, section=section, teacher_id=teacher_id)

    merged_values = {
        "section_id": target_section_id,
        "day_of_week": values.get("day_of_week", entry.day_of_week),
        "start_period": values.get("start_period", entry.start_period),
        "end_period": values.get("end_period", entry.end_period),
        "start_time": values.get("start_time", entry.start_time),
        "end_time": values.get("end_time", entry.end_time),
        "room": values.get("room", entry.room),
        "weeks": values.get("weeks", entry.weeks),
        "location": values.get("location", entry.location),
        "valid_from": values.get("valid_from", entry.valid_from),
        "valid_to": values.get("valid_to", entry.valid_to),
        "status": values.get("status", entry.status),
        "session_type": values.get("session_type", entry.session_type),
        "note": values.get("note", entry.note),
    }
    _validate_conflicts(db, section=section, values=merged_values, exclude_entry_id=entry.id)
    updated = timetable_repo.update_timetable_entry(db, entry, merged_values)
    db.commit()
    return updated


def update_section_timetable_entry(db: Session, *, entry_id: UUID, values: dict):
    mapped_values = {
        "day_of_week": values.get("day_of_week"),
        "start_period": values.get("start_period"),
        "end_period": values.get("end_period"),
        "start_time": values.get("start_time"),
        "end_time": values.get("end_time"),
        "room": values.get("room"),
        "weeks": values.get("weeks"),
        "location": values.get("location") or values.get("campus"),
        "valid_from": values.get("valid_from") or values.get("effective_from"),
        "valid_to": values.get("valid_to") or values.get("effective_to"),
        "status": values.get("status"),
        "session_type": values.get("session_type"),
        "note": values.get("note"),
        "teacher_id": values.get("teacher_id"),
    }
    filtered_values = {key: value for key, value in mapped_values.items() if value is not None}
    return update_timetable_entry(db, entry_id, filtered_values)


def delete_timetable_entry(db: Session, entry_id: UUID) -> None:
    entry = _get_entry_or_404(db, entry_id)
    timetable_repo.update_timetable_entry(db, entry, {"status": "cancelled"})
    db.commit()


def list_invalid_timetable_entries(db: Session, *, term_id: UUID | None = None) -> list[InvalidTimetableIssueRead]:
    return _detect_invalid_timetable_issues(db, term_id=term_id)


def cleanup_invalid_timetable_entries(
    db: Session,
    *,
    term_id: UUID | None = None,
    entry_ids: list[UUID] | None = None,
) -> TimetableCleanupSummaryRead:
    invalid_entries = _detect_invalid_timetable_issues(db, term_id=term_id)
    target_ids = set(entry_ids or [])
    marked_invalid_count = 0
    for issue in invalid_entries:
        if target_ids and issue.entry_id not in target_ids:
            continue
        entry = timetable_repo.get_timetable_entry(db, issue.entry_id)
        if entry is None or entry.status == "cancelled":
            continue
        note_suffix = f"[AUTO_INVALID:{issue.reason}] {issue.detail}"
        next_note = f"{entry.note}\n{note_suffix}".strip() if entry.note else note_suffix
        timetable_repo.update_timetable_entry(
            db,
            entry,
            {
                "status": "cancelled",
                "note": next_note,
            },
        )
        marked_invalid_count += 1
    db.commit()
    return TimetableCleanupSummaryRead(
        detected_count=len(invalid_entries),
        marked_invalid_count=marked_invalid_count,
        invalid_entries=invalid_entries,
    )


def get_student_timetable(
    db: Session,
    *,
    student_external_id: str,
    term_id: UUID | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
) -> list[StudentTimetableItem]:
    rows = timetable_repo.list_student_timetable_entries(
        db,
        student_external_id=student_external_id,
        term_id=term_id,
        date_from=date_from,
        date_to=date_to,
        statuses=sorted(VISIBLE_TIMETABLE_STATUSES),
    )
    teacher_ids = [section.teacher_external_id for _, section in rows if section.teacher_external_id]
    teachers = external_user_repo.get_cached_users(db, teacher_ids, role="teacher")
    items: list[StudentTimetableItem] = []
    for entry, section in rows:
        teacher = teachers.get(section.teacher_external_id or "")
        dates: list[date | None] = [None]
        if date_from and date_to:
            effective_from = max(date_from, entry.valid_from) if entry.valid_from else date_from
            effective_to = min(date_to, entry.valid_to) if entry.valid_to else date_to
            dates = _dates_matching_day(effective_from, effective_to, entry.day_of_week) if effective_from <= effective_to else []
        for resolved_date in dates:
            items.append(_build_student_item(entry, section, teacher.full_name if teacher else None, resolved_date))
    return items


def get_teacher_timetable(
    db: Session,
    *,
    teacher_external_id: str,
    term_id: UUID | None = None,
    active_on: date | None = None,
) -> list[TeacherTimetableItem]:
    rows = timetable_repo.list_teacher_timetable_entries(
        db,
        teacher_external_id=teacher_external_id,
        term_id=term_id,
        day_of_week=active_on.weekday() + 1 if active_on else None,
        active_on=active_on,
        statuses=sorted(VISIBLE_TIMETABLE_STATUSES),
    )
    return [_build_teacher_item(entry, section, student_count) for entry, section, student_count in rows]


def get_teacher_today_classes(db: Session, *, teacher_external_id: str, today: date) -> list[TeacherTimetableItem]:
    return get_teacher_timetable(db, teacher_external_id=teacher_external_id, active_on=today)


def list_admin_timetable_entries(
    db: Session,
    *,
    section_id: UUID | None = None,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    status: str | None = None,
    q: str | None = None,
    scheduled_status: str = "all",
) -> list[AdminTimetableEntryRead]:
    if scheduled_status == "unscheduled":
        return []
    statuses = [status] if status else None
    rows = timetable_repo.list_timetable_entries_with_sections(
        db,
        section_id=section_id,
        term_id=term_id,
        faculty=None if scheduled_status == "unclassified" else faculty,
        program_name=None if scheduled_status == "unclassified" else program_name,
        course_code=course_code,
        statuses=statuses,
        q=q,
    )
    teacher_ids = [section.teacher_external_id for _, section in rows if section.teacher_external_id]
    teachers = external_user_repo.get_cached_users(db, teacher_ids, role="teacher")
    items = [
        AdminTimetableEntryRead(
            id=entry.id,
            section_id=section.id,
            term_id=section.term_id,
            term_code=section.term.term_code if section.term else None,
            term_name=section.term.term_name if section.term else None,
            faculty=section.faculty,
            program_name=section.program_name,
            section_code=section.section_code,
            course_code=section.course_code,
            course_name=section.course_name,
            teacher_external_id=section.teacher_external_id,
            teacher_name=teachers.get(section.teacher_external_id).full_name if section.teacher_external_id and teachers.get(section.teacher_external_id) else None,
            day_of_week=entry.day_of_week,
            start_period=entry.start_period,
            end_period=entry.end_period,
            start_time=entry.start_time,
            end_time=entry.end_time,
            room=entry.room,
            weeks=entry.weeks,
            location=entry.location,
            status=entry.status,
            session_type=entry.session_type,
            note=entry.note,
            valid_from=entry.valid_from,
            valid_to=entry.valid_to,
            created_at=entry.created_at,
            updated_at=entry.updated_at,
        )
        for entry, section in rows
        if (scheduled_status == "unclassified" and (not section.faculty or not section.program_name))
        or (scheduled_status != "unclassified" and (section.faculty and section.program_name))
    ]
    return items


def list_admin_timetable_course_groups(
    db: Session,
    *,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    section_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
    scheduled_status: str = "all",
    curriculum_semester: int | None = None,  # reserved for future curriculum data mapping
) -> list[AdminTimetableCourseGroupRead]:
    del curriculum_semester
    sections = section_repo.list_sections(
        db,
        term_id=term_id,
        faculty=None if scheduled_status == "unclassified" else faculty,
        program_name=None if scheduled_status == "unclassified" else program_name,
        course_code=course_code,
    )
    teacher_ids = [section.teacher_external_id for section in sections if section.teacher_external_id]
    teachers = external_user_repo.get_cached_users(db, teacher_ids, role="teacher")
    entries = list_admin_timetable_entries(
        db,
        section_id=section_id,
        term_id=term_id,
        faculty=None if scheduled_status == "unclassified" else faculty,
        program_name=None if scheduled_status == "unclassified" else program_name,
        course_code=course_code,
        status=status,
        q=q,
    )
    entry_ids_by_course: dict[tuple[UUID | None, str | None, str | None, str, str], list[AdminTimetableEntryRead]] = defaultdict(list)
    for entry in entries:
        key = (entry.term_id, entry.faculty, entry.program_name, entry.course_code, entry.course_name)
        entry_ids_by_course[key].append(entry)

    normalized_q = str(q or "").strip().lower()
    grouped: list[AdminTimetableCourseGroupRead] = []
    for section in sections:
        if section_id and section.id != section_id:
            continue
        is_unclassified = not section.faculty or not section.program_name
        if scheduled_status == "unclassified" and not is_unclassified:
            continue
        if scheduled_status != "unclassified" and is_unclassified:
            continue

        key = (section.term_id, section.faculty, section.program_name, section.course_code, section.course_name)
        schedules = entry_ids_by_course.get(key, [])
        if status:
            schedules = [item for item in schedules if item.status == status]

        haystacks = [
            section.course_name,
            section.course_code,
            section.section_code,
            teachers.get(section.teacher_external_id).full_name if section.teacher_external_id and teachers.get(section.teacher_external_id) else None,
            section.teacher_external_id,
        ]
        if normalized_q:
            schedule_haystacks = [
                value
                for schedule in schedules
                for value in [schedule.room, schedule.location, schedule.teacher_name, schedule.teacher_external_id]
            ]
            all_text = " ".join(str(value or "").lower() for value in [*haystacks, *schedule_haystacks])
            if normalized_q not in all_text:
                continue

        group = next(
            (
                item
                for item in grouped
                if item.term_id == section.term_id
                and item.faculty == section.faculty
                and item.program_name == section.program_name
                and item.course_code == section.course_code
                and item.course_name == section.course_name
            ),
            None,
        )
        if group is None:
            group = AdminTimetableCourseGroupRead(
                term_id=section.term_id,
                term_code=section.term.term_code if section.term else None,
                term_name=section.term.term_name if section.term else None,
                faculty=section.faculty,
                program_name=section.program_name,
                course_id=section.course_code,
                course_code=section.course_code,
                course_name=section.course_name,
                section_count=0,
                scheduled_count=len(schedules),
                schedules=sorted(
                    schedules,
                    key=lambda item: (item.day_of_week, str(item.start_time or ""), item.section_code),
                ),
            )
            grouped.append(group)
        group.section_count += 1

    filtered: list[AdminTimetableCourseGroupRead] = []
    for group in grouped:
        if scheduled_status == "scheduled" and group.scheduled_count <= 0:
            continue
        if scheduled_status == "unscheduled" and group.scheduled_count > 0:
            continue
        filtered.append(group)

    return sorted(
        filtered,
        key=lambda item: (
            item.faculty or "",
            item.program_name or "",
            item.course_name,
            item.course_code,
        ),
    )


def list_admin_exam_entries(
    db: Session,
    *,
    section_id: UUID | None = None,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    status: str | None = None,
    q: str | None = None,
    scheduled_status: str = "all",
) -> list[AdminExamScheduleRead]:
    if scheduled_status == "unscheduled":
        return []
    statuses = [status] if status else None
    rows = timetable_repo.list_exam_schedules_with_sections(
        db,
        section_id=section_id,
        term_id=term_id,
        faculty=None if scheduled_status == "unclassified" else faculty,
        program_name=None if scheduled_status == "unclassified" else program_name,
        course_code=course_code,
        statuses=statuses,
        q=q,
    )
    teacher_ids = [section.teacher_external_id for _, section in rows if section.teacher_external_id]
    teachers = external_user_repo.get_cached_users(db, teacher_ids, role="teacher")
    items = [
        AdminExamScheduleRead(
            id=exam.id,
            section_id=section.id,
            term_id=section.term_id,
            term_code=section.term.term_code if section.term else None,
            term_name=section.term.term_name if section.term else None,
            faculty=section.faculty,
            program_name=section.program_name,
            section_code=section.section_code,
            course_code=section.course_code,
            course_name=section.course_name,
            teacher_external_id=section.teacher_external_id,
            teacher_name=teachers.get(section.teacher_external_id).full_name if section.teacher_external_id and teachers.get(section.teacher_external_id) else None,
            exam_date=exam.exam_date,
            start_time=exam.start_time,
            end_time=exam.end_time,
            room=exam.room,
            location=exam.location,
            exam_type=exam.exam_type,
            status=exam.status,
            note=exam.note,
            created_at=exam.created_at,
        )
        for exam, section in rows
        if (scheduled_status == "unclassified" and (not section.faculty or not section.program_name))
        or (scheduled_status != "unclassified" and (section.faculty and section.program_name))
    ]
    return items


def list_admin_exam_course_groups(
    db: Session,
    *,
    term_id: UUID | None = None,
    faculty: str | None = None,
    program_name: str | None = None,
    course_code: str | None = None,
    section_id: UUID | None = None,
    status: str | None = None,
    q: str | None = None,
    scheduled_status: str = "all",
    curriculum_semester: int | None = None,
) -> list[AdminExamCourseGroupRead]:
    del curriculum_semester
    sections = section_repo.list_sections(
        db,
        term_id=term_id,
        faculty=None if scheduled_status == "unclassified" else faculty,
        program_name=None if scheduled_status == "unclassified" else program_name,
        course_code=course_code,
    )
    exams = list_admin_exam_entries(
        db,
        section_id=section_id,
        term_id=term_id,
        faculty=None if scheduled_status == "unclassified" else faculty,
        program_name=None if scheduled_status == "unclassified" else program_name,
        course_code=course_code,
        status=status,
        q=q,
        scheduled_status=scheduled_status,
    )
    exams_by_course: dict[tuple[UUID | None, str | None, str | None, str, str], list[AdminExamScheduleRead]] = defaultdict(list)
    for exam in exams:
        key = (exam.term_id, exam.faculty, exam.program_name, exam.course_code, exam.course_name)
        exams_by_course[key].append(exam)

    normalized_q = str(q or "").strip().lower()
    grouped: list[AdminExamCourseGroupRead] = []
    for section in sections:
        if section_id and section.id != section_id:
            continue
        is_unclassified = not section.faculty or not section.program_name
        if scheduled_status == "unclassified" and not is_unclassified:
            continue
        if scheduled_status != "unclassified" and is_unclassified:
            continue

        key = (section.term_id, section.faculty, section.program_name, section.course_code, section.course_name)
        course_exams = exams_by_course.get(key, [])
        haystacks = [section.course_name, section.course_code, section.section_code]
        if normalized_q:
            exam_haystacks = [value for exam in course_exams for value in [exam.room, exam.location, exam.teacher_name, exam.teacher_external_id]]
            all_text = " ".join(str(value or "").lower() for value in [*haystacks, *exam_haystacks])
            if normalized_q not in all_text:
                continue

        group = next(
            (
                item
                for item in grouped
                if item.term_id == section.term_id
                and item.faculty == section.faculty
                and item.program_name == section.program_name
                and item.course_code == section.course_code
                and item.course_name == section.course_name
            ),
            None,
        )
        if group is None:
            group = AdminExamCourseGroupRead(
                term_id=section.term_id,
                term_code=section.term.term_code if section.term else None,
                term_name=section.term.term_name if section.term else None,
                faculty=section.faculty,
                program_name=section.program_name,
                course_id=section.course_code,
                course_code=section.course_code,
                course_name=section.course_name,
                section_count=0,
                scheduled_count=len(course_exams),
                exams=sorted(course_exams, key=lambda item: (item.exam_date, str(item.start_time or ""), item.section_code)),
            )
            grouped.append(group)
        group.section_count += 1

    filtered: list[AdminExamCourseGroupRead] = []
    for group in grouped:
        if scheduled_status == "scheduled" and group.scheduled_count <= 0:
            continue
        if scheduled_status == "unscheduled" and group.scheduled_count > 0:
            continue
        filtered.append(group)

    return sorted(
        filtered,
        key=lambda item: (
            item.faculty or "",
            item.program_name or "",
            item.course_name,
            item.course_code,
        ),
    )


def get_student_exam_schedules(db: Session, *, student_external_id: str) -> list[StudentExamScheduleItem]:
    rows = timetable_repo.list_student_exam_schedules_with_sections(db, student_external_id)
    teacher_ids = [section.teacher_external_id for _, section in rows if section.teacher_external_id]
    teachers = external_user_repo.get_cached_users(db, teacher_ids, role="teacher")
    return [
        StudentExamScheduleItem(
            id=exam.id,
            section_id=section.id,
            term_id=section.term_id,
            term_code=section.term.term_code if section.term else None,
            term_name=section.term.term_name if section.term else None,
            course_code=section.course_code,
            course_name=section.course_name,
            section_code=section.section_code,
            teacher_external_id=section.teacher_external_id,
            teacher_name=teachers.get(section.teacher_external_id).full_name if section.teacher_external_id and teachers.get(section.teacher_external_id) else None,
            exam_date=exam.exam_date,
            start_time=exam.start_time,
            end_time=exam.end_time,
            room=exam.room,
            location=exam.location,
            exam_type=exam.exam_type,
            note=exam.note,
            created_at=exam.created_at,
        )
        for exam, section in rows
    ]


def create_exam_schedule(db: Session, values: dict):
    section = get_section_or_404(db, values["section_id"])
    _validate_exam_conflicts(db, section=section, values=values)
    exam = timetable_repo.create_exam_schedule(db, values)
    db.commit()
    return exam


def update_exam_schedule(db: Session, exam_id: UUID, values: dict):
    exam = timetable_repo.get_exam_schedule(db, exam_id)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam schedule not found")
    target_section_id = values.get("section_id", exam.section_id)
    section = get_section_or_404(db, target_section_id)
    merged_values = {
        "section_id": target_section_id,
        "exam_date": values.get("exam_date", exam.exam_date),
        "start_time": values.get("start_time", exam.start_time),
        "end_time": values.get("end_time", exam.end_time),
        "room": values.get("room", exam.room),
        "location": values.get("location", exam.location),
        "exam_type": values.get("exam_type", exam.exam_type),
        "status": values.get("status", exam.status),
        "note": values.get("note", exam.note),
    }
    _validate_exam_conflicts(db, section=section, values=merged_values, exclude_exam_id=exam.id)
    updated = timetable_repo.update_exam_schedule(db, exam, values)
    db.commit()
    return updated


def delete_exam_schedule(db: Session, exam_id: UUID) -> None:
    exam = timetable_repo.get_exam_schedule(db, exam_id)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam schedule not found")
    timetable_repo.delete_exam_schedule(db, exam)
    db.commit()
