from __future__ import annotations

from app.core.database import SessionLocal
from app.services.section_service import backfill_term_date_ranges


def main() -> None:
    db = SessionLocal()
    try:
        result = backfill_term_date_ranges(db)
    finally:
        db.close()
    print(result)


if __name__ == "__main__":
    main()
