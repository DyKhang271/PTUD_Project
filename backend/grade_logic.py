from __future__ import annotations

import re
from typing import Iterable


GRADE_COMPONENTS = ("diem_qt", "diem_gk", "diem_ck")
PROCESS_GRADE_COMPONENTS = (
    "diem_thuong_ky_1",
    "diem_thuong_ky_2",
    "diem_thuc_hanh_1",
    "diem_thuc_hanh_2",
)
DETAILED_GRADE_COMPONENTS = PROCESS_GRADE_COMPONENTS + GRADE_COMPONENTS
GRADE_WEIGHTS = {
    "diem_qt": 0.2,
    "diem_gk": 0.3,
    "diem_ck": 0.5,
}
GRADE_COMPONENT_ORDER = {
    "diem_qt": 1,
    "diem_gk": 2,
    "diem_ck": 3,
}
GRADE_ORDER_TO_COMPONENT = {
    order: name for name, order in GRADE_COMPONENT_ORDER.items()
}


def update_grade_weights(new_weights: dict) -> None:
    for key, value in new_weights.items():
        if key in GRADE_WEIGHTS:
            GRADE_WEIGHTS[key] = float(value)


def round_score(value: float | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def coerce_score(value: float | int | str | None) -> float | None:
    if value in ("", None):
        return None
    try:
        return round_score(float(value))
    except (TypeError, ValueError):
        return None


def normalize_component_score(value: float | int | str | None) -> float | None:
    if value in ("", None):
        return None

    score = float(value)
    if score < 0 or score > 10:
        raise ValueError("Scores must be between 0 and 10.")
    return round_score(score)


def extract_component_scores(midterm_scores: Iterable[float] | None) -> dict[str, float | None]:
    result = {component: None for component in GRADE_COMPONENTS}
    if not midterm_scores:
        return result

    for index, score in enumerate(midterm_scores, start=1):
        component = GRADE_ORDER_TO_COMPONENT.get(index)
        if component:
            result[component] = round_score(score)
    return result


def calculate_process_score(
    scores: dict[str, float | None],
    fallback_qt: float | int | str | None = None,
) -> float | None:
    process_scores = [
        scores.get(component)
        for component in PROCESS_GRADE_COMPONENTS
        if scores.get(component) is not None
    ]
    if process_scores:
        return round_score(sum(process_scores) / len(process_scores))
    return normalize_component_score(fallback_qt)


def extract_detailed_component_scores(
    raw_scores: dict[str, float | int | str | None] | None = None,
    midterm_scores: Iterable[float] | None = None,
) -> dict[str, float | None]:
    result = {component: None for component in DETAILED_GRADE_COMPONENTS}
    raw_scores = raw_scores or {}

    for component in DETAILED_GRADE_COMPONENTS:
        result[component] = coerce_score(raw_scores.get(component))

    legacy_scores = extract_component_scores(midterm_scores)
    for component in GRADE_COMPONENTS:
        if result[component] is None:
            result[component] = legacy_scores.get(component)

    if result["diem_qt"] is None:
        result["diem_qt"] = calculate_process_score(result)

    return result


def serialize_component_scores(scores: dict[str, float | None]) -> list[float | None]:
    ordered_scores: list[float | None] = [
        round_score(scores.get(component)) for component in GRADE_COMPONENTS
    ]
    while ordered_scores and ordered_scores[-1] is None:
        ordered_scores.pop()
    return ordered_scores


def serialize_component_rows(scores: dict[str, float | None]) -> list[tuple[int, float]]:
    rows: list[tuple[int, float]] = []
    for component in GRADE_COMPONENTS:
        score = scores.get(component)
        if score is not None:
            rows.append((GRADE_COMPONENT_ORDER[component], round_score(score)))
    return rows


def serialize_detailed_component_scores(scores: dict[str, float | None]) -> dict[str, float]:
    serialized: dict[str, float] = {}
    for component in DETAILED_GRADE_COMPONENTS:
        score = round_score(scores.get(component))
        if score is not None:
            serialized[component] = score
    return serialized


def build_course_grade(scores: dict[str, float | None]) -> dict[str, float | str | None]:
    normalized_process_scores = {
        component: normalize_component_score(scores.get(component))
        for component in PROCESS_GRADE_COMPONENTS
    }
    normalized_scores = {
        **normalized_process_scores,
        "diem_qt": calculate_process_score(
            normalized_process_scores,
            fallback_qt=scores.get("diem_qt"),
        ),
        "diem_gk": normalize_component_score(scores.get("diem_gk")),
        "diem_ck": normalize_component_score(scores.get("diem_ck")),
    }
    final_score = calculate_final_score(normalized_scores)

    if final_score is None:
        has_partial_score = any(score is not None for score in normalized_scores.values())
        return {
            **normalized_scores,
            "final_score": None,
            "gpa4": None,
            "letter": None,
            "classification": None,
            "status": "in_progress" if has_partial_score else None,
        }

    letter, gpa4 = get_letter_and_gpa4(final_score)
    return {
        **normalized_scores,
        "final_score": final_score,
        "gpa4": gpa4,
        "letter": letter,
        "classification": get_score_classification(final_score),
        "status": "Đạt" if final_score >= 5 else "Rớt",
    }


def calculate_final_score(scores: dict[str, float | None]) -> float | None:
    if any(scores.get(component) is None for component in GRADE_COMPONENTS):
        return None

    total = sum(scores[component] * GRADE_WEIGHTS[component] for component in GRADE_COMPONENTS)
    return round_score(total)


def get_letter_and_gpa4(final_score: float) -> tuple[str, float]:
    if final_score >= 9.0:
        return "A+", 4.0
    if final_score >= 8.5:
        return "A", 4.0
    if final_score >= 8.0:
        return "B+", 3.5
    if final_score >= 7.0:
        return "B", 3.0
    if final_score >= 6.5:
        return "C+", 2.5
    if final_score >= 5.5:
        return "C", 2.0
    if final_score >= 5.0:
        return "D+", 1.5
    if final_score >= 4.0:
        return "D", 1.0
    return "F", 0.0


def get_score_classification(final_score: float) -> str:
    if final_score >= 9.0:
        return "Xuất sắc"
    if final_score >= 8.0:
        return "Giỏi"
    if final_score >= 6.5:
        return "Khá"
    if final_score >= 5.0:
        return "Trung bình"
    return "Kém"


def classify_academic_standing(gpa4: float | None) -> str | None:
    if gpa4 is None:
        return None
    if gpa4 >= 3.6:
        return "Xuất sắc"
    if gpa4 >= 3.2:
        return "Giỏi"
    if gpa4 >= 2.5:
        return "Khá"
    if gpa4 >= 2.0:
        return "Trung bình"
    return "Kém"


def weighted_average(items: Iterable[tuple[float, int]]) -> float | None:
    total_weight = 0
    total_value = 0.0
    for value, weight in items:
        total_value += float(value) * int(weight)
        total_weight += int(weight)

    if total_weight == 0:
        return None
    return round_score(total_value / total_weight)


def get_term_sort_key(term: str) -> tuple[int, int]:
    match = re.search(r"HK(\d+)\s*\((\d{4})", term or "")
    if not match:
        return (10**9, 10**9)
    return int(match.group(2)), int(match.group(1))
