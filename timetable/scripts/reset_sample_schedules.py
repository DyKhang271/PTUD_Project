from __future__ import annotations

import argparse
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.core.database import SessionLocal
from app.repositories import section_repo
from app.services import import_service
from sqlalchemy.exc import ProgrammingError


def main() -> int:
    parser = argparse.ArgumentParser(description="Reset sample timetable entries for a term.")
    parser.add_argument("--term", required=True, help="Academic term code, e.g. HK2_2025_2026")
    parser.add_argument("--apply", action="store_true", help="Actually delete and reseed sample schedules.")
    args = parser.parse_args()

    with SessionLocal() as db:
        try:
            term = section_repo.get_term_by_code(db, args.term)
            if term is None:
                print(f"Term not found: {args.term}", file=sys.stderr)
                return 1

            count, descriptions = import_service.cleanup_sample_schedules_for_term(
                db,
                term_id=term.id,
                apply=args.apply,
            )
            print(f"Sample schedules matched for reset: {count}")
            for description in descriptions:
                print(f"- {description}")

            if not args.apply:
                db.rollback()
                print("Dry run only. Re-run with --apply to delete and reseed.")
                return 0

            result = import_service.import_seed_from_core(
                db,
                {
                    "term": term.term_name,
                    "term_code": term.term_code,
                    "create_sample_timetable": True,
                    "create_sample_attendance": True,
                },
            )
            print(
                f"Reseed completed: created_timetable_entries={result.created_timetable_entries} "
                f"created_attendance_sessions={result.created_attendance_sessions} "
                f"created_attendance_records={result.created_attendance_records}"
            )
            if result.errors:
                for error in result.errors:
                    print(f"- {error}")
            return 0
        except ProgrammingError:
            db.rollback()
            print("Database schema is out of date. Run `alembic upgrade head` before resetting sample schedules.", file=sys.stderr)
            return 1


if __name__ == "__main__":
    raise SystemExit(main())
