from __future__ import annotations

import json
from collections import defaultdict
from copy import deepcopy
from pathlib import Path

from grade_logic import (
    build_course_grade,
    classify_academic_standing,
    extract_detailed_component_scores,
    get_term_sort_key,
    serialize_component_scores,
    serialize_detailed_component_scores,
    update_grade_weights,
    weighted_average,
)
import uuid
from json_store import load_runtime_state, save_runtime_state
from mock_data.schedule import SCHEDULE_DATA
from mock_data.notifications import NOTIFICATIONS_DATA


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data_json"

ADMIN_USERS = {
    "admin": {
        "password": "admin",
        "name": "Quản trị viên",
    }
}

TEACHER_USERS = {
    "gvungdung": {
        "password": "gvungdung",
        "name": "ThS. Nguyễn Hoàng Anh",
        "department": "Bộ môn Phát triển ứng dụng",
        "title": "Giảng viên chuyên ngành",
        "assignments": [
            {
                "course_code": "4203003443",
                "course_name": "Khai thác dữ liệu và ứng dụng",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203003501",
                "course_name": "Phát triển ứng dụng",
                "term": "HK2 (2025 - 2026)",
            },
        ],
    },
    "gvaiml": {
        "password": "gvaiml",
        "name": "TS. Trần Minh Quân",
        "department": "Bộ môn Trí tuệ nhân tạo",
        "title": "Giảng viên phụ trách AI/ML",
        "assignments": [
            {
                "course_code": "4203001545",
                "course_name": "Nhận dạng mẫu",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203003711",
                "course_name": "Máy học",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203004116",
                "course_name": "Học sâu",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203014115",
                "course_name": "Khai phá đồ thị",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203001146",
                "course_name": "Hệ cơ sở dữ liệu",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203002070",
                "course_name": "Lập trình hướng sự kiện với công nghệ Java",
                "term": "HK2 (2025 - 2026)",
            },
            {
                "course_code": "4203002117",
                "course_name": "Những vấn đề xã hội và nghề nghiệp",
                "term": "HK2 (2025 - 2026)",
            },
        ],
    },
}

ACCOUNT_METADATA = {
    "23630781": {
        "password": "23630781",
        "ngay_sinh": "04/09/2005",
        "gioi_tinh": "Nam",
        "khoa_hoc": "2023-2027",
        "trang_thai": "Đang học",
        "sdt": "0912360781",
        "dia_chi_thuong_tru": "Quận Gò Vấp, TP.HCM",
        "dia_chi_tam_tru": "Quận 12, TP.HCM",
    },
    "23630761": {
        "password": "23630761",
        "ngay_sinh": "12/03/2005",
        "gioi_tinh": "Nam",
        "khoa_hoc": "2023-2027",
        "trang_thai": "Đang học",
        "sdt": "0912360761",
        "dia_chi_thuong_tru": "TP. Biên Hòa, Đồng Nai",
        "dia_chi_tam_tru": "Quận Bình Thạnh, TP.HCM",
    },
}

DATA_FILES = [
    DATA_DIR / "thien_khmt_student_schema.json",
    DATA_DIR / "nghia_khdl_student_schema.json",
]

COURSE_TYPE_LABELS = {
    "mandatory": "Bắt buộc",
    "elective": "Tự chọn",
}

DEFAULT_CURRICULUM_SUMMARY = {
    "total_required_credits": 140,
    "mandatory_credits": 110,
    "elective_credits": 30,
    "note": "Dữ liệu sinh viên mới được khởi tạo trong hệ thống quản trị.",
}

SYSTEM_CONFIG = {
    "grading_weights": {
        "diem_qt": 0.2,
        "diem_gk": 0.3,
        "diem_ck": 0.5,
    }
}

RAW_STUDENT_DB: dict[str, dict] = {}
STUDENT_DB: dict[str, dict] = {}
SCHEDULE_DB: list[dict] = deepcopy(SCHEDULE_DATA)
NOTIFICATIONS_DB: list[dict] = deepcopy(NOTIFICATIONS_DATA)


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _persist_runtime_state() -> None:
    save_runtime_state(
        account_metadata=ACCOUNT_METADATA,
        raw_student_db=RAW_STUDENT_DB,
        system_config=SYSTEM_CONFIG,
        teacher_users=TEACHER_USERS,
        schedule_db=SCHEDULE_DB,
        notifications_db=NOTIFICATIONS_DB,
    )


def _normalize_course_status(raw_status: str | None, final_score: float | None) -> str:
    if raw_status == "Đạt":
        return "Đạt"
    if raw_status == "in_progress" or (raw_status is None and final_score is None):
        return "Đang học"
    if final_score is not None and final_score < 5:
        return "Rớt"
    return "Đạt"


def _normalize_curriculum_status(raw_status: str | None, final_score: float | None) -> str:
    normalized = _normalize_course_status(raw_status, final_score)
    if normalized == "Đạt":
        return "Hoàn thành"
    if normalized == "Rớt":
        return "Rớt"
    return "Đang học"


def _get_latest_completed_term(transcript_terms: list[dict]) -> dict | None:
    for term in reversed(transcript_terms):
        if term.get("gpa4_term") is not None:
            return term
    return transcript_terms[-1] if transcript_terms else None


def _get_metadata(mssv: str) -> dict:
    return ACCOUNT_METADATA.setdefault(
        mssv,
        {
            "password": mssv,
            "ngay_sinh": "01/01/2000",
            "gioi_tinh": "Nam",
            "khoa_hoc": "2024-2028",
            "trang_thai": "Đang học",
            "sdt": "",
            "dia_chi_thuong_tru": "",
            "dia_chi_tam_tru": "",
        },
    )


def _build_student_payload(record: dict) -> dict:
    student = record["student"]
    transcript_terms = record["transcript_terms"]
    latest_completed = _get_latest_completed_term(transcript_terms) or {}
    metadata = _get_metadata(student["student_id"])

    return {
        "mssv": student["student_id"],
        "ho_ten": student["full_name"],
        "ngay_sinh": metadata["ngay_sinh"],
        "gioi_tinh": metadata["gioi_tinh"],
        "lop": student["class_name"],
        "khoa": student["faculty"],
        "nganh": student["program_name"],
        "chuyen_nganh": student["program_name"],
        "program_name": student["program_name"],
        "education_level": student["education_level"],
        "khoa_hoc": metadata["khoa_hoc"],
        "trang_thai": metadata["trang_thai"],
        "email": f'{student["student_id"]}@sv.iuh.edu.vn',
        "sdt": metadata["sdt"],
        "dia_chi_thuong_tru": metadata["dia_chi_thuong_tru"],
        "dia_chi_tam_tru": metadata["dia_chi_tam_tru"],
        "gpa_tich_luy": latest_completed.get("gpa4_cumulative"),
        "xep_loai": latest_completed.get("academic_standing_cumulative"),
        "tc_hoan_thanh": latest_completed.get("earned_credits", 0),
        "tc_tong": record["curriculum_summary"]["total_required_credits"],
        "avatar_url": None,
    }


def _build_grades_by_term(record: dict) -> dict[str, dict]:
    term_meta = {term["term"]: term for term in record["transcript_terms"]}
    grouped_courses: dict[str, list[dict]] = defaultdict(list)

    for course in record["transcript_courses"]:
        grouped_courses[course["term"]].append(course)

    grades_by_term: dict[str, dict] = {}
    for term in record["transcript_terms"]:
        term_label = term["term"]
        courses = grouped_courses.get(term_label, [])
        grades_by_term[term_label] = {
            "hoc_ky": term_label,
            "gpa_hoc_ky": term_meta[term_label].get("gpa4_term") or 0,
            "mon_hoc": [
                {
                    "stt": index,
                    "ma_mon": course["class_section_code"][:10],
                    "class_section_code": course["class_section_code"],
                    "ten_mon": course["course_name"],
                    "tc": course["credits"],
                    **extract_detailed_component_scores(
                        course.get("component_scores"),
                        course.get("midterm_scores"),
                    ),
                    "diem_tk_10": course.get("final_score"),
                    "diem_tk_4": course.get("gpa4"),
                    "xep_loai": course.get("letter") or "-",
                    "xep_loai_chi_tiet": course.get("classification"),
                    "trang_thai": _normalize_course_status(
                        course.get("status"),
                        course.get("final_score"),
                    ),
                }
                for index, course in enumerate(courses, start=1)
            ],
        }

    return grades_by_term


def _build_previous_term_chart(record: dict) -> dict:
    latest_completed = _get_latest_completed_term(record["transcript_terms"])
    if not latest_completed:
        return {"term": None, "gpa_hoc_ky": None, "courses": []}

    term_label = latest_completed["term"]
    courses = []
    for course in record["transcript_courses"]:
        if course["term"] != term_label or course.get("gpa4") is None:
            continue
        courses.append(
            {
                "course_name": course["course_name"],
                "course_code": course["class_section_code"][:10],
                "credits": course["credits"],
                "gpa4": course["gpa4"],
                "final_score": course.get("final_score"),
                "letter": course.get("letter"),
            }
        )

    return {
        "term": term_label,
        "gpa_hoc_ky": latest_completed.get("gpa4_term"),
        "courses": courses,
    }


def _build_grades_summary(record: dict) -> dict:
    transcript_terms = record["transcript_terms"]
    latest_completed = _get_latest_completed_term(transcript_terms) or {}
    current_term = transcript_terms[-1] if transcript_terms else {}
    tc_dang_hoc = max(
        (current_term.get("registered_credits") or 0) - (current_term.get("earned_credits") or 0),
        0,
    )
    tc_con_lai = max(
        record["curriculum_summary"]["total_required_credits"]
        - (latest_completed.get("earned_credits") or 0)
        - tc_dang_hoc,
        0,
    )

    return {
        "gpa_tich_luy": latest_completed.get("gpa4_cumulative"),
        "xep_loai": latest_completed.get("academic_standing_cumulative"),
        "tc_dat": latest_completed.get("earned_credits", 0),
        "tc_dang_hoc": tc_dang_hoc,
        "tc_con_lai": tc_con_lai,
        "tc_rot": latest_completed.get("outstanding_failed_credits", 0),
        "tc_tong": record["curriculum_summary"]["total_required_credits"],
        "semesters": [term["term"] for term in transcript_terms],
        "current_term": current_term.get("term"),
        "latest_completed_term": latest_completed.get("term"),
        "previous_term_chart": _build_previous_term_chart(record),
        "gpa_history": [
            {
                "term": term["term"],
                "gpa4_term": term.get("gpa4_term", 0) or 0,
                "gpa4_cumulative": term.get("gpa4_cumulative", 0) or 0,
            }
            for term in transcript_terms
            if term.get("gpa4_term") is not None
        ],
    }


def _build_curriculum_payload(record: dict, student_payload: dict) -> dict:
    transcript_courses_by_code: dict[str, list[dict]] = defaultdict(list)
    for course in record["transcript_courses"]:
        transcript_courses_by_code[course["class_section_code"][:10]].append(course)

    grouped_semesters: dict[int, list[dict]] = defaultdict(list)
    for course in record["curriculum_courses"]:
        matching_transcript = transcript_courses_by_code.get(course["course_code"], [])
        latest_match = matching_transcript[-1] if matching_transcript else None

        if latest_match:
            status = _normalize_curriculum_status(
                latest_match.get("status"),
                latest_match.get("final_score"),
            )
            diem = latest_match.get("letter") or "-"
        elif course.get("passed_in_curriculum"):
            status = "Hoàn thành"
            diem = "-"
        else:
            status = "Chưa học"
            diem = "-"

        grouped_semesters[course["semester"]].append(
            {
                "ma_mon": course["course_code"],
                "ten_mon": course["course_name"],
                "tc": course["credits"],
                "loai": COURSE_TYPE_LABELS.get(course["course_type"], "Khác"),
                "trang_thai": status,
                "diem": diem,
                "mien_gpa": bool(course.get("is_excluded_from_gpa")),
            }
        )

    semesters = []
    for semester_number in sorted(grouped_semesters):
        courses = grouped_semesters[semester_number]
        semesters.append(
            {
                "hoc_ky": f"Học kỳ {semester_number}",
                "tong_tc": sum(course["tc"] for course in courses),
                "tc_hoan_thanh": sum(
                    course["tc"] for course in courses if course["trang_thai"] == "Hoàn thành"
                ),
                "mon_hoc": courses,
            }
        )

    return {
        "student": {
            "mssv": student_payload["mssv"],
            "ho_ten": student_payload["ho_ten"],
            "program_name": student_payload["program_name"],
        },
        "summary": record["curriculum_summary"],
        "semesters": semesters,
    }


def _build_public_record(raw_record: dict) -> dict:
    student_payload = _build_student_payload(raw_record)
    return {
        "student": student_payload,
        "grades": _build_grades_by_term(raw_record),
        "grades_summary": _build_grades_summary(raw_record),
        "curriculum": _build_curriculum_payload(raw_record, student_payload),
    }


def _load_initial_raw_records() -> dict[str, dict]:
    records: dict[str, dict] = {}
    for data_file in DATA_FILES:
        raw = _load_json(data_file)
        records[raw["student"]["student_id"]] = raw
    return records


def _load_runtime_overrides(raw_records: dict[str, dict]) -> None:
    runtime_state = load_runtime_state()
    if not runtime_state:
        update_grade_weights(SYSTEM_CONFIG["grading_weights"])
        return

    account_metadata = runtime_state.get("account_metadata") or {}
    raw_student_db = runtime_state.get("raw_student_db") or {}
    sys_conf = runtime_state.get("system_config") or {}
    teacher_users = runtime_state.get("teacher_users") or {}
    schedule_db = runtime_state.get("schedule_db")
    notifications_db = runtime_state.get("notifications_db")

    if sys_conf:
        SYSTEM_CONFIG.update(sys_conf)
    
    update_grade_weights(SYSTEM_CONFIG.get("grading_weights", {}))

    if isinstance(account_metadata, dict):
        ACCOUNT_METADATA.update(account_metadata)

    if isinstance(teacher_users, dict) and teacher_users:
        TEACHER_USERS.update(teacher_users)

    if isinstance(raw_student_db, dict):
        for mssv, raw_record in raw_student_db.items():
            raw_records[mssv] = raw_record
            
    if schedule_db is not None:
        global SCHEDULE_DB
        SCHEDULE_DB = schedule_db

    if notifications_db is not None:
        global NOTIFICATIONS_DB
        NOTIFICATIONS_DB = notifications_db


def _rebuild_student_record(mssv: str) -> None:
    raw_record = RAW_STUDENT_DB[mssv]
    STUDENT_DB[mssv] = _build_public_record(raw_record)


def _ensure_loaded() -> None:
    global RAW_STUDENT_DB, STUDENT_DB
    if RAW_STUDENT_DB and STUDENT_DB:
        return

    RAW_STUDENT_DB = _load_initial_raw_records()
    _load_runtime_overrides(RAW_STUDENT_DB)
    STUDENT_DB = {
        mssv: _build_public_record(raw_record)
        for mssv, raw_record in RAW_STUDENT_DB.items()
    }


def _get_course_exclusion_map(raw_record: dict) -> dict[str, bool]:
    return {
        course["course_code"]: bool(course.get("is_excluded_from_gpa"))
        for course in raw_record["curriculum_courses"]
    }


def _recalculate_transcript_terms(raw_record: dict) -> None:
    transcript_courses = raw_record["transcript_courses"]
    course_exclusions = _get_course_exclusion_map(raw_record)
    term_order = [term["term"] for term in raw_record["transcript_terms"]]

    grouped_courses: dict[str, list[dict]] = defaultdict(list)
    for course in transcript_courses:
        grouped_courses[course["term"]].append(course)

    cumulative_10: list[tuple[float, int]] = []
    cumulative_4: list[tuple[float, int]] = []
    updated_terms: list[dict] = []

    for term in term_order:
        courses = grouped_courses.get(term, [])
        registered_credits = sum(course["credits"] for course in courses)
        earned_credits = sum(
            course["credits"]
            for course in courses
            if course.get("final_score") is not None and course["final_score"] >= 5
        )
        failed_credits = sum(
            course["credits"]
            for course in courses
            if course.get("final_score") is not None and course["final_score"] < 5
        )

        eligible_courses = [
            course
            for course in courses
            if not course_exclusions.get(course["class_section_code"][:10], False)
        ]
        completed_eligible_courses = [
            course
            for course in eligible_courses
            if course.get("final_score") is not None and course.get("gpa4") is not None
        ]

        term_is_completed = (
            bool(eligible_courses)
            and len(completed_eligible_courses) == len(eligible_courses)
        )

        gpa10_term = None
        gpa4_term = None
        if term_is_completed:
            gpa10_term = weighted_average(
                (course["final_score"], course["credits"])
                for course in completed_eligible_courses
            )
            gpa4_term = weighted_average(
                (course["gpa4"], course["credits"])
                for course in completed_eligible_courses
            )

        cumulative_10.extend(
            (course["final_score"], course["credits"])
            for course in completed_eligible_courses
        )
        cumulative_4.extend(
            (course["gpa4"], course["credits"])
            for course in completed_eligible_courses
        )

        gpa10_cumulative = weighted_average(cumulative_10) or 0.0
        gpa4_cumulative = weighted_average(cumulative_4) or 0.0

        updated_terms.append(
            {
                "term": term,
                "gpa10_term": gpa10_term,
                "gpa4_term": gpa4_term,
                "gpa10_cumulative": gpa10_cumulative,
                "gpa4_cumulative": gpa4_cumulative,
                "registered_credits": registered_credits,
                "earned_credits": earned_credits,
                "passed_credits": earned_credits,
                "outstanding_failed_credits": failed_credits,
                "academic_standing_cumulative": (
                    classify_academic_standing(gpa4_cumulative) or "Chưa xếp loại"
                ),
                "academic_standing_term": classify_academic_standing(gpa4_term),
            }
        )

    raw_record["transcript_terms"] = updated_terms


def get_student_records() -> dict[str, dict]:
    _ensure_loaded()
    return STUDENT_DB


def get_raw_student_payload(mssv: str) -> dict | None:
    _ensure_loaded()
    return RAW_STUDENT_DB.get(mssv)


def get_available_accounts() -> list[dict]:
    _ensure_loaded()
    accounts = []
    for mssv, meta in ACCOUNT_METADATA.items():
        db_student = STUDENT_DB.get(mssv)
        ho_ten = db_student["student"]["ho_ten"] if db_student else "Tài khoản sinh viên mới"
        accounts.append(
            {
                "mssv": mssv,
                "ho_ten": ho_ten,
                "password": meta["password"],
                "ngay_sinh": meta["ngay_sinh"],
                "sdt": meta.get("sdt", ""),
            }
        )
    return accounts


def get_available_teacher_accounts() -> list[dict]:
    return [
        {
            "username": username,
            "password": teacher["password"],
            "name": teacher["name"],
            "department": teacher["department"],
            "courses": [assignment["course_name"] for assignment in teacher["assignments"]],
        }
        for username, teacher in TEACHER_USERS.items()
    ]


def validate_admin_login(username: str, password: str):
    user = ADMIN_USERS.get(username)
    if user and user["password"] == password:
        return user
    return None


def validate_teacher_login(username: str, password: str):
    teacher = TEACHER_USERS.get(username)
    if teacher and teacher["password"] == password:
        return {
            "username": username,
            "name": teacher["name"],
            "department": teacher["department"],
            "title": teacher["title"],
            "assigned_courses": len(teacher["assignments"]),
        }
    return None


def get_all_students_for_admin():
    _ensure_loaded()
    result = []
    for mssv, meta in ACCOUNT_METADATA.items():
        stu = STUDENT_DB.get(mssv)
        name = stu["student"]["ho_ten"] if stu else "Tài khoản sinh viên mới"
        result.append(
            {
                "mssv": mssv,
                "ho_ten": name,
                "trang_thai": meta.get("trang_thai", "Đang học"),
                "ngay_sinh": meta.get("ngay_sinh", ""),
            }
        )
    return result


def add_new_student(mssv, password, ho_ten="Sinh viên mới", ngay_sinh="01/01/2000"):
    _ensure_loaded()
    if mssv in ACCOUNT_METADATA:
        return False, "MSSV đã tồn tại"

    ACCOUNT_METADATA[mssv] = {
        "password": password,
        "ngay_sinh": ngay_sinh,
        "gioi_tinh": "Nam",
        "khoa_hoc": "2024-2028",
        "trang_thai": "Đang học",
        "sdt": "",
        "dia_chi_thuong_tru": "",
        "dia_chi_tam_tru": "",
    }

    RAW_STUDENT_DB[mssv] = {
        "schema_version": "1.0",
        "student": {
            "student_id": mssv,
            "full_name": ho_ten,
            "class_name": "DHTH00A",
            "program_name": "Ngành mặc định",
            "faculty": "Khoa Công nghệ Thông tin",
            "education_level": "Đại học",
            "print_date": "2026-04-10",
        },
        "curriculum_summary": deepcopy(DEFAULT_CURRICULUM_SUMMARY),
        "curriculum_courses": [],
        "transcript_terms": [],
        "transcript_courses": [],
    }
    _rebuild_student_record(mssv)
    _persist_runtime_state()
    return True, "Tạo sinh viên thành công"


def change_student_password(mssv, new_password):
    _ensure_loaded()
    if mssv not in ACCOUNT_METADATA:
        return False, "Không tìm thấy sinh viên"
    ACCOUNT_METADATA[mssv]["password"] = new_password
    _persist_runtime_state()
    return True, "Đổi mật khẩu thành công"


def get_all_teachers_for_admin():
    _ensure_loaded()
    return [
        {
            "username": username,
            "name": teacher["name"],
            "department": teacher.get("department", ""),
            "title": teacher.get("title", ""),
            "assignments_count": len(teacher.get("assignments", [])),
        }
        for username, teacher in TEACHER_USERS.items()
    ]


def add_new_teacher(username, password, name, department, title):
    _ensure_loaded()
    if username in TEACHER_USERS:
        return False, "Tài khoản giảng viên đã tồn tại"

    TEACHER_USERS[username] = {
        "password": password,
        "name": name,
        "department": department,
        "title": title,
        "assignments": [],
    }
    _persist_runtime_state()
    return True, "Thêm giảng viên thành công"


def change_teacher_password(username, new_password):
    _ensure_loaded()
    if username not in TEACHER_USERS:
        return False, "Không tìm thấy giảng viên"
    TEACHER_USERS[username]["password"] = new_password
    _persist_runtime_state()
    return True, "Đổi mật khẩu giảng viên thành công"


def get_current_system_config():
    _ensure_loaded()
    return SYSTEM_CONFIG


def update_system_config(new_config):
    _ensure_loaded()
    SYSTEM_CONFIG.update(new_config)
    update_grade_weights(SYSTEM_CONFIG.get("grading_weights", {}))
    _persist_runtime_state()
    return True, "Cập nhật cấu hình thành công"


def get_student_record(mssv: str | None) -> dict:
    records = get_student_records()
    if mssv and mssv in records:
        return records[mssv]
    return next(iter(records.values()))


def validate_student_login(mssv: str, password: str) -> dict | None:
    records = get_student_records()
    if mssv not in records:
        return None
    if ACCOUNT_METADATA[mssv]["password"] != password:
        return None
    return records[mssv]["student"]


def validate_parent_login(ho_ten: str, mssv: str, ngay_sinh: str, sdt: str) -> dict | None:
    records = get_student_records()
    if mssv not in records:
        return None

    student = records[mssv]["student"]
    if (
        ho_ten.strip().lower() == student["ho_ten"].lower()
        and ngay_sinh == student["ngay_sinh"]
        and sdt == student["sdt"]
    ):
        return student

    return None


def _get_teacher_assignments(username: str) -> list[dict]:
    teacher = TEACHER_USERS.get(username)
    if not teacher:
        raise ValueError("Giảng viên không tồn tại.")
    return teacher["assignments"]


def _get_assignment(username: str, course_code: str, term: str) -> dict | None:
    for assignment in _get_teacher_assignments(username):
        if assignment["course_code"] == course_code and assignment["term"] == term:
            return assignment
    return None


def _get_teacher_course_rows(username: str, course_code: str | None = None, term: str | None = None) -> list[dict]:
    _ensure_loaded()
    assignments = _get_teacher_assignments(username)
    allowed_keys = {
        (assignment["course_code"], assignment["term"]): assignment
        for assignment in assignments
    }

    rows: list[dict] = []
    for mssv, raw_record in RAW_STUDENT_DB.items():
        public_student = STUDENT_DB[mssv]["student"]
        for course in raw_record["transcript_courses"]:
            current_course_code = course["class_section_code"][:10]
            current_term = course["term"]
            if (current_course_code, current_term) not in allowed_keys:
                continue
            if course_code and current_course_code != course_code:
                continue
            if term and current_term != term:
                continue

            scores = extract_detailed_component_scores(
                course.get("component_scores"),
                course.get("midterm_scores"),
            )
            rows.append(
                {
                    "mssv": public_student["mssv"],
                    "ho_ten": public_student["ho_ten"],
                    "lop": public_student["lop"],
                    "nganh": public_student["nganh"],
                    "term": current_term,
                    "course_code": current_course_code,
                    "class_section_code": course["class_section_code"],
                    "course_name": course["course_name"],
                    "credits": course["credits"],
                    "diem_thuong_ky_1": scores["diem_thuong_ky_1"],
                    "diem_thuong_ky_2": scores["diem_thuong_ky_2"],
                    "diem_thuc_hanh_1": scores["diem_thuc_hanh_1"],
                    "diem_thuc_hanh_2": scores["diem_thuc_hanh_2"],
                    "diem_qt": scores["diem_qt"],
                    "diem_gk": scores["diem_gk"],
                    "diem_ck": scores["diem_ck"],
                    "diem_tk_10": course.get("final_score"),
                    "diem_tk_4": course.get("gpa4"),
                    "xep_loai": course.get("letter"),
                    "xep_loai_chi_tiet": course.get("classification"),
                    "trang_thai": _normalize_course_status(
                        course.get("status"),
                        course.get("final_score"),
                    ),
                }
            )

    rows.sort(key=lambda item: (get_term_sort_key(item["term"]), item["course_code"], item["mssv"]))
    return rows


def get_teacher_overview(username: str) -> dict:
    rows = _get_teacher_course_rows(username)
    unique_students = {row["mssv"] for row in rows}
    graded_count = sum(1 for row in rows if row["diem_tk_10"] is not None)
    pending_count = len(rows) - graded_count

    return {
        "teacher": validate_teacher_login(username, TEACHER_USERS[username]["password"]),
        "summary": {
            "assigned_courses": len(_get_teacher_assignments(username)),
            "managed_students": len(unique_students),
            "graded_entries": graded_count,
            "pending_entries": pending_count,
        },
    }


def get_teacher_courses(username: str) -> list[dict]:
    assignments = _get_teacher_assignments(username)
    rows = _get_teacher_course_rows(username)

    grouped_rows: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in rows:
        grouped_rows[(row["course_code"], row["term"])].append(row)

    course_cards: list[dict] = []
    for assignment in assignments:
        key = (assignment["course_code"], assignment["term"])
        course_rows = grouped_rows.get(key, [])
        final_scores = [row["diem_tk_10"] for row in course_rows if row["diem_tk_10"] is not None]
        course_cards.append(
            {
                "course_code": assignment["course_code"],
                "course_name": assignment["course_name"],
                "term": assignment["term"],
                "student_count": len(course_rows),
                "graded_count": len(final_scores),
                "pending_count": len(course_rows) - len(final_scores),
                "average_score": round(sum(final_scores) / len(final_scores), 2) if final_scores else None,
            }
        )

    course_cards.sort(key=lambda item: (get_term_sort_key(item["term"]), item["course_code"]))
    return course_cards


def get_teacher_course_students(username: str, course_code: str, term: str) -> dict:
    assignment = _get_assignment(username, course_code, term)
    if not assignment:
        raise ValueError("Giảng viên không được phân công môn học này.")

    students = _get_teacher_course_rows(username, course_code=course_code, term=term)
    return {
        "course": {
            "course_code": assignment["course_code"],
            "course_name": assignment["course_name"],
            "term": assignment["term"],
        },
        "students": students,
    }


def _find_transcript_course(
    working_payload: dict,
    *,
    term: str,
    course_code: str,
    class_section_code: str | None = None,
) -> dict:
    matches = [
        course
        for course in working_payload["transcript_courses"]
        if course["term"] == term and course["class_section_code"][:10] == course_code
    ]

    if class_section_code:
        matches = [
            course
            for course in matches
            if course["class_section_code"] == class_section_code
        ]

    if not matches:
        raise ValueError("Khong tim thay hoc phan can cap nhat diem.")
    if len(matches) > 1:
        raise ValueError(
            "Tim thay nhieu lop hoc phan trung ma mon. Vui long bo sung class_section_code trong file CSV."
        )
    return matches[0]


def _apply_grade_payload_to_course(target_course: dict, grade_payload: dict) -> None:
    target_course.update(
        {
            "final_score": grade_payload["final_score"],
            "gpa4": grade_payload["gpa4"],
            "letter": grade_payload["letter"],
            "classification": grade_payload["classification"],
            "status": grade_payload["status"],
            "midterm_scores": serialize_component_scores(grade_payload),
            "component_scores": serialize_detailed_component_scores(grade_payload),
        }
    )


def update_teacher_student_grade(
    *,
    username: str,
    mssv: str,
    term: str,
    class_section_code: str,
    diem_thuong_ky_1: float | None,
    diem_thuong_ky_2: float | None,
    diem_thuc_hanh_1: float | None,
    diem_thuc_hanh_2: float | None,
    diem_qt: float | None,
    diem_gk: float | None,
    diem_ck: float | None,
) -> dict:
    course_code = class_section_code[:10]
    assignment = _get_assignment(username, course_code, term)
    if not assignment:
        raise ValueError("Giảng viên không được phép chỉnh sửa môn học này.")

    raw_payload = get_raw_student_payload(mssv)
    if not raw_payload:
        raise ValueError("Không tìm thấy sinh viên.")

    working_payload = deepcopy(raw_payload)
    target_course = _find_transcript_course(
        working_payload,
        term=term,
        course_code=course_code,
        class_section_code=class_section_code,
    )

    grade_payload = build_course_grade(
        {
            "diem_thuong_ky_1": diem_thuong_ky_1,
            "diem_thuong_ky_2": diem_thuong_ky_2,
            "diem_thuc_hanh_1": diem_thuc_hanh_1,
            "diem_thuc_hanh_2": diem_thuc_hanh_2,
            "diem_qt": diem_qt,
            "diem_gk": diem_gk,
            "diem_ck": diem_ck,
        }
    )
    _apply_grade_payload_to_course(target_course, grade_payload)
    _recalculate_transcript_terms(working_payload)

    RAW_STUDENT_DB[mssv] = working_payload
    _rebuild_student_record(mssv)
    _persist_runtime_state()

    return {
        "student": STUDENT_DB[mssv]["student"],
        "course": {
            "course_code": course_code,
            "class_section_code": class_section_code,
            "course_name": assignment["course_name"],
            "term": term,
            **grade_payload,
        },
        "grades_summary": STUDENT_DB[mssv]["grades_summary"],
    }


def import_teacher_course_grades(
    *,
    username: str,
    course_code: str,
    term: str,
    rows: list[dict],
) -> dict:
    assignment = _get_assignment(username, course_code, term)
    if not assignment:
        raise ValueError("Giảng viên không được phân công môn học này.")
    if not rows:
        raise ValueError("File CSV không có dòng dữ liệu hợp lệ.")

    imported_count = 0
    errors: list[dict] = []
    updated_students: set[str] = set()

    for index, row in enumerate(rows, start=1):
        row_number = row.get("row_number") or index + 1
        mssv = str(row.get("mssv") or "").strip()
        if not mssv:
            errors.append(
                {
                    "row_number": row_number,
                    "message": "Thiếu MSSV.",
                }
            )
            continue

        raw_payload = get_raw_student_payload(mssv)
        if not raw_payload:
            errors.append(
                {
                    "row_number": row_number,
                    "mssv": mssv,
                    "message": "Không tìm thấy sinh viên trong hệ thống.",
                }
            )
            continue

        working_payload = deepcopy(raw_payload)

        try:
            target_course = _find_transcript_course(
                working_payload,
                term=term,
                course_code=course_code,
                class_section_code=row.get("class_section_code"),
            )
            grade_payload = build_course_grade(
                {
                    "diem_thuong_ky_1": row.get("diem_thuong_ky_1"),
                    "diem_thuong_ky_2": row.get("diem_thuong_ky_2"),
                    "diem_thuc_hanh_1": row.get("diem_thuc_hanh_1"),
                    "diem_thuc_hanh_2": row.get("diem_thuc_hanh_2"),
                    "diem_qt": row.get("diem_qt"),
                    "diem_gk": row.get("diem_gk"),
                    "diem_ck": row.get("diem_ck"),
                }
            )
            _apply_grade_payload_to_course(target_course, grade_payload)
            _recalculate_transcript_terms(working_payload)
        except ValueError as exc:
            errors.append(
                {
                    "row_number": row_number,
                    "mssv": mssv,
                    "message": str(exc),
                }
            )
            continue

        RAW_STUDENT_DB[mssv] = working_payload
        _rebuild_student_record(mssv)
        updated_students.add(mssv)
        imported_count += 1

    if imported_count:
        _persist_runtime_state()

    return {
        "course": {
            "course_code": assignment["course_code"],
            "course_name": assignment["course_name"],
            "term": assignment["term"],
        },
        "imported_count": imported_count,
        "error_count": len(errors),
        "updated_students": sorted(updated_students),
        "errors": errors[:20],
    }


def get_teacher_assignments_admin(username: str) -> list[dict]:
    _ensure_loaded()
    teacher = TEACHER_USERS.get(username)
    if not teacher:
        return []
    return teacher.get("assignments", [])


def assign_course_to_teacher(username: str, course_code: str, course_name: str, term: str) -> tuple[bool, str]:
    _ensure_loaded()
    teacher = TEACHER_USERS.get(username)
    if not teacher:
        return False, "Không tìm thấy giảng viên."

    for assignment in teacher.get("assignments", []):
        if assignment["course_code"] == course_code and assignment["term"] == term:
            return False, "Giảng viên đã được phân công lớp học phần này."

    teacher.setdefault("assignments", []).append({
        "course_code": course_code,
        "course_name": course_name,
        "term": term,
    })
    _persist_runtime_state()
    return True, "Phân công thành công."


def remove_course_from_teacher(username: str, course_code: str, term: str) -> tuple[bool, str]:
    _ensure_loaded()
    teacher = TEACHER_USERS.get(username)
    if not teacher:
        return False, "Không tìm thấy giảng viên."

    assignments = teacher.get("assignments", [])
    original_count = len(assignments)
    teacher["assignments"] = [
        a for a in assignments
        if not (a["course_code"] == course_code and a["term"] == term)
    ]

    if len(teacher["assignments"]) == original_count:
        return False, "Không tìm thấy phân công lớp này."

    _persist_runtime_state()
    return True, "Hủy phân công lớp thành công."


# --- CÁC HÀM QUẢN LÝ SINH VIÊN MỞ RỘNG (PROFILE, BULK, DELETE) ---

def update_student_profile(mssv: str, data: dict) -> tuple[bool, str]:
    _ensure_loaded()
    if mssv not in ACCOUNT_METADATA:
        return False, "Không tìm thấy sinh viên"
    
    # Update Metadata
    ACCOUNT_METADATA[mssv].update({
        "ngay_sinh": data.get("ngay_sinh", ACCOUNT_METADATA[mssv].get("ngay_sinh")),
        "gioi_tinh": data.get("gioi_tinh", ACCOUNT_METADATA[mssv].get("gioi_tinh")),
        "trang_thai": data.get("trang_thai", ACCOUNT_METADATA[mssv].get("trang_thai")),
    })

    # Update RAW DB
    raw = RAW_STUDENT_DB[mssv]
    raw["student"].update({
        "full_name": data.get("ho_ten", raw["student"]["full_name"]),
        "class_name": data.get("lop", raw["student"]["class_name"]),
        "faculty": data.get("khoa", raw["student"]["faculty"]),
        "program_name": data.get("nganh", raw["student"]["program_name"]),
    })

    _rebuild_student_record(mssv)
    _persist_runtime_state()
    return True, "Cập nhật hồ sơ sinh viên thành công."

def delete_student_profile(mssv: str) -> tuple[bool, str]:
    _ensure_loaded()
    if mssv not in ACCOUNT_METADATA:
        return False, "Không tìm thấy sinh viên"
    
    ACCOUNT_METADATA[mssv]["trang_thai"] = "Đã thôi học / Xóa"
    _rebuild_student_record(mssv)
    _persist_runtime_state()
    return True, "Đã khoá / xoá mềm tài khoản sinh viên."

def bulk_add_students(students: list[dict]) -> tuple[bool, str]:
    _ensure_loaded()
    count = 0
    for st in students:
        mssv = st.get("mssv", "").strip()
        if not mssv or mssv in ACCOUNT_METADATA:
            continue
        
        ACCOUNT_METADATA[mssv] = {
            "password": st.get("password") or st.get("mssv"),
            "ngay_sinh": st.get("ngay_sinh", "01/01/2000"),
            "gioi_tinh": st.get("gioi_tinh", "Nam"),
            "khoa_hoc": st.get("khoa_hoc", "2024-2028"),
            "trang_thai": "Đang học",
            "sdt": "",
            "dia_chi_thuong_tru": "",
            "dia_chi_tam_tru": "",
        }

        RAW_STUDENT_DB[mssv] = {
            "schema_version": "1.0",
            "student": {
                "student_id": mssv,
                "full_name": st.get("ho_ten", "Sinh viên mới"),
                "class_name": st.get("lop", "Lớp tự do"),
                "program_name": st.get("nganh", "Ngành mặc định"),
                "faculty": st.get("khoa", "Khoa CNTT"),
                "education_level": "Đại học",
                "print_date": "2026-04-10",
            },
            "curriculum_summary": deepcopy(DEFAULT_CURRICULUM_SUMMARY),
            "curriculum_courses": [],
            "transcript_terms": [],
            "transcript_courses": [],
        }
        _rebuild_student_record(mssv)
        count += 1
        
    _persist_runtime_state()
    return True, f"Nhập thành công {count} sinh viên."

# --- CÁC HÀM QUẢN LÝ GIẢNG VIÊN MỞ RỘNG (PROFILE, BULK, DELETE) ---

def update_teacher_profile(username: str, data: dict) -> tuple[bool, str]:
    _ensure_loaded()
    if username not in TEACHER_USERS:
        return False, "Không tìm thấy giảng viên"
    
    teacher = TEACHER_USERS[username]
    teacher["name"] = data.get("name", teacher.get("name"))
    teacher["department"] = data.get("department", teacher.get("department"))
    teacher["title"] = data.get("title", teacher.get("title"))
    
    _persist_runtime_state()
    return True, "Cập nhật giảng viên thành công."

def delete_teacher_profile(username: str) -> tuple[bool, str]:
    _ensure_loaded()
    if username not in TEACHER_USERS:
        return False, "Không tìm thấy giảng viên"
    # Xoá cứng giảng viên
    del TEACHER_USERS[username]
    _persist_runtime_state()
    return True, "Xóa tài khoản giảng viên thành công."

def bulk_add_teachers(teachers: list[dict]) -> tuple[bool, str]:
    _ensure_loaded()
    count = 0
    for t in teachers:
        username = t.get("username", "").strip()
        if not username or username in TEACHER_USERS:
            continue
            
        TEACHER_USERS[username] = {
            "password": t.get("password") or t.get("username"),
            "name": t.get("name", "Giảng viên"),
            "department": t.get("department", "Bộ môn chung"),
            "title": t.get("title", "Giảng viên"),
            "assignments": [],
        }
        count += 1
    
    _persist_runtime_state()
    return True, f"Nhập thành công {count} giảng viên."


# --- THỜI KHÓA BIỂU CRUD ---
def get_all_schedule_admin() -> list[dict]:
    _ensure_loaded()
    return SCHEDULE_DB

def add_schedule_item(data: dict) -> tuple[bool, str]:
    _ensure_loaded()
    new_id = data.get("id") or str(uuid.uuid4())
    data["id"] = new_id
    SCHEDULE_DB.append(data)
    _persist_runtime_state()
    return True, "Thêm lớp học phần thành công."

def update_schedule_item(item_id: str, data: dict) -> tuple[bool, str]:
    _ensure_loaded()
    for item in SCHEDULE_DB:
        if str(item.get("id")) == str(item_id):
            item.update(data)
            _persist_runtime_state()
            return True, "Cập nhật thời khóa biểu thành công."
    return False, "Không tìm thấy lớp học phần."

def delete_schedule_item(item_id: str) -> tuple[bool, str]:
    _ensure_loaded()
    global SCHEDULE_DB
    original_len = len(SCHEDULE_DB)
    SCHEDULE_DB = [item for item in SCHEDULE_DB if str(item.get("id")) != str(item_id)]
    
    if len(SCHEDULE_DB) < original_len:
        _persist_runtime_state()
        return True, "Xóa lớp học phần thành công."
    return False, "Không tìm thấy lớp học phần."


# --- THÔNG BÁO CRUD ---
def get_all_notifications_admin() -> list[dict]:
    _ensure_loaded()
    return NOTIFICATIONS_DB

def add_notification_admin(data: dict) -> tuple[bool, str]:
    _ensure_loaded()
    new_id = data.get("id") or str(uuid.uuid4())
    data["id"] = new_id
    NOTIFICATIONS_DB.insert(0, data)
    _persist_runtime_state()
    return True, "Đăng thông báo thành công."

def update_notification_admin(item_id: str, data: dict) -> tuple[bool, str]:
    _ensure_loaded()
    for item in NOTIFICATIONS_DB:
        if str(item.get("id")) == str(item_id):
            item.update(data)
            _persist_runtime_state()
            return True, "Sửa thông báo thành công."
    return False, "Không tìm thấy thông báo."

def delete_notification_admin(item_id: str) -> tuple[bool, str]:
    _ensure_loaded()
    global NOTIFICATIONS_DB
    original_len = len(NOTIFICATIONS_DB)
    NOTIFICATIONS_DB = [item for item in NOTIFICATIONS_DB if str(item.get("id")) != str(item_id)]
    
    if len(NOTIFICATIONS_DB) < original_len:
        _persist_runtime_state()
        return True, "Xóa thông báo thành công."
    return False, "Không tìm thấy thông báo."

