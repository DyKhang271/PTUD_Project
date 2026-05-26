from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal
from app.repositories import section_repo, timetable_repo
from app.services import timetable_service
from sqlalchemy.exc import ProgrammingError


def main() -> int:
    parser = argparse.ArgumentParser(description="Check timetable conflicts and non-standard shifts.")
    parser.add_argument("--term", required=True, help="Academic term code, e.g. HK2_2025_2026")
    args = parser.parse_args()

    with SessionLocal() as db:
        try:
            term = section_repo.get_term_by_code(db, args.term)
            if term is None:
                print(f"Term not found: {args.term}", file=sys.stderr)
                return 1

            issues = {}
            for issue in timetable_service.list_invalid_timetable_entries(db, term_id=term.id):
                issues[(str(issue.entry_id), issue.reason)] = {
                    "term": issue.term_code or args.term,
                    "day_of_week": "--",
                    "shift": "--",
                    "room": "--",
                    "teacher": "--",
                    "section": issue.section_code,
                    "course": issue.course_name,
                    "reason": issue.reason,
                    "detail": issue.detail,
                }

            for entry, section in timetable_repo.list_timetable_entries_with_sections(db, term_id=term.id):
                try:
                    conflict = timetable_service.find_schedule_conflict(
                        db,
                        section=section,
                        values={
                            "section_id": section.id,
                            "day_of_week": entry.day_of_week,
                            "shift_code": entry.shift_code,
                            "shift_name": entry.shift_name,
                            "start_period": entry.start_period,
                            "end_period": entry.end_period,
                            "start_time": entry.start_time,
                            "end_time": entry.end_time,
                            "room": entry.room,
                            "weeks": entry.weeks,
                            "location": entry.location,
                            "valid_from": entry.valid_from,
                            "valid_to": entry.valid_to,
                            "status": entry.status,
                            "session_type": entry.session_type,
                            "source": entry.source,
                            "is_sample": entry.is_sample,
                            "note": entry.note,
                        },
                        exclude_entry_id=entry.id,
                    )
                except Exception as exc:
                    conflict = timetable_service.ScheduleConflict(reason="invalid_entry", detail=str(exc))

                if conflict is None:
                    continue

                issues[(str(entry.id), conflict.reason)] = {
                    "term": term.term_code,
                    "day_of_week": entry.day_of_week,
                    "shift": entry.shift_name or entry.shift_code or f"{entry.start_time}-{entry.end_time}",
                    "room": entry.room or "--",
                    "teacher": section.teacher_external_id or "--",
                    "section": section.section_code,
                    "course": section.course_name,
                    "reason": conflict.reason,
                    "detail": conflict.detail,
                }
        except ProgrammingError:
            print("Database schema is out of date. Run `alembic upgrade head` before checking conflicts.", file=sys.stderr)
            return 1

        if not issues:
            print(f"0 conflict found for term {term.term_code}.")
            return 0

        print(f"Found {len(issues)} issue(s) for term {term.term_code}:")
        for item in issues.values():
            print(
                f"- term={item['term']} day={item['day_of_week']} shift={item['shift']} room={item['room']} "
                f"teacher={item['teacher']} section={item['section']} course={item['course']} "
                f"reason={item['reason']} detail={item['detail']}"
            )
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
