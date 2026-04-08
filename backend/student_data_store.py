from __future__ import annotations

import json
from collections import defaultdict
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data_json"

ADMIN_USERS = {
    "admin": {
        "password": "admin",
        "name": "Quản trị viên"
    }
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


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


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


def _build_student_payload(record: dict) -> dict:
    student = record["student"]
    transcript_terms = record["transcript_terms"]
    latest_completed = _get_latest_completed_term(transcript_terms) or {}
    metadata = ACCOUNT_METADATA[student["student_id"]]

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
                    "ten_mon": course["course_name"],
                    "tc": course["credits"],
                    "diem_qt": None,
                    "diem_gk": None,
                    "diem_ck": None,
                    "diem_tk_10": course.get("final_score"),
                    "diem_tk_4": course.get("gpa4"),
                    "xep_loai": course.get("letter") or "-",
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


STUDENT_DB = {}

def get_student_records() -> dict[str, dict]:
    global STUDENT_DB
    if STUDENT_DB:
        return STUDENT_DB

    records: dict[str, dict] = {}

    for data_file in DATA_FILES:
        raw = _load_json(data_file)
        student_payload = _build_student_payload(raw)
        mssv = student_payload["mssv"]

        records[mssv] = {
            "student": student_payload,
            "grades": _build_grades_by_term(raw),
            "grades_summary": _build_grades_summary(raw),
            "curriculum": _build_curriculum_payload(raw, student_payload),
        }

    STUDENT_DB = records
    return STUDENT_DB


def get_available_accounts() -> list[dict]:
    get_student_records()
    accounts = []
    for mssv, meta in ACCOUNT_METADATA.items():
        db_student = STUDENT_DB.get(mssv)
        ho_ten = db_student["student"]["ho_ten"] if db_student else "Tài khoản Sinh viên mới"
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

def validate_admin_login(username, password):
    user = ADMIN_USERS.get(username)
    if user and user["password"] == password:
        return user
    return None

def get_all_students_for_admin():
    get_student_records()
    result = []
    for mssv, meta in ACCOUNT_METADATA.items():
        stu = STUDENT_DB.get(mssv)
        name = stu["student"]["ho_ten"] if stu else "Tài khoản Sinh viên mới"
        result.append({
            "mssv": mssv,
            "ho_ten": name,
            "trang_thai": meta.get("trang_thai", "Đang học"),
            "ngay_sinh": meta.get("ngay_sinh", "")
        })
    return result

def add_new_student(mssv, password, ho_ten="Sinh viên mới", ngay_sinh="01/01/2000"):
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
    
    STUDENT_DB[mssv] = {
        "student": {
            "mssv": mssv,
            "ho_ten": ho_ten,
            "program_name": "Ngành mặc định",
            "he_dao_tao": "Đại học chính quy",
            "khoa_hoc": "2024",
            "so_cmnd": "123456789",
            "ngay_sinh": ngay_sinh,
            "noi_sinh": "TP.HCM",
            "gioi_tinh": "Nam",
            "dan_toc": "Kinh",
            "ton_giao": "Không",
            "doan_vien": "Có",
            "ngay_vao_doan": "26/03/2015",
            "the_bhyt": "HD123456",
            "han_bhyt": "31/12/2026",
            "khu_vuc": "KV3",
            "doi_tuong": "Không",
        },
        "grades": {},
        "grades_summary": {
            "gpa_tich_luy": 0.0,
            "gpa_he_10": 0.0,
            "tong_tin_chi": 0,
            "tc_dat": 0,
            "tc_tong": 140,
            "tc_con_lai": 140,
            "latest_completed_term": None,
            "current_term": "HK1 (2024 - 2025)",
            "previous_term_chart": None,
            "semesters": [],
            "gpa_history": [],
        },
        "curriculum": {"student": {"mssv": mssv, "ho_ten": ho_ten, "program_name": ""}, "semesters": [], "tong_tc": 0},
    }
    return True, "Tạo sinh viên thành công"

def change_student_password(mssv, new_password):
    if mssv not in ACCOUNT_METADATA:
        return False, "Không tìm thấy sinh viên"
    ACCOUNT_METADATA[mssv]["password"] = new_password
    return True, "Đổi mật khẩu thành công"


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
