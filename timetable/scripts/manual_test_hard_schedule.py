from __future__ import annotations

import os
import sys
from collections.abc import Iterable

import httpx


BASE_URL = os.getenv("TIMETABLE_API_BASE_URL", "http://localhost:8001").rstrip("/")

ADMIN_USERNAME = os.getenv("TIMETABLE_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("TIMETABLE_ADMIN_PASSWORD", "admin")
TEACHER_USERNAME = os.getenv("TIMETABLE_TEACHER_USERNAME", "gvungdung")
TEACHER_PASSWORD = os.getenv("TIMETABLE_TEACHER_PASSWORD", "gvungdung")
STUDENT_USERNAME = os.getenv("TIMETABLE_STUDENT_USERNAME", "23630781")
STUDENT_PASSWORD = os.getenv("TIMETABLE_STUDENT_PASSWORD", "23630781")

PRIMARY_TEACHER_ID = os.getenv("TIMETABLE_PRIMARY_TEACHER_ID", TEACHER_USERNAME)
SECONDARY_TEACHER_ID = os.getenv("TIMETABLE_SECONDARY_TEACHER_ID")
TERTIARY_TEACHER_ID = os.getenv("TIMETABLE_TERTIARY_TEACHER_ID")

IMPORT_TERM = os.getenv("TIMETABLE_IMPORT_TERM", "HK2 (2025 - 2026)")
IMPORT_CLASS_NAME = os.getenv("TIMETABLE_IMPORT_CLASS_NAME")
IMPORT_STUDENT_ID = os.getenv("TIMETABLE_IMPORT_STUDENT_ID")


def log(message: str) -> None:
    print(message)


def assert_status(response: httpx.Response, expected_statuses: Iterable[int], step: str) -> None:
    if response.status_code not in set(expected_statuses):
        raise RuntimeError(f"{step} failed with {response.status_code}: {response.text}")


def login(client: httpx.Client, *, role: str, username: str, password: str) -> str:
    response = client.post(
        f"{BASE_URL}/auth/login",
        json={"role": role, "username": username, "password": password},
    )
    assert_status(response, {200}, f"login {role}")
    return response.json()["access_token"]


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def create_timetable_payload(room: str, campus: str = "Co so 1") -> dict:
    return {
        "day_of_week": 2,
        "start_period": 1,
        "end_period": 3,
        "start_time": "07:00:00",
        "end_time": "09:30:00",
        "room": room,
        "campus": campus,
        "effective_from": "2026-02-01",
        "effective_to": "2026-05-30",
        "status": "published",
    }


def overlap_count(client: httpx.Client, token: str, left_section_id: str, right_section_id: str) -> int:
    left_res = client.get(f"{BASE_URL}/admin/course-sections/{left_section_id}/students", headers=auth_headers(token))
    right_res = client.get(f"{BASE_URL}/admin/course-sections/{right_section_id}/students", headers=auth_headers(token))
    assert_status(left_res, {200}, "list left section students")
    assert_status(right_res, {200}, "list right section students")
    left_ids = {item["student_external_id"] for item in left_res.json()}
    right_ids = {item["student_external_id"] for item in right_res.json()}
    return len(left_ids & right_ids)


def main() -> int:
    with httpx.Client(timeout=20.0) as client:
        admin_token = login(client, role="admin", username=ADMIN_USERNAME, password=ADMIN_PASSWORD)
        log("1. Logged in as admin")

        import_payload = {"term": IMPORT_TERM, "limit": 100}
        if IMPORT_CLASS_NAME:
            import_payload["class_name"] = IMPORT_CLASS_NAME
        if IMPORT_STUDENT_ID:
            import_payload["student_id"] = IMPORT_STUDENT_ID
        import_res = client.post(f"{BASE_URL}/admin/import", json=import_payload, headers=auth_headers(admin_token))
        assert_status(import_res, {200}, "import sections")
        log(f"2. Import sections OK: {import_res.json()}")

        terms_res = client.get(f"{BASE_URL}/admin/terms", headers=auth_headers(admin_token))
        assert_status(terms_res, {200}, "list terms")
        terms = terms_res.json()
        target_term = next((item for item in terms if item["term_name"] == IMPORT_TERM or item["term_code"] == IMPORT_TERM), None)
        if target_term is None:
            target_term = terms[0]
        term_id = target_term["id"]
        log(f"3. Using term {target_term['term_name']} ({term_id})")

        sections_res = client.get(f"{BASE_URL}/admin/terms/{term_id}/sections", headers=auth_headers(admin_token))
        assert_status(sections_res, {200}, "list sections by term")
        sections = sections_res.json()
        if len(sections) < 2:
            raise RuntimeError("Need at least 2 sections to run hard schedule tests")

        primary_section = sections[0]
        secondary_section = sections[1]
        tertiary_section = sections[2] if len(sections) > 2 else None
        log(f"4. Primary section {primary_section['section_code']}, secondary section {secondary_section['section_code']}")

        assign_primary_res = client.put(
            f"{BASE_URL}/admin/sections/{primary_section['id']}/teacher",
            json={"teacher_id": PRIMARY_TEACHER_ID},
            headers=auth_headers(admin_token),
        )
        assert_status(assign_primary_res, {200}, "assign teacher primary")
        log("5. Assigned teacher to primary section")

        assign_secondary_teacher_id = SECONDARY_TEACHER_ID or PRIMARY_TEACHER_ID
        assign_secondary_res = client.put(
            f"{BASE_URL}/admin/sections/{secondary_section['id']}/teacher",
            json={"teacher_id": assign_secondary_teacher_id},
            headers=auth_headers(admin_token),
        )
        assert_status(assign_secondary_res, {200}, "assign teacher secondary")
        log("6. Assigned teacher to secondary section")

        create_primary_res = client.post(
            f"{BASE_URL}/admin/sections/{primary_section['id']}/timetable",
            json=create_timetable_payload("A1.01"),
            headers=auth_headers(admin_token),
        )
        assert_status(create_primary_res, {201}, "create primary timetable")
        primary_entry = create_primary_res.json()
        log(f"7. Created timetable entry {primary_entry['id']} for primary section")

        teacher_conflict_res = client.post(
            f"{BASE_URL}/admin/sections/{secondary_section['id']}/timetable",
            json=create_timetable_payload("A1.02"),
            headers=auth_headers(admin_token),
        )
        if assign_secondary_teacher_id == PRIMARY_TEACHER_ID:
            assert_status(teacher_conflict_res, {409}, "teacher conflict")
            log("8. Teacher conflict returned 409 as expected")
        else:
            log("8. Teacher conflict skipped because secondary teacher differs from primary teacher")

        if SECONDARY_TEACHER_ID and SECONDARY_TEACHER_ID != PRIMARY_TEACHER_ID:
            room_conflict_res = client.post(
                f"{BASE_URL}/admin/sections/{secondary_section['id']}/timetable",
                json=create_timetable_payload("A1.01"),
                headers=auth_headers(admin_token),
            )
            assert_status(room_conflict_res, {409}, "room conflict")
            log("9. Room conflict returned 409 as expected")
        else:
            log("9. Room conflict skipped because SECONDARY_TEACHER_ID is not configured")

        if tertiary_section and TERTIARY_TEACHER_ID:
            assign_tertiary_res = client.put(
                f"{BASE_URL}/admin/sections/{tertiary_section['id']}/teacher",
                json={"teacher_id": TERTIARY_TEACHER_ID},
                headers=auth_headers(admin_token),
            )
            assert_status(assign_tertiary_res, {200}, "assign teacher tertiary")
            shared_students = overlap_count(client, admin_token, primary_section["id"], tertiary_section["id"])
            if shared_students > 0:
                student_conflict_res = client.post(
                    f"{BASE_URL}/admin/sections/{tertiary_section['id']}/timetable",
                    json=create_timetable_payload("A1.03"),
                    headers=auth_headers(admin_token),
                )
                assert_status(student_conflict_res, {409}, "student conflict")
                log(f"10. Student conflict returned 409 as expected with {shared_students} overlapping students")
            else:
                log("10. Student conflict skipped because no overlapping students were found")
        else:
            log("10. Student conflict skipped because tertiary section or TERTIARY_TEACHER_ID is missing")

        student_token = login(client, role="student", username=STUDENT_USERNAME, password=STUDENT_PASSWORD)
        student_timetable_res = client.get(
            f"{BASE_URL}/student/timetable",
            params={"term_id": term_id},
            headers=auth_headers(student_token),
        )
        assert_status(student_timetable_res, {200}, "student timetable")
        log(f"11. Student timetable OK, rows={len(student_timetable_res.json())}")

        teacher_token = login(client, role="teacher", username=TEACHER_USERNAME, password=TEACHER_PASSWORD)
        teacher_timetable_res = client.get(
            f"{BASE_URL}/teacher/timetable",
            params={"term_id": term_id},
            headers=auth_headers(teacher_token),
        )
        assert_status(teacher_timetable_res, {200}, "teacher timetable")
        log(f"12. Teacher timetable OK, rows={len(teacher_timetable_res.json())}")

        today_classes_res = client.get(f"{BASE_URL}/teacher/today-classes", headers=auth_headers(teacher_token))
        assert_status(today_classes_res, {200}, "teacher today classes")
        log(f"13. Teacher today classes OK, rows={len(today_classes_res.json())}")

        attendance_open_res = client.post(
            f"{BASE_URL}/teacher/timetable-entries/{primary_entry['id']}/attendance/open",
            headers=auth_headers(teacher_token),
        )
        if attendance_open_res.status_code == 200:
            log("14. Open attendance from timetable entry OK")
        else:
            log(f"14. Open attendance returned {attendance_open_res.status_code}: {attendance_open_res.text}")

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"[FAILED] {exc}", file=sys.stderr)
        raise
