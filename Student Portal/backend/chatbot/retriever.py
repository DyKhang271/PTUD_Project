from __future__ import annotations

from dataclasses import dataclass

from .documents import DocumentChunk, load_document_chunks, normalize_text
from .settings import get_chatbot_settings


@dataclass(frozen=True)
class RetrievedSnippet:
    source: str
    category: str
    text: str
    score: int


def _program_code_for_name(program_name: str | None) -> str | None:
    normalized = normalize_text(program_name or "")
    if "khoa hoc may tinh" in normalized:
        return "KHMT"
    if "khoa hoc du lieu" in normalized:
        return "KHDL"
    return None


def _is_course_specific_question(question: str) -> bool:
    normalized = normalize_text(question)
    phrases = (
        "dang ki mon",
        "dang ky mon",
        "mon tien quyet",
        "hoc phan tien quyet",
        "co duoc khong",
        "mon bat buoc",
        "mon tu chon",
    )
    return any(phrase in normalized for phrase in phrases) or "mon" in normalized.split()


def _score_chunk(
    chunk: DocumentChunk,
    tokens: set[str],
    *,
    intent: str,
    program_code: str | None,
    course_specific: bool,
) -> int:
    chunk_tokens = set(normalize_text(chunk.text).split())
    overlap = len(tokens & chunk_tokens)
    score = overlap

    if intent == "chuong_trinh_khung" and chunk.category == "curriculum":
        score += 4
    if intent in {"quy_che_hoc_vu", "bao_luu_nghi_hoc", "xet_tot_nghiep", "dang_ky_hoc_phan"} and chunk.category == "policy":
        score += 4
    if intent == "dang_ky_hoc_phan" and course_specific and chunk.category == "curriculum":
        score += 7
    if intent == "dang_ky_hoc_phan" and {"tien", "quyet"} <= tokens and chunk.category == "curriculum":
        score += 5
    if program_code and chunk.program_code == program_code:
        score += 5
    return score


def retrieve_document_snippets(
    question: str,
    *,
    intent: str,
    program_name: str | None,
) -> list[RetrievedSnippet]:
    settings = get_chatbot_settings()
    tokens = {token for token in normalize_text(question).split() if len(token) > 1}
    program_code = _program_code_for_name(program_name)
    course_specific = _is_course_specific_question(question)
    ranked: list[RetrievedSnippet] = []

    for chunk in load_document_chunks():
        if intent == "chuong_trinh_khung" and chunk.category == "curriculum":
            if program_code and chunk.program_code and chunk.program_code != program_code:
                continue
        elif intent in {"quy_che_hoc_vu", "bao_luu_nghi_hoc", "xet_tot_nghiep"} and chunk.category not in {"policy", "general"}:
            continue
        elif intent == "dang_ky_hoc_phan" and chunk.category not in {"policy", "general", "curriculum"}:
            continue
        elif intent == "dang_ky_hoc_phan" and chunk.category == "curriculum":
            if program_code and chunk.program_code and chunk.program_code != program_code:
                continue
            if not course_specific and "dang" not in tokens and "ky" not in tokens:
                continue
        elif intent == "dang_ky_hoc_phan" and chunk.category not in {"policy", "general", "curriculum"}:
            continue

        score = _score_chunk(
            chunk,
            tokens,
            intent=intent,
            program_code=program_code,
            course_specific=course_specific,
        )
        if score <= 0:
            continue

        ranked.append(
            RetrievedSnippet(
                source=chunk.source,
                category=chunk.category,
                text=chunk.text.strip(),
                score=score,
            )
        )

    ranked.sort(key=lambda item: item.score, reverse=True)
    return ranked[: settings.max_document_snippets]
