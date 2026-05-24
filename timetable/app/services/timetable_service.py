from __future__ import annotations

from datetime import date, timedelta
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.course_section import CourseSection, CourseSectionStudent
from app.models.scheduling_constraints import Room, SectionSchedulingRequirement, TeacherAvailability
from app.models.timetable import TimetableEntry
from app.repositories import external_user_repo, timetable_repo
from app.schemas.timetable_schema import StudentTimetableItem, TeacherTimetableItem
from app.services.section_service import assign_teacher, get_section_or_404

VISIBLE_TIMETABLE_STATUSES = {"published"}


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


def _entry_is_conflicting_candidate(
    entry: TimetableEntry,
    *,
    day_of_week: int,
    start_period: int,
    end_period: int,
    effective_from: date | None,
    effective_to: date | None,
) -> bool:
    if entry.status == "cancelled":
        return False
    if entry.day_of_week != day_of_week:
        return False
    if not _entry_period_overlaps(entry, start_period, end_period):
        return False
    return _date_ranges_overlap(effective_from, effective_to, entry.valid_from, entry.valid_to)


def _resolve_section_teacher(db: Session, *, section: CourseSection, teacher_id: str | None) -> CourseSection:
    if teacher_id:
        return assign_teacher(db, section.id, teacher_id, commit=False)
    if not section.teacher_external_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Course section has no assigned teacher",
        )
    return section


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
    start_period: int,
    end_period: int,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
) -> TimetableEntry | None:
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
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            return entry
    return None


def check_room_conflict(
    db: Session,
    *,
    section: CourseSection,
    room: str | None,
    campus: str | None,
    day_of_week: int,
    start_period: int,
    end_period: int,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
) -> TimetableEntry | None:
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
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            return entry
    return None


def check_student_conflict(
    db: Session,
    *,
    section: CourseSection,
    day_of_week: int,
    start_period: int,
    end_period: int,
    effective_from: date | None,
    effective_to: date | None,
    exclude_entry_id: UUID | None = None,
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
            return candidate_section, conflict_count
    return None, 0


def _check_section_conflict(
    db: Session,
    *,
    section: CourseSection,
    day_of_week: int,
    start_period: int,
    end_period: int,
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
            effective_from=effective_from,
            effective_to=effective_to,
        ):
            return entry
    return None


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
    start_period = values.get("start_period")
    end_period = values.get("end_period")
    if start_period is None or end_period is None:
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
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if section_conflict:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Course section {section.section_code} already has a conflicting timetable entry",
        )

    teacher_conflict = check_teacher_conflict(
        db,
        section=section,
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if teacher_conflict:
        conflicting_section = get_section_or_404(db, teacher_conflict.section_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Teacher conflict with section {conflicting_section.section_code}",
        )

    room_conflict = check_room_conflict(
        db,
        section=section,
        room=values.get("room"),
        campus=values.get("location"),
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if room_conflict:
        conflicting_section = get_section_or_404(db, room_conflict.section_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Room conflict with section {conflicting_section.section_code}",
        )

    conflicting_section, conflict_count = check_student_conflict(
        db,
        section=section,
        day_of_week=day_of_week,
        start_period=start_period,
        end_period=end_period,
        effective_from=valid_from,
        effective_to=valid_to,
        exclude_entry_id=exclude_entry_id,
    )
    if conflicting_section and conflict_count:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Khong the ap lich vi co "
                f"{conflict_count} sinh vien bi trung lich voi lop hoc phan {conflicting_section.section_code}."
            ),
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


def create_exam_schedule(db: Session, values: dict):
    get_section_or_404(db, values["section_id"])
    exam = timetable_repo.create_exam_schedule(db, values)
    db.commit()
    return exam


def update_exam_schedule(db: Session, exam_id: UUID, values: dict):
    exam = timetable_repo.get_exam_schedule(db, exam_id)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam schedule not found")
    if values.get("section_id"):
        get_section_or_404(db, values["section_id"])
    updated = timetable_repo.update_exam_schedule(db, exam, values)
    db.commit()
    return updated


def delete_exam_schedule(db: Session, exam_id: UUID) -> None:
    exam = timetable_repo.get_exam_schedule(db, exam_id)
    if exam is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Exam schedule not found")
    timetable_repo.delete_exam_schedule(db, exam)
    db.commit()
