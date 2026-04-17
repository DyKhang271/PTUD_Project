from __future__ import annotations

import json
import os
from dataclasses import dataclass

import psycopg2

from student_data_store import get_student_record

from .documents import normalize_text


def _connect():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not configured.")
    return psycopg2.connect(database_url)


def fetch_student_bundle(student_id: str | None) -> dict | None:
    if not student_id:
        return None

    with _connect() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT payload::text FROM student_raw_records WHERE student_id = %s;",
                (student_id,),
            )
            row = cur.fetchone()
            if not row:
                return None

            raw_payload = json.loads(row[0])
            cur.execute(
                "SELECT payload::text FROM app_runtime_state WHERE state_key = 'account_metadata';"
            )
            account_metadata_row = cur.fetchone()
            account_metadata = json.loads(account_metadata_row[0]) if account_metadata_row else {}

    return {
        "student_id": student_id,
        "raw_payload": raw_payload,
        "normalized_record": get_student_record(student_id),
        "account_metadata": account_metadata.get(student_id, {}),
    }


@dataclass(frozen=True)
class CourseLookupResult:
    course_name: str
    course_code: str
    attempts: list[dict]
    match_score: int


def _academic_tokens() -> tuple[str, ...]:
    return (
        "diem",
        "mon",
        "hoc",
        "bang",
        "gpa",
        "tin",
        "chi",
        "ket",
        "qua",
        "hoc",
        "ky",
        "qua",
        "rot",
        "dat",
        "chua",
    )


def looks_like_student_academic_query(message: str) -> bool:
    normalized = normalize_text(message)
    phrases = (
        "da hoc mon",
        "hoc mon",
        "diem mon",
        "bang diem",
        "ket qua hoc tap",
        "gpa",
        "tin chi",
        "hoc ky",
        "qua mon",
        "rot mon",
        "dat mon",
    )
    if any(phrase in normalized for phrase in phrases):
        return True

    tokens = set(normalized.split())
    return len(tokens & set(_academic_tokens())) >= 2


def _group_transcript_courses(raw_payload: dict) -> dict[tuple[str, str], list[dict]]:
    grouped: dict[tuple[str, str], list[dict]] = {}
    for course in raw_payload.get("transcript_courses", []):
        course_name = (course.get("course_name") or "").strip()
        course_code = (course.get("course_code") or course.get("class_section_code") or "")[:10]
        if not course_name or not course_code:
            continue
        key = (course_code, course_name)
        grouped.setdefault(key, []).append(course)
    return grouped


def _score_course_match(message: str, course_name: str, course_code: str) -> int:
    normalized_message = normalize_text(message)
    normalized_name = normalize_text(course_name)
    message_tokens = set(normalized_message.split())
    name_tokens = set(normalized_name.split())
    overlap = len(message_tokens & name_tokens)

    score = overlap
    if normalized_name and normalized_name in normalized_message:
        score += 10
    if course_code and course_code.lower() in message.lower():
        score += 10

    # For course lookups, require more than generic words such as "mon" or "hoc".
    meaningful_tokens = {
        token for token in name_tokens if len(token) >= 3 and token not in {"mon", "hoc", "phan"}
    }
    meaningful_overlap = len(message_tokens & meaningful_tokens)
    score += meaningful_overlap * 2
    return score


def find_course_lookup(student_bundle: dict | None, message: str) -> CourseLookupResult | None:
    if not student_bundle:
        return None

    grouped = _group_transcript_courses(student_bundle["raw_payload"])
    best_match: CourseLookupResult | None = None
    for (course_code, course_name), attempts in grouped.items():
        score = _score_course_match(message, course_name, course_code)
        if score < 4:
            continue

        candidate = CourseLookupResult(
            course_name=course_name,
            course_code=course_code,
            attempts=attempts,
            match_score=score,
        )
        if best_match is None or candidate.match_score > best_match.match_score:
            best_match = candidate

    return best_match
