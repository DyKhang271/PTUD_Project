from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class StudentContext:
    student_id: str
    program_name: str | None
    summary_text: str
    compact_metrics: dict
    current_courses: list[str]
    failed_courses: list[str]
    credit_progress_exact: bool
    curriculum_note: str | None


def _format_course_names(courses: list[dict], *, only_failed: bool = False) -> list[str]:
    output: list[str] = []
    for course in courses:
        final_score = course.get("final_score")
        if only_failed and not (final_score is not None and final_score < 5):
            continue
        if not only_failed and final_score is not None:
            continue
        output.append(course.get("course_name", "Mon hoc"))
    return output


def _latest_completed_term(transcript_terms: list[dict]) -> dict:
    for term in reversed(transcript_terms):
        if term.get("gpa4_term") is not None:
            return term
    return transcript_terms[-1] if transcript_terms else {}


def _compute_in_progress_credits(raw_payload: dict, current_term_label: str | None, current_term: dict) -> int:
    registered_credits = current_term.get("registered_credits")
    earned_credits = current_term.get("earned_credits")
    if registered_credits is not None and earned_credits is not None:
        return max((registered_credits or 0) - (earned_credits or 0), 0)

    if not current_term_label:
        return 0

    return sum(
        int(course.get("credits") or 0)
        for course in raw_payload.get("transcript_courses", [])
        if course.get("term") == current_term_label and course.get("final_score") is None
    )


def build_student_context(student_bundle: dict | None) -> StudentContext | None:
    if not student_bundle:
        return None

    normalized = student_bundle["normalized_record"]
    raw_payload = student_bundle["raw_payload"]
    student = normalized["student"]
    grades_summary = normalized["grades_summary"]
    current_term = grades_summary.get("current_term")
    transcript_terms = raw_payload.get("transcript_terms", [])
    latest_completed = _latest_completed_term(transcript_terms)
    current_term_payload = transcript_terms[-1] if transcript_terms else {}
    raw_curriculum_summary = raw_payload.get("curriculum_summary") or {}
    total_required_credits = raw_curriculum_summary.get("total_required_credits")
    completed_credits = latest_completed.get("earned_credits")
    in_progress_credits = _compute_in_progress_credits(raw_payload, current_term, current_term_payload)
    credit_progress_exact = total_required_credits is not None and completed_credits is not None
    remaining_credits = (
        max(int(total_required_credits) - int(completed_credits or 0) - int(in_progress_credits or 0), 0)
        if credit_progress_exact
        else None
    )

    current_courses = [
        course["course_name"]
        for course in raw_payload.get("transcript_courses", [])
        if course.get("term") == current_term and course.get("final_score") is None
    ]
    failed_courses = _format_course_names(raw_payload.get("transcript_courses", []), only_failed=True)

    compact_metrics = {
        "gpa_tich_luy": grades_summary.get("gpa_tich_luy"),
        "tc_dat": grades_summary.get("tc_dat"),
        "tc_dang_hoc": in_progress_credits,
        "tc_con_lai": remaining_credits,
        "tc_tong": total_required_credits,
        "xep_loai": grades_summary.get("xep_loai"),
        "current_term": current_term,
        "credit_progress_exact": credit_progress_exact,
    }

    summary_lines = [
        f"Sinh vien: {student.get('ho_ten')} ({student.get('mssv')})",
        f"Nganh: {student.get('program_name')}",
        f"Lop: {student.get('lop')}",
        f"GPA tich luy: {grades_summary.get('gpa_tich_luy')}",
        f"Xep loai: {grades_summary.get('xep_loai')}",
        f"Tin chi da dat: {completed_credits if completed_credits is not None else grades_summary.get('tc_dat')}",
        f"Tin chi dang hoc: {in_progress_credits}",
    ]
    if credit_progress_exact:
        summary_lines.append(f"Tong tin chi chuong trinh: {total_required_credits}")
        summary_lines.append(f"Tin chi con lai de hoan thanh chuong trinh: {remaining_credits}")
    else:
        summary_lines.append("Tong tin chi chuong trinh: chua co du lieu chinh xac trong he thong.")
        summary_lines.append(
            "Tin chi con lai de hoan thanh chuong trinh: chua the ket luan chinh xac vi thieu tong so tin chi chuong trinh."
        )
    if current_courses:
        summary_lines.append("Mon dang hoc: " + ", ".join(current_courses[:8]))
    if failed_courses:
        summary_lines.append("Mon da rot/nochua dat: " + ", ".join(failed_courses[:8]))
    if raw_curriculum_summary.get("note"):
        summary_lines.append("Ghi chu chuong trinh: " + str(raw_curriculum_summary.get("note")))

    return StudentContext(
        student_id=student_bundle["student_id"],
        program_name=student.get("program_name"),
        summary_text="\n".join(summary_lines),
        compact_metrics=compact_metrics,
        current_courses=current_courses,
        failed_courses=failed_courses,
        credit_progress_exact=credit_progress_exact,
        curriculum_note=raw_curriculum_summary.get("note"),
    )
