from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
import re

from .db_retriever import CourseLookupResult, fetch_student_bundle, find_course_lookup, looks_like_student_academic_query
from .documents import normalize_text
from .history import append_session_message, get_session_history
from .llm_client import OllamaClient, OllamaUnavailableError, OpenAICompatibleClient, OpenAICompatibleUnavailableError
from .retriever import RetrievedSnippet, retrieve_document_snippets
from .settings import get_chatbot_settings
from .student_context import StudentContext, build_student_context
from .system_prompt import build_system_prompt


INTENT_RULES = {
    "diem_so": {
        "strong_phrases": (
            "bang diem",
            "xem diem",
            "diem mon",
            "diem hoc phan",
            "diem giua ky",
            "diem cuoi ky",
            "diem thuong ky",
            "diem thanh phan",
            "diem tong ket",
            "mon dang hoc",
            "dang hoc nhung mon nao",
            "hoc ky nay hoc mon nao",
            "hoc ky nay dang hoc mon nao",
            "hoc ky nay co nhung mon nao",
            "dang hoc mon nao",
        ),
        "phrases": (
            "ket qua hoc tap",
            "xem ket qua hoc tap",
            "phuc khao diem",
        ),
        "combo_groups": (
            (("diem",), ("mon", "hoc", "phan", "gk", "ck", "tk1", "tk2", "tk3", "th1", "th2", "th3")),
        ),
        "priority": 30,
    },
    "gpa_tin_chi": {
        "strong_phrases": (
            "gpa",
            "gpa tich luy",
            "diem trung binh tich luy",
            "diem trung binh hoc ky",
            "tin chi tich luy",
            "da dat bao nhieu tin chi",
            "da hoc duoc bao nhieu tin chi",
            "tin chi da hoan thanh",
            "da hoan thanh bao nhieu tin chi",
            "tin chi da dat",
            "so tin chi da dat",
            "so tin chi hoan thanh",
            "xep loai hoc luc",
            "tien do hoc tap",
            "tin chi con lai",
            "tong so tin chi chuong trinh",
            "dang hoc bao nhieu tin chi",
        ),
        "phrases": (
            "tin chi hoan thanh",
            "tin chi da tich luy",
            "da tich luy bao nhieu tin chi",
            "ket qua tich luy",
            "con bao nhieu tin chi nua",
            "tong tin chi chuong trinh",
        ),
        "combo_groups": (
            (("tin",), ("chi",), ("dat", "hoan", "thanh", "tich", "luy", "xep", "loai")),
        ),
        "priority": 40,
    },
    "chuong_trinh_khung": {
        "strong_phrases": (
            "chuong trinh khung",
            "khung chuong trinh",
            "mon bat buoc",
            "mon tu chon",
            "hoc phan tien quyet",
            "mon tien quyet",
            "hoc truoc",
            "ctdt",
        ),
        "phrases": (
            "danh sach mon hoc",
            "cau truc chuong trinh",
            "khung dao tao",
        ),
        "combo_groups": (
            (("tien",), ("quyet",)),
            (("bat",), ("buoc",)),
            (("tu",), ("chon",)),
        ),
        "priority": 50,
    },
    "quy_che_hoc_vu": {
        "strong_phrases": (
            "quy che hoc vu",
            "quy dinh hoc vu",
            "dieu kien hoc vu",
            "canh bao hoc vu",
            "canh bao",
            "canh cao hoc vu",
            "canh cao",
            "buoc thoi hoc",
            "hoc lai",
            "thi lai",
            "cai thien diem",
            "xu ly hoc vu",
        ),
        "phrases": (
            "quy che",
            "quy dinh",
            "dieu kien canh bao",
            "dieu kien canh cao",
        ),
        "combo_groups": (
            (("quy",), ("che",)),
            (("quy",), ("dinh",)),
            (("canh",), ("bao", "cao")),
            (("hoc",), ("lai",)),
            (("thi",), ("lai",)),
            (("cai",), ("thien",), ("diem",)),
        ),
        "priority": 90,
    },
    "xet_tot_nghiep": {
        "strong_phrases": (
            "tot nghiep",
            "xet tot nghiep",
            "ra truong",
            "du dieu kien tot nghiep",
            "du dieu kien ra truong",
            "tien do tot nghiep",
            "con bao nhieu tin chi de tot nghiep",
            "con bao nhieu mon de tot nghiep",
            "khi nao tot nghiep",
        ),
        "phrases": (
            "dieu kien tot nghiep",
            "dieu kien ra truong",
            "ho so tot nghiep",
        ),
        "combo_groups": (
            (("tot",), ("nghiep",)),
            (("ra",), ("truong",)),
        ),
        "priority": 80,
    },
    "bao_luu_nghi_hoc": {
        "strong_phrases": (
            "bao luu",
            "nghi hoc",
            "tam dung hoc",
            "thoi hoc",
            "bao luu ket qua",
            "xin nghi hoc",
        ),
        "phrases": (
            "bao luu hoc tap",
            "tam ngung hoc",
        ),
        "combo_groups": (
            (("bao",), ("luu",)),
            (("nghi", "tam"), ("hoc", "dung")),
        ),
        "priority": 70,
    },
    "dang_ky_hoc_phan": {
        "strong_phrases": (
            "dang ky hoc phan",
            "dang ki hoc phan",
            "dang ky mon",
            "dang ki mon",
            "mo lop hoc phan",
            "rut hoc phan",
            "huy hoc phan",
            "dang ky lai",
            "dang ki lai",
            "dang ky tin chi",
            "dang ki tin chi",
            "hoc phan tien quyet",
            "hoc phan hoc truoc",
            "hoc phan song hanh",
            "mon tien quyet",
            "hoc truoc",
            "song hanh",
            "co duoc dang ky",
            "co duoc dang ki",
        ),
        "phrases": (
            "mo lop",
            "rut mon",
            "huy mon",
            "ki sau",
            "ky sau",
        ),
        "combo_groups": (
            (("dang",), ("ky", "ki"), ("hoc", "phan", "mon", "tin", "chi")),
            (("rut", "huy", "mo"), ("hoc", "phan", "mon", "lop")),
            (("tien",), ("quyet",)),
            (("hoc",), ("truoc",)),
            (("song",), ("hanh",)),
        ),
        "priority": 60,
    },
}

SENSITIVE_INTENTS = {"quy_che_hoc_vu", "xet_tot_nghiep", "bao_luu_nghi_hoc"}
DOCUMENT_GUARDED_INTENTS = {"chuong_trinh_khung", "dang_ky_hoc_phan"}
GUARDED_INTENTS = SENSITIVE_INTENTS | DOCUMENT_GUARDED_INTENTS | {"gpa_tin_chi"}
DOCUMENT_FIRST_FALLBACK_INTENTS = {
    "quy_che_hoc_vu",
    "bao_luu_nghi_hoc",
    "dang_ky_hoc_phan",
    "chuong_trinh_khung",
}


@dataclass(frozen=True)
class ChatbotResult:
    reply: str
    sources: list[str]
    intent: str
    has_context: bool
    metadata: dict


def _contains_any(normalized: str, patterns: tuple[str, ...]) -> bool:
    return any(pattern in normalized for pattern in patterns)


INTENT_MIN_SCORE = 3


def _matches_combo(tokens: set[str], combo: tuple[tuple[str, ...], ...]) -> bool:
    return all(any(option in tokens for option in group) for group in combo)


def _score_intent(normalized: str, tokens: set[str], intent: str) -> int:
    rule = INTENT_RULES[intent]
    strong_hits = sum(1 for phrase in rule.get("strong_phrases", ()) if phrase in normalized)
    phrase_hits = sum(1 for phrase in rule.get("phrases", ()) if phrase in normalized)
    combo_hits = sum(1 for combo in rule.get("combo_groups", ()) if _matches_combo(tokens, combo))

    score = strong_hits * 6 + phrase_hits * 3 + combo_hits * 4

    if intent == "xet_tot_nghiep" and _contains_any(
        normalized,
        ("con bao nhieu tin chi", "con bao nhieu mon", "du dieu kien", "ra truong", "tien do tot nghiep"),
    ):
        score += 2
    if intent == "gpa_tin_chi" and _contains_any(
        normalized,
        ("gpa", "xep loai", "tin chi da dat", "tin chi da hoan thanh", "tien do hoc tap"),
    ):
        score += 2
    if intent == "quy_che_hoc_vu" and _contains_any(
        normalized,
        ("quy che", "quy dinh", "canh bao hoc vu", "hoc lai", "thi lai", "cai thien diem"),
    ):
        score += 2
    if intent == "diem_so" and _contains_any(
        normalized,
        ("bang diem", "diem mon", "diem giua ky", "diem cuoi ky", "diem thanh phan"),
    ):
        score += 2
    return score


def _detect_intent(message: str) -> str:
    normalized = normalize_text(message).strip()
    if normalized in {"xin chao", "chao", "hello", "hi"}:
        return "chao_hoi"

    tokens = set(normalized.split())
    best_intent = "ngoai_pham_vi"
    best_score = 0
    best_priority = -1
    for intent in INTENT_RULES:
        score = _score_intent(normalized, tokens, intent)
        priority = INTENT_RULES[intent]["priority"]
        if score > best_score or (score == best_score and score > 0 and priority > best_priority):
            best_intent = intent
            best_score = score
            best_priority = priority

    if best_score == 0 and (
        "chao" in tokens
        or "hello" in tokens
        or "hi" in tokens
        or "xin chao" in normalized
    ):
        return "chao_hoi"
    if best_score < INTENT_MIN_SCORE:
        return "ngoai_pham_vi"
    return best_intent


def _needs_student_context(intent: str) -> bool:
    return intent in {
        "diem_so",
        "gpa_tin_chi",
        "chuong_trinh_khung",
        "xet_tot_nghiep",
        "dang_ky_hoc_phan",
    }


def _should_fetch_student_bundle(message: str, intent: str, student_id: str | None) -> bool:
    if not student_id:
        return False
    return _needs_student_context(intent) or looks_like_student_academic_query(message)


def _needs_document_context(intent: str) -> bool:
    return intent in {
        "chuong_trinh_khung",
        "quy_che_hoc_vu",
        "xet_tot_nghiep",
        "bao_luu_nghi_hoc",
        "dang_ky_hoc_phan",
    }


def _should_force_guarded_response(intent: str) -> bool:
    return intent in GUARDED_INTENTS


def _contains_course_grade_query(normalized: str) -> bool:
    return any(
        phrase in normalized
        for phrase in (
            "diem mon",
            "diem cua mon",
            "bao nhieu diem",
            "diem tong ket",
            "diem giua ky",
            "diem cuoi ky",
            "diem tk",
        )
    ) or "diem" in normalized.split()


def _contains_course_status_query(normalized: str) -> bool:
    return any(
        phrase in normalized
        for phrase in (
            "da hoc mon",
            "hoc mon",
            "chua hoc",
            "qua mon",
            "rot mon",
            "dat mon",
            "hoc roi",
            "hoc chua",
        )
    )


def _contains_course_term_query(normalized: str) -> bool:
    return any(
        phrase in normalized
        for phrase in (
            "hoc ky nao",
            "ki nao",
            "luc nao",
            "khi nao hoc",
        )
    )


def _contains_course_credit_query(normalized: str) -> bool:
    return any(
        phrase in normalized
        for phrase in (
            "bao nhieu tin chi",
            "may tin chi",
            "so tin chi",
        )
    )


def _should_use_direct_course_lookup(intent: str, message: str) -> bool:
    normalized = normalize_text(message)
    if intent in {
        "dang_ky_hoc_phan",
        "chuong_trinh_khung",
        "gpa_tin_chi",
        "xet_tot_nghiep",
        "quy_che_hoc_vu",
        "bao_luu_nghi_hoc",
    }:
        return False
    if _contains_any(
        normalized,
        (
            "tot nghiep",
            "ra truong",
            "tien do hoc tap",
            "tin chi con lai",
            "con bao nhieu tin chi",
            "da dat bao nhieu tin chi",
            "da hoan thanh bao nhieu tin chi",
            "gpa",
            "diem trung binh",
        ),
    ):
        return False
    course_targeted = any(
        phrase in normalized
        for phrase in (
            "diem mon",
            "diem cua mon",
            "mon ",
            "hoc phan",
            "hoc mon",
            "qua mon",
            "rot mon",
            "dat mon",
            "diem",
        )
    )
    return any(
        checker(normalized)
        for checker in (
            _contains_course_grade_query,
            _contains_course_status_query,
            _contains_course_term_query,
            _contains_course_credit_query,
        )
    ) and course_targeted


def _describe_course_status(attempt: dict) -> str:
    final_score = attempt.get("final_score")
    status = attempt.get("status")
    if final_score is None:
        return "đang học"
    if final_score >= 5:
        return "đã học và đạt"
    if status:
        return f"đã học nhưng {str(status).lower()}"
    return "đã học nhưng chưa đạt"


def _build_course_lookup_reply(match: CourseLookupResult, message: str) -> str:
    normalized = normalize_text(message)
    attempts = match.attempts
    latest_attempt = attempts[-1]
    latest_term = latest_attempt.get("term")
    credits = latest_attempt.get("credits")
    final_score = latest_attempt.get("final_score")
    gpa4 = latest_attempt.get("gpa4")
    letter = latest_attempt.get("letter")

    if _contains_course_credit_query(normalized):
        return (
            f"Theo dữ liệu học tập của bạn, môn {match.course_name} có {credits} tín chỉ."
        )

    if _contains_course_term_query(normalized):
        term_list = [attempt.get("term") for attempt in attempts if attempt.get("term")]
        unique_terms = list(dict.fromkeys(term_list))
        if not unique_terms:
            return f"Mình đã tìm thấy môn {match.course_name} trong dữ liệu của bạn nhưng chưa thấy học kỳ cụ thể."
        if len(unique_terms) == 1:
            return f"Theo dữ liệu học tập của bạn, bạn học môn {match.course_name} ở {unique_terms[0]}."
        return (
            f"Theo dữ liệu học tập của bạn, môn {match.course_name} xuất hiện ở các học kỳ: "
            + ", ".join(unique_terms)
            + f". Kết quả gần nhất là ở {latest_term}."
        )

    if _contains_course_grade_query(normalized):
        if final_score is None:
            return (
                f"Theo dữ liệu học tập của bạn, bạn đang học môn {match.course_name} ở {latest_term} "
                "và hiện chưa có điểm tổng kết."
            )
        detail_parts = [f"điểm tổng kết hệ 10 là {final_score}"]
        if gpa4 is not None:
            detail_parts.append(f"hệ 4 là {gpa4}")
        if letter:
            detail_parts.append(f"xếp loại {letter}")
        return (
            f"Theo dữ liệu học tập của bạn, môn {match.course_name} ở {latest_term} có "
            + ", ".join(detail_parts)
            + "."
        )

    if _contains_course_status_query(normalized) or "chua" in normalized.split():
        status_text = _describe_course_status(latest_attempt)
        if final_score is None:
            return (
                f"Theo dữ liệu học tập của bạn, bạn đang học môn {match.course_name} ở {latest_term} "
                "và chưa có điểm tổng kết."
            )
        return (
            f"Theo dữ liệu học tập của bạn, bạn {status_text} môn {match.course_name} ở {latest_term} "
            f"với điểm tổng kết {final_score}."
        )

    if final_score is None:
        return (
            f"Theo dữ liệu học tập của bạn, môn {match.course_name} đang được đăng ký ở {latest_term} "
            "và chưa có điểm tổng kết."
        )
    return (
        f"Theo dữ liệu học tập của bạn, môn {match.course_name} đã xuất hiện trong bảng điểm ở {latest_term} "
        f"với điểm tổng kết {final_score}."
    )


def _format_history(session_id: str | None) -> str:
    settings = get_chatbot_settings()
    history = get_session_history(session_id, settings.max_history_messages)
    if not history:
        return "Không có lịch sử hội thoại trước đó."
    return "\n".join(f"{item['role']}: {item['text']}" for item in history)


def _format_document_context(snippets: list[RetrievedSnippet]) -> str:
    if not snippets:
        return "Không tìm thấy đoạn tài liệu phù hợp."
    parts = []
    for snippet in snippets:
        parts.append(
            f"[{snippet.source} | {snippet.category} | score={snippet.score}]\n{snippet.text[:700].strip()}"
        )
    return "\n\n".join(parts)


def _format_sources(sources: list[str]) -> str:
    if not sources:
        return "Không có nguồn nội bộ."
    return "; ".join(sources)


def _response_contract(intent: str, student_context: StudentContext | None, has_documents: bool) -> str:
    instructions = [
        "Quy tắc trả lời:",
        "1. Mở đầu bằng kết luận ngắn gọn, không lan man.",
        "2. Chỉ sử dụng thông tin có trong Nguồn hệ thống và Nguồn tài liệu.",
        "3. Nếu một số liệu không xuất hiện rõ trong context thì không được tự tính hoặc tự bổ sung.",
        "4. Luôn trả lời bằng tiếng Việt có dấu, tự nhiên, rõ ràng.",
    ]

    if student_context and not student_context.credit_progress_exact:
        instructions.append(
            "5. Dữ liệu tổng tín chỉ chương trình hiện chưa đầy đủ, KHÔNG được kết luận chính xác số tín chỉ còn lại để tốt nghiệp."
        )
    else:
        instructions.append("5. Bạn có thể nhắc lại số liệu tín chỉ nếu nó đã xuất hiện rõ trong context.")

    if intent in SENSITIVE_INTENTS:
        instructions.append(
            "6. Vì đây là nội dung nhạy cảm học vụ, phải nói rõ đây là tư vấn tham khảo và khuyến nghị đối chiếu với Phòng Đào tạo nếu cần."
        )

    if has_documents:
        instructions.append("7. Nếu có dùng tài liệu, chỉ trả lời nội dung chính; không liệt kê tên file, trang, điểm tin cậy hoặc nguồn tham khảo.")

    instructions.append(
        "8. Không hiển thị phân loại intent, nguồn tham khảo, tên file/trang nguồn hoặc độ tin cậy trong câu trả lời."
    )
    instructions.append(
        "9. Nếu câu hỏi vượt quá dữ liệu hiện có, hãy nói rõ 'chưa đủ căn cứ để kết luận' thay vì đoán."
    )
    return "\n".join(instructions)


def _fallback_for_student(intent: str, student_context: StudentContext) -> str:
    metrics = student_context.compact_metrics
    if intent == "gpa_tin_chi":
        if student_context.credit_progress_exact:
            return (
                f"Theo dữ liệu hệ thống, GPA tích lũy hiện tại của bạn là {metrics.get('gpa_tich_luy')}, "
                f"xếp loại {metrics.get('xep_loai')}. Bạn đã đạt {metrics.get('tc_dat')}/{metrics.get('tc_tong')} tín chỉ, "
                f"đang học {metrics.get('tc_dang_hoc')} tín chỉ và còn {metrics.get('tc_con_lai')} tín chỉ trong chương trình."
            )
        return (
            f"Theo dữ liệu hệ thống, GPA tích lũy hiện tại của bạn là {metrics.get('gpa_tich_luy')}, "
            f"xếp loại {metrics.get('xep_loai')}. Bạn đã đạt {metrics.get('tc_dat')} tín chỉ và đang học {metrics.get('tc_dang_hoc')} tín chỉ. "
            "Hệ thống chưa có tổng tín chỉ chương trình chính xác, nên mình chưa kết luận được số tín chỉ còn lại."
        )

    if intent == "xet_tot_nghiep":
        if student_context.credit_progress_exact:
            return (
                f"Theo dữ liệu hệ thống, bạn còn {metrics.get('tc_con_lai')} tín chỉ để hoàn thành khối lượng chương trình. "
                f"Hiện bạn đã đạt {metrics.get('tc_dat')}/{metrics.get('tc_tong')} tín chỉ và đang học {metrics.get('tc_dang_hoc')} tín chỉ. "
                "Đây là tư vấn tham khảo, bạn nên đối chiếu thêm với quy chế học vụ và Phòng Đào tạo nếu cần xác nhận điều kiện tốt nghiệp."
            )
        return (
            f"Theo dữ liệu hệ thống, bạn đã đạt {metrics.get('tc_dat')} tín chỉ và đang học {metrics.get('tc_dang_hoc')} tín chỉ. "
            "Tuy nhiên, hệ thống chưa có tổng tín chỉ chương trình chính xác nên mình chưa đủ căn cứ để kết luận bạn còn bao nhiêu tín chỉ để tốt nghiệp. "
            "Đây là tư vấn tham khảo, bạn nên đối chiếu thêm với chương trình khung và Phòng Đào tạo."
        )

    if intent == "diem_so":
        current_term = metrics.get("current_term")
        if student_context.current_courses:
            return (
                f"Học kỳ hiện tại của bạn là {current_term}. Các môn đang học gồm: "
                + ", ".join(student_context.current_courses[:6])
                + ". Bạn có thể hỏi cụ thể từng môn để mình tra thông tin điểm thành phần nếu dữ liệu hệ thống có."
            )
        return (
            f"Học kỳ gần nhất trong hệ thống là {current_term}. GPA tích lũy của bạn hiện là {metrics.get('gpa_tich_luy')}."
        )

    if intent == "dang_ky_hoc_phan":
        if student_context.current_courses:
            return (
                "Hiện bạn đang học: "
                + ", ".join(student_context.current_courses[:6])
                + ". Để gợi ý đăng ký học phần tiếp theo, mình cần đối chiếu thêm với chương trình khung và các học phần tiên quyết."
            )

    if intent == "chuong_trinh_khung":
        credit_parts = []
        if student_context.total_required_credits is not None:
            credit_parts.append(f"tổng {student_context.total_required_credits} tín chỉ")
        if student_context.mandatory_credits is not None:
            credit_parts.append(f"{student_context.mandatory_credits} tín chỉ bắt buộc")
        if student_context.elective_credits is not None:
            credit_parts.append(f"{student_context.elective_credits} tín chỉ tự chọn")

        progress = ""
        if student_context.credit_progress_exact:
            progress = (
                f" Hiện bạn đã đạt {metrics.get('tc_dat')} tín chỉ, đang học {metrics.get('tc_dang_hoc')} tín chỉ "
                f"và còn {metrics.get('tc_con_lai')} tín chỉ để hoàn thành theo dữ liệu hệ thống."
            )

        note = f" Ghi chú: {student_context.curriculum_note}." if student_context.curriculum_note else ""
        credit_summary = ", gồm " + ", ".join(credit_parts) if credit_parts else ""
        return (
            f"Theo dữ liệu hệ thống, bạn thuộc ngành {student_context.program_name or 'chưa xác định'} "
            f"và chương trình khung hiện ghi nhận{credit_summary}.{progress}{note}"
        )

    return student_context.summary_text


def _compact_text(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def _relevant_document_points(message: str, snippets: list[RetrievedSnippet], *, limit: int = 4) -> list[str]:
    question_tokens = {token for token in normalize_text(message).split() if len(token) > 2}
    scored: list[tuple[int, int, str]] = []
    position = 0

    for snippet in snippets:
        for raw_part in re.split(r"\n+|(?<=[.!?])\s+", snippet.text):
            part = _compact_text(raw_part)
            if len(part) < 30:
                continue
            normalized_part = normalize_text(part)
            part_tokens = set(normalized_part.split())
            score = len(question_tokens & part_tokens)
            if "canh bao hoc vu" in normalized_part:
                score += 8
            if "hoc phan tien quyet" in normalized_part:
                score += 8
            if "hoc phan hoc truoc" in normalized_part or "hoc phan song hanh" in normalized_part:
                score += 6
            if "xet tot nghiep" in normalized_part:
                score += 8
            if score > 0:
                scored.append((score, position, part))
            position += 1

    scored.sort(key=lambda item: (-item[0], item[1]))
    selected = sorted(scored[:limit], key=lambda item: item[1])
    return [item[2] for item in selected]


def _policy_warning_reply() -> str:
    return (
        "Theo quy chế học vụ hệ thống đang có, sinh viên có thể bị cảnh báo học vụ khi rơi vào một trong các trường hợp sau:\n"
        "- GPA học kỳ dưới 0.80 ở học kỳ đầu hoặc dưới 1.00 ở các học kỳ tiếp theo.\n"
        "- CPA/điểm trung bình tích lũy thấp hơn mức quy định theo năm đào tạo.\n"
        "- Số tín chỉ không đạt trong học kỳ vượt quá 50% khối lượng đăng ký, hoặc nợ đọng quá 24 tín chỉ từ đầu khóa.\n"
        "- Nếu bị cảnh báo học vụ quá 2 lần liên tiếp thì có thể bị buộc thôi học.\n\n"
        "Đây là tư vấn tham khảo; khi cần quyết định chính thức, bạn nên đối chiếu thêm với Phòng Đào tạo."
    )


def _course_condition_reply() -> str:
    return (
        "Ba loại điều kiện học phần khác nhau như sau:\n"
        "- Học phần tiên quyết: phải thi đậu học phần A thì mới được đăng ký học phần B.\n"
        "- Học phần học trước: phải học xong học phần A trước khi đăng ký học phần B; có thể chưa đạt nhưng phải có quá trình học/điểm.\n"
        "- Học phần song hành: được đăng ký học phần A và B trong cùng một học kỳ.\n\n"
        "Khi đăng ký học phần, bạn nên kiểm tra kỹ điều kiện tiên quyết/học trước của từng môn và kết quả học tập hiện tại của mình."
    )


def _graduation_policy_reply(student_context: StudentContext | None) -> str:
    if student_context:
        metrics = student_context.compact_metrics
        progress = (
            f"Theo dữ liệu hệ thống, bạn đã đạt {metrics.get('tc_dat')}/{metrics.get('tc_tong')} tín chỉ, "
            f"đang học {metrics.get('tc_dang_hoc')} tín chỉ và còn {metrics.get('tc_con_lai')} tín chỉ."
            if student_context.credit_progress_exact
            else "Hệ thống chưa đủ dữ liệu tổng tín chỉ để kết luận chính xác tiến độ tốt nghiệp của bạn."
        )
        return (
            f"{progress}\n\n"
            "Về nguyên tắc xét tốt nghiệp, sinh viên cần tích lũy đủ số tín chỉ của chương trình, đạt CPA từ 2.0/4.0 trở lên và có đủ các chứng chỉ/điều kiện bắt buộc như GDQP, GDTC, ngoại ngữ nếu chương trình yêu cầu. "
            "Đây là tư vấn tham khảo; bạn nên đối chiếu thêm với Phòng Đào tạo khi cần xác nhận chính thức."
        )
    return (
        "Về nguyên tắc xét tốt nghiệp, sinh viên cần tích lũy đủ số tín chỉ của chương trình, đạt CPA từ 2.0/4.0 trở lên và có đủ các chứng chỉ/điều kiện bắt buộc như GDQP, GDTC, ngoại ngữ nếu chương trình yêu cầu."
    )


def _fallback_from_documents(
    intent: str,
    snippets: list[RetrievedSnippet],
    *,
    message: str,
    student_context: StudentContext | None = None,
) -> str:
    if not snippets:
        return ""

    normalized_message = normalize_text(message)
    normalized_tokens = set(normalized_message.split())
    if intent == "quy_che_hoc_vu" and (
        {"canh", "bao"} <= normalized_tokens or {"canh", "cao"} <= normalized_tokens
    ):
        return _policy_warning_reply()
    if intent == "dang_ky_hoc_phan" and (
        "tien quyet" in normalized_message
        or "hoc truoc" in normalized_message
        or "song hanh" in normalized_message
        or "dang ky hoc phan" in normalized_message
    ):
        return _course_condition_reply()
    if intent == "xet_tot_nghiep":
        return _graduation_policy_reply(student_context)

    primary = snippets[0]
    if intent in {"chuong_trinh_khung", "dang_ky_hoc_phan"}:
        for snippet in snippets:
            if snippet.category == "curriculum":
                primary = snippet
                break

    lead = {
        "quy_che_hoc_vu": "Theo tài liệu quy chế học vụ mà hệ thống đang có,",
        "bao_luu_nghi_hoc": "Theo tài liệu học vụ mà hệ thống đang có,",
        "dang_ky_hoc_phan": "Theo tài liệu chương trình khung và hướng dẫn học vụ mà hệ thống đang có,",
        "xet_tot_nghiep": "Theo tài liệu quy chế học vụ mà hệ thống đang có,",
        "chuong_trinh_khung": "Theo tài liệu chương trình khung mà hệ thống đang có,",
    }.get(intent, "Theo tài liệu tham khảo mà hệ thống đang có,")

    points = _relevant_document_points(message, snippets)
    excerpt = "\n".join(f"- {point}" for point in points) if points else _compact_text(primary.text[:500])
    if intent in SENSITIVE_INTENTS:
        return (
            f"{lead}\n\n{excerpt}\n\n"
            "Đây là tư vấn tham khảo dựa trên dữ liệu học vụ hệ thống đang có. "
            "Nếu bạn cần kết luận chính thức, nên đối chiếu thêm với Phòng Đào tạo."
        )
    if intent == "dang_ky_hoc_phan":
        return (
            f"{lead}\n\n{excerpt}\n\n"
            "Nếu bạn muốn biết có được đăng ký ngay hay không, mình sẽ cần đối chiếu thêm học phần tiên quyết/học trước và kết quả học tập hiện tại của bạn."
        )
    return f"{lead}\n\n{excerpt}"


def _fallback_response(
    *,
    intent: str,
    student_context: StudentContext | None,
    snippets: list[RetrievedSnippet],
    message: str,
    ollama_reason: str | None,
) -> str:
    if intent == "chao_hoi":
        return (
            "Xin chào! Mình là trợ lý học vụ của IUH Portal. "
            "Bạn có thể hỏi mình về GPA, tín chỉ, bảng điểm, chương trình khung, quy chế học vụ hoặc tiến độ tốt nghiệp."
        )

    if intent == "chuong_trinh_khung" and student_context:
        return _fallback_for_student(intent, student_context)

    if intent in DOCUMENT_FIRST_FALLBACK_INTENTS and snippets:
        return _fallback_from_documents(intent, snippets, message=message, student_context=student_context)

    if student_context and intent != "ngoai_pham_vi":
        base = _fallback_for_student(intent, student_context)
        return base

    if snippets:
        return _fallback_from_documents(intent, snippets, message=message, student_context=student_context)

    return (
        "Mình chưa đủ thông tin để trả lời chắc chắn câu hỏi này. "
        "Bạn thử hỏi cụ thể hơn về học vụ, điểm số, tín chỉ, quy chế hoặc tiến độ tốt nghiệp nhé."
    )


def _build_prompt(
    *,
    message: str,
    intent: str,
    student_context: StudentContext | None,
    document_snippets: list[RetrievedSnippet],
    session_id: str | None,
    role: str | None,
    sources: list[str],
) -> str:
    sections = [
        f"Vai trò người dùng: {role or 'unknown'}",
        f"Intent nội bộ, không hiển thị cho người dùng: {intent}",
        "Nguồn nội bộ để đối chiếu, không hiển thị cho người dùng:\n" + _format_sources(sources),
        "Lịch sử hội thoại gần đây:\n" + _format_history(session_id),
    ]

    if student_context:
        sections.append("Nguồn hệ thống (PostgreSQL):\n" + student_context.summary_text)
        sections.append(
            "Có được kết luận chính xác tiến độ tín chỉ hay không:\n"
            + ("CÓ - số liệu tổng tín chỉ chương trình đã có." if student_context.credit_progress_exact else "KHÔNG - không đủ căn cứ để kết luận chính xác.")
        )
    else:
        sections.append("Nguồn hệ thống (PostgreSQL):\nKhông có context sinh viên phù hợp.")

    sections.append("Nguồn tài liệu (RAG_docx):\n" + _format_document_context(document_snippets))
    sections.append("Hướng dẫn trả lời:\n" + _response_contract(intent, student_context, bool(document_snippets)))
    sections.append("Câu hỏi hiện tại:\n" + message.strip())
    sections.append(
        "Hãy trả lời bằng tiếng Việt có dấu, ngắn gọn, rõ ràng. Nếu thông tin chưa đủ thì nói rõ là chưa đủ thông tin hoặc chưa đủ căn cứ để kết luận. Không thêm phân loại intent, nguồn tham khảo, tên file/trang nguồn hoặc độ tin cậy vào câu trả lời."
    )
    return "\n\n".join(sections)


class ChatbotService:
    def __init__(self) -> None:
        self.settings = get_chatbot_settings()
        self.ollama_client = OllamaClient()
        self.openai_client = OpenAICompatibleClient()

    def chat(
        self,
        *,
        message: str,
        student_id: str | None = None,
        role: str | None = None,
        session_id: str | None = None,
        program_name: str | None = None,
    ) -> ChatbotResult:
        intent = _detect_intent(message)
        student_bundle = fetch_student_bundle(student_id) if _should_fetch_student_bundle(message, intent, student_id) else None
        student_context = build_student_context(student_bundle)
        resolved_program_name = (
            student_context.program_name
            if student_context and student_context.program_name
            else program_name
        )
        direct_course_match = find_course_lookup(student_bundle, message)

        if direct_course_match and _should_use_direct_course_lookup(intent, message):
            sources = [f"PostgreSQL: student_raw_records/{student_bundle['student_id']}"]
            reply = _build_course_lookup_reply(direct_course_match, message)
            append_session_message(session_id, "user", message)
            append_session_message(session_id, "assistant", reply)
            return ChatbotResult(
                reply=reply,
                sources=sources,
                intent="diem_so",
                has_context=True,
                metadata={
                    "student_id": student_id,
                    "program_name": resolved_program_name,
                    "ollama_status": "fallback",
                    "credit_progress_exact": student_context.credit_progress_exact if student_context else False,
                    "response_mode": "database_direct",
                    "matched_course": direct_course_match.course_name,
                    "matched_course_code": direct_course_match.course_code,
                },
            )

        document_snippets = (
            retrieve_document_snippets(message, intent=intent, program_name=resolved_program_name)
            if _needs_document_context(intent)
            else []
        )

        sources: list[str] = []
        if student_context:
            sources.append(f"PostgreSQL: student_raw_records/{student_context.student_id}")
        sources.extend(snippet.source for snippet in document_snippets)
        sources = list(dict.fromkeys(sources))

        append_session_message(session_id, "user", message)
        ai_reason = None
        ai_provider = "fallback"
        reply = None

        if _should_force_guarded_response(intent):
            ai_reason = "Guarded response enabled for sensitive academic advising."
        elif self.settings.ai_enabled:
            prompt = _build_prompt(
                message=message,
                intent=intent,
                student_context=student_context,
                document_snippets=document_snippets,
                session_id=session_id,
                role=role,
                sources=sources,
            )
            try:
                if self.settings.ai_provider in {"auto", "openai", "openai-compatible", "cloud"}:
                    reply = self.openai_client.generate(system_prompt=build_system_prompt(), prompt=prompt)
                    ai_provider = "openai-compatible"
                elif self.settings.ai_provider == "ollama":
                    reply = self.ollama_client.generate(system_prompt=build_system_prompt(), prompt=prompt)
                    ai_provider = "ollama"
            except OpenAICompatibleUnavailableError as exc:
                ai_reason = str(exc)
                if self.settings.ai_provider == "auto":
                    try:
                        reply = self.ollama_client.generate(system_prompt=build_system_prompt(), prompt=prompt)
                        ai_provider = "ollama"
                        ai_reason = None
                    except OllamaUnavailableError as ollama_exc:
                        ai_reason = f"{ai_reason}; {ollama_exc}"
            except OllamaUnavailableError as exc:
                ai_reason = str(exc)

        if not reply:
            reply = _fallback_response(
                intent=intent,
                student_context=student_context,
                snippets=document_snippets,
                message=message,
                ollama_reason=ai_reason,
            )

        append_session_message(session_id, "assistant", reply)
        return ChatbotResult(
            reply=reply,
            sources=sources,
            intent=intent,
            has_context=bool(student_context or document_snippets),
            metadata={
                "student_id": student_id,
                "program_name": resolved_program_name,
                "ollama_status": "ready" if ai_provider == "ollama" else "fallback",
                "ai_provider": ai_provider,
                "ai_status": "ready" if reply and ai_reason is None and self.settings.ai_enabled else "fallback",
                "credit_progress_exact": student_context.credit_progress_exact if student_context else False,
                "response_mode": "guarded" if _should_force_guarded_response(intent) else "llm_or_fallback",
            },
        )


@lru_cache(maxsize=1)
def get_chatbot_service() -> ChatbotService:
    return ChatbotService()
