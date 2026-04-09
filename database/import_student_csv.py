import argparse
import csv
from decimal import Decimal
from pathlib import Path

from import_student_json import (
    connect_db,
    insert_curriculum_courses,
    insert_curriculum_summary,
    insert_transcript_courses_and_midterms,
    insert_transcript_terms,
    reset_student_children,
    upsert_student,
)


REQUIRED_COLUMNS = {
    "students": {
        "schema_version",
        "student_id",
        "full_name",
        "class_name",
        "program_name",
        "faculty",
        "education_level",
        "print_date",
    },
    "curriculum_summary": {
        "student_id",
        "total_required_credits",
        "mandatory_credits",
        "elective_credits",
        "note",
    },
    "curriculum_courses": {
        "student_id",
        "semester",
        "course_code",
        "course_name",
        "credits",
        "lt_hours",
        "th_hours",
        "elective_group",
        "group_required_credits",
        "prerequisites_raw",
        "passed_in_curriculum",
        "course_type",
        "is_excluded_from_gpa",
    },
    "transcript_terms": {
        "student_id",
        "term",
        "gpa10_term",
        "gpa4_term",
        "gpa10_cumulative",
        "gpa4_cumulative",
        "registered_credits",
        "earned_credits",
        "passed_credits",
        "outstanding_failed_credits",
        "academic_standing_cumulative",
        "academic_standing_term",
    },
    "transcript_courses": {
        "student_id",
        "term",
        "class_section_code",
        "course_name",
        "credits",
        "final_score",
        "gpa4",
        "letter",
        "classification",
        "status",
        "midterm_scores",
    },
}


def read_csv_rows(path: Path, required_columns: set[str]) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"CSV file not found: {path}")

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        headers = set(reader.fieldnames or [])
        missing = required_columns - headers
        if missing:
            raise ValueError(
                f"CSV file {path} is missing required columns: {', '.join(sorted(missing))}"
            )
        return list(reader)


def clean_text(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def parse_int(value: str | None, *, required: bool = True) -> int | None:
    cleaned = clean_text(value)
    if cleaned is None:
        if required:
            raise ValueError("Expected integer value but got empty input")
        return None
    return int(cleaned)


def parse_decimal(value: str | None, *, required: bool = True) -> Decimal | None:
    cleaned = clean_text(value)
    if cleaned is None:
        if required:
            raise ValueError("Expected numeric value but got empty input")
        return None
    return Decimal(cleaned)


def parse_bool(value: str | None, *, default: bool = False) -> bool:
    cleaned = clean_text(value)
    if cleaned is None:
        return default

    normalized = cleaned.lower()
    if normalized in {"1", "true", "t", "yes", "y"}:
        return True
    if normalized in {"0", "false", "f", "no", "n"}:
        return False
    raise ValueError(f"Invalid boolean value: {value}")


def parse_midterm_scores(value: str | None) -> list[Decimal]:
    cleaned = clean_text(value)
    if cleaned is None:
        return []

    parts = [part.strip() for part in cleaned.replace("|", ";").split(";")]
    return [Decimal(part) for part in parts if part]


def build_payloads(args) -> list[dict]:
    student_rows = read_csv_rows(Path(args.students_csv), REQUIRED_COLUMNS["students"])
    summary_rows = read_csv_rows(
        Path(args.curriculum_summary_csv), REQUIRED_COLUMNS["curriculum_summary"]
    )
    curriculum_rows = read_csv_rows(
        Path(args.curriculum_courses_csv), REQUIRED_COLUMNS["curriculum_courses"]
    )
    transcript_term_rows = read_csv_rows(
        Path(args.transcript_terms_csv), REQUIRED_COLUMNS["transcript_terms"]
    )
    transcript_course_rows = read_csv_rows(
        Path(args.transcript_courses_csv), REQUIRED_COLUMNS["transcript_courses"]
    )

    payload_map = {}
    for row in student_rows:
        student_id = clean_text(row.get("student_id"))
        if student_id is None:
            raise ValueError("students CSV contains empty student_id")

        payload_map[student_id] = {
            "schema_version": clean_text(row.get("schema_version")) or "1.0",
            "student": {
                "student_id": student_id,
                "full_name": clean_text(row.get("full_name")),
                "class_name": clean_text(row.get("class_name")),
                "program_name": clean_text(row.get("program_name")),
                "faculty": clean_text(row.get("faculty")),
                "education_level": clean_text(row.get("education_level")),
                "print_date": clean_text(row.get("print_date")),
            },
            "curriculum_summary": None,
            "curriculum_courses": [],
            "transcript_terms": [],
            "transcript_courses": [],
        }

    for row in summary_rows:
        student_id = clean_text(row.get("student_id"))
        payload = payload_map.get(student_id)
        if payload is None:
            raise ValueError(
                f"curriculum_summary CSV references unknown student_id: {student_id}"
            )
        payload["curriculum_summary"] = {
            "total_required_credits": parse_int(row.get("total_required_credits")),
            "mandatory_credits": parse_int(row.get("mandatory_credits")),
            "elective_credits": parse_int(row.get("elective_credits")),
            "note": clean_text(row.get("note")) or "",
        }

    for row in curriculum_rows:
        student_id = clean_text(row.get("student_id"))
        payload = payload_map.get(student_id)
        if payload is None:
            raise ValueError(
                f"curriculum_courses CSV references unknown student_id: {student_id}"
            )
        payload["curriculum_courses"].append(
            {
                "semester": parse_int(row.get("semester")),
                "course_code": clean_text(row.get("course_code")),
                "course_name": clean_text(row.get("course_name")),
                "credits": parse_int(row.get("credits")),
                "lt_hours": parse_int(row.get("lt_hours")),
                "th_hours": parse_int(row.get("th_hours")),
                "elective_group": parse_int(row.get("elective_group")),
                "group_required_credits": parse_int(
                    row.get("group_required_credits"), required=False
                ),
                "prerequisites_raw": clean_text(row.get("prerequisites_raw")),
                "passed_in_curriculum": parse_bool(row.get("passed_in_curriculum")),
                "course_type": clean_text(row.get("course_type")),
                "is_excluded_from_gpa": parse_bool(
                    row.get("is_excluded_from_gpa"), default=False
                ),
            }
        )

    for row in transcript_term_rows:
        student_id = clean_text(row.get("student_id"))
        payload = payload_map.get(student_id)
        if payload is None:
            raise ValueError(
                f"transcript_terms CSV references unknown student_id: {student_id}"
            )
        payload["transcript_terms"].append(
            {
                "term": clean_text(row.get("term")),
                "gpa10_term": parse_decimal(row.get("gpa10_term"), required=False),
                "gpa4_term": parse_decimal(row.get("gpa4_term"), required=False),
                "gpa10_cumulative": parse_decimal(row.get("gpa10_cumulative")),
                "gpa4_cumulative": parse_decimal(row.get("gpa4_cumulative")),
                "registered_credits": parse_int(row.get("registered_credits")),
                "earned_credits": parse_int(row.get("earned_credits")),
                "passed_credits": parse_int(row.get("passed_credits")),
                "outstanding_failed_credits": parse_int(
                    row.get("outstanding_failed_credits")
                ),
                "academic_standing_cumulative": clean_text(
                    row.get("academic_standing_cumulative")
                ),
                "academic_standing_term": clean_text(row.get("academic_standing_term")),
            }
        )

    for row in transcript_course_rows:
        student_id = clean_text(row.get("student_id"))
        payload = payload_map.get(student_id)
        if payload is None:
            raise ValueError(
                f"transcript_courses CSV references unknown student_id: {student_id}"
            )
        payload["transcript_courses"].append(
            {
                "term": clean_text(row.get("term")),
                "class_section_code": clean_text(row.get("class_section_code")),
                "course_name": clean_text(row.get("course_name")),
                "credits": parse_int(row.get("credits")),
                "final_score": parse_decimal(row.get("final_score"), required=False),
                "gpa4": parse_decimal(row.get("gpa4"), required=False),
                "letter": clean_text(row.get("letter")),
                "classification": clean_text(row.get("classification")),
                "status": clean_text(row.get("status")),
                "midterm_scores": parse_midterm_scores(row.get("midterm_scores")),
            }
        )

    missing_summary_ids = [
        student_id
        for student_id, payload in payload_map.items()
        if payload["curriculum_summary"] is None
    ]
    if missing_summary_ids:
        raise ValueError(
            "Missing curriculum_summary rows for student_id: "
            + ", ".join(sorted(missing_summary_ids))
        )

    return list(payload_map.values())


def import_one_payload(cur, payload: dict):
    student_pk = upsert_student(cur, payload)
    reset_student_children(cur, student_pk)
    insert_curriculum_summary(cur, student_pk, payload)
    curriculum_count = insert_curriculum_courses(cur, student_pk, payload)
    term_map = insert_transcript_terms(cur, student_pk, payload)
    transcript_count, midterm_count = insert_transcript_courses_and_midterms(
        cur, student_pk, payload, term_map
    )

    return {
        "student_id": payload["student"]["student_id"],
        "curriculum_courses": curriculum_count,
        "transcript_terms": len(term_map),
        "transcript_courses": transcript_count,
        "midterm_scores": midterm_count,
    }


def parse_args():
    parser = argparse.ArgumentParser(
        description="Import student CSV data into PostgreSQL (normalized schema)."
    )
    parser.add_argument(
        "--students-csv",
        required=True,
        help="CSV file for student base information.",
    )
    parser.add_argument(
        "--curriculum-summary-csv",
        required=True,
        help="CSV file for curriculum summary rows.",
    )
    parser.add_argument(
        "--curriculum-courses-csv",
        required=True,
        help="CSV file for curriculum course rows.",
    )
    parser.add_argument(
        "--transcript-terms-csv",
        required=True,
        help="CSV file for transcript term rows.",
    )
    parser.add_argument(
        "--transcript-courses-csv",
        required=True,
        help="CSV file for transcript course rows. midterm_scores uses ';' or '|' separators.",
    )
    parser.add_argument("--host", help="PostgreSQL host")
    parser.add_argument("--port", type=int, help="PostgreSQL port")
    parser.add_argument("--dbname", help="PostgreSQL database name")
    parser.add_argument("--user", help="PostgreSQL user")
    parser.add_argument("--password", help="PostgreSQL password")
    return parser.parse_args()


def main():
    args = parse_args()
    payloads = build_payloads(args)

    conn = connect_db(args)
    try:
        with conn:
            with conn.cursor() as cur:
                for payload in payloads:
                    result = import_one_payload(cur, payload)
                    print(
                        "[OK] student_id={student_id} curriculum_courses={curriculum_courses} "
                        "transcript_terms={transcript_terms} transcript_courses={transcript_courses} "
                        "midterm_scores={midterm_scores}".format(**result)
                    )
    finally:
        conn.close()


if __name__ == "__main__":
    main()
