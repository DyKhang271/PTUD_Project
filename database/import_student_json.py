import argparse
import json
import os
from datetime import datetime
from pathlib import Path

import psycopg2


def parse_date(value: str):
    return datetime.strptime(value, "%Y-%m-%d").date()


def connect_db(args):
    return psycopg2.connect(
        host=args.host or os.getenv("PGHOST", "localhost"),
        port=args.port or int(os.getenv("PGPORT", "5432")),
        dbname=args.dbname or os.getenv("PGDATABASE", "postgres"),
        user=args.user or os.getenv("PGUSER", "postgres"),
        password=args.password or os.getenv("PGPASSWORD", "postgres"),
    )


def upsert_student(cur, payload: dict) -> int:
    student = payload["student"]
    cur.execute(
        """
        INSERT INTO students (
            schema_version, student_id, full_name, class_name,
            program_name, faculty, education_level, print_date
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (student_id) DO UPDATE SET
            schema_version = EXCLUDED.schema_version,
            full_name = EXCLUDED.full_name,
            class_name = EXCLUDED.class_name,
            program_name = EXCLUDED.program_name,
            faculty = EXCLUDED.faculty,
            education_level = EXCLUDED.education_level,
            print_date = EXCLUDED.print_date
        RETURNING id;
        """,
        (
            payload["schema_version"],
            student["student_id"],
            student["full_name"],
            student["class_name"],
            student["program_name"],
            student["faculty"],
            student["education_level"],
            parse_date(student["print_date"]),
        ),
    )
    return cur.fetchone()[0]


def reset_student_children(cur, student_pk: int):
    cur.execute(
        """
        DELETE FROM curriculum_courses WHERE student_id = %s;
        DELETE FROM transcript_course_midterm_scores
        WHERE transcript_course_id IN (
            SELECT id FROM transcript_courses WHERE student_id = %s
        );
        DELETE FROM transcript_courses WHERE student_id = %s;
        DELETE FROM transcript_terms WHERE student_id = %s;
        DELETE FROM curriculum_summaries WHERE student_id = %s;
        """,
        (student_pk, student_pk, student_pk, student_pk, student_pk),
    )


def insert_curriculum_summary(cur, student_pk: int, payload: dict):
    summary = payload["curriculum_summary"]
    cur.execute(
        """
        INSERT INTO curriculum_summaries (
            student_id, total_required_credits, mandatory_credits,
            elective_credits, note
        )
        VALUES (%s, %s, %s, %s, %s);
        """,
        (
            student_pk,
            summary["total_required_credits"],
            summary["mandatory_credits"],
            summary["elective_credits"],
            summary["note"],
        ),
    )


def insert_curriculum_courses(cur, student_pk: int, payload: dict):
    rows = 0
    for course in payload["curriculum_courses"]:
        cur.execute(
            """
            INSERT INTO curriculum_courses (
                student_id, semester, course_code, course_name, credits,
                lt_hours, th_hours, elective_group, group_required_credits,
                prerequisites_raw, passed_in_curriculum, course_type, is_excluded_from_gpa
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s);
            """,
            (
                student_pk,
                course["semester"],
                course["course_code"],
                course["course_name"],
                course["credits"],
                course["lt_hours"],
                course["th_hours"],
                course["elective_group"],
                course.get("group_required_credits"),
                course.get("prerequisites_raw"),
                course["passed_in_curriculum"],
                course["course_type"],
                course.get("is_excluded_from_gpa", False),
            ),
        )
        rows += 1
    return rows


def insert_transcript_terms(cur, student_pk: int, payload: dict):
    term_id_map = {}
    for term in payload["transcript_terms"]:
        cur.execute(
            """
            INSERT INTO transcript_terms (
                student_id, term, gpa10_term, gpa4_term, gpa10_cumulative,
                gpa4_cumulative, registered_credits, earned_credits, passed_credits,
                outstanding_failed_credits, academic_standing_cumulative, academic_standing_term
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                student_pk,
                term["term"],
                term.get("gpa10_term"),
                term.get("gpa4_term"),
                term["gpa10_cumulative"],
                term["gpa4_cumulative"],
                term["registered_credits"],
                term["earned_credits"],
                term["passed_credits"],
                term["outstanding_failed_credits"],
                term["academic_standing_cumulative"],
                term.get("academic_standing_term"),
            ),
        )
        term_id_map[term["term"]] = cur.fetchone()[0]
    return term_id_map


def insert_transcript_courses_and_midterms(cur, student_pk: int, payload: dict, term_id_map: dict):
    course_rows = 0
    midterm_rows = 0

    for course in payload["transcript_courses"]:
        term_id = term_id_map.get(course["term"])
        if term_id is None:
            raise ValueError(f"Term not found for course: {course['term']}")

        cur.execute(
            """
            INSERT INTO transcript_courses (
                student_id, transcript_term_id, term, class_section_code,
                course_name, credits, final_score, gpa4, letter, classification, status
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id;
            """,
            (
                student_pk,
                term_id,
                course["term"],
                course["class_section_code"],
                course["course_name"],
                course["credits"],
                course.get("final_score"),
                course.get("gpa4"),
                course.get("letter"),
                course.get("classification"),
                course.get("status"),
            ),
        )
        transcript_course_id = cur.fetchone()[0]
        course_rows += 1

        for idx, score in enumerate(course.get("midterm_scores", []), start=1):
            cur.execute(
                """
                INSERT INTO transcript_course_midterm_scores (
                    transcript_course_id, score_order, score
                )
                VALUES (%s, %s, %s);
                """,
                (transcript_course_id, idx, score),
            )
            midterm_rows += 1

    return course_rows, midterm_rows


def import_one_file(cur, json_path: Path):
    with json_path.open("r", encoding="utf-8") as f:
        payload = json.load(f)

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
        description="Import student JSON data into PostgreSQL (normalized schema)."
    )
    parser.add_argument(
        "--json",
        nargs="+",
        required=True,
        help="One or more JSON files to import.",
    )
    parser.add_argument("--host", help="PostgreSQL host")
    parser.add_argument("--port", type=int, help="PostgreSQL port")
    parser.add_argument("--dbname", help="PostgreSQL database name")
    parser.add_argument("--user", help="PostgreSQL user")
    parser.add_argument("--password", help="PostgreSQL password")
    return parser.parse_args()


def main():
    args = parse_args()
    json_paths = [Path(p) for p in args.json]

    for p in json_paths:
        if not p.exists():
            raise FileNotFoundError(f"JSON file not found: {p}")

    conn = connect_db(args)
    try:
        with conn:
            with conn.cursor() as cur:
                for p in json_paths:
                    result = import_one_file(cur, p)
                    print(
                        "[OK] student_id={student_id} curriculum_courses={curriculum_courses} "
                        "transcript_terms={transcript_terms} transcript_courses={transcript_courses} "
                        "midterm_scores={midterm_scores}".format(**result)
                    )
    finally:
        conn.close()


if __name__ == "__main__":
    main()

