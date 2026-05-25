from __future__ import annotations

from datetime import date
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.repositories import academic_import_batch_repo, external_user_repo, section_repo, teacher_assignment_repo
from app.schemas.import_schema import (
    AcademicImportBatchDetailRead,
    AcademicImportBatchRead,
    AcademicSchedulingImportedSectionRead,
    AcademicSchedulingSourceDebugRead,
    AcademicSchedulingSourceImportResponse,
)
from app.services.core_api_client import CoreApiClient


def _infer_term_name(term_code: str) -> str:
    if term_code.startswith("HK") and "_" in term_code:
        parts = term_code.split("_")
        if len(parts) == 3:
            return f"{parts[0]} ({parts[1]} - {parts[2]})"
    return term_code


def _upsert_term(db: Session, term_code: str) -> tuple[object, bool]:
    term = section_repo.get_term_by_code(db, term_code)
    if term is not None:
        return term, False

    term = section_repo.create_term(
        db,
        {
            "term_code": term_code,
            "term_name": _infer_term_name(term_code),
            "start_date": None,
            "end_date": None,
            "status": "active",
        },
    )
    return term, True


def _sync_section_students(db: Session, *, section_id, students: list[dict[str, Any]]) -> int:
    existing = {
        enrollment.student_external_id: enrollment
        for enrollment in section_repo.list_section_students(db, section_id)
    }
    imported_ids = {str(student.get("student_id") or "").strip() for student in students if str(student.get("student_id") or "").strip()}

    created_or_reactivated = 0
    for student in students:
        student_id = str(student.get("student_id") or "").strip()
        if not student_id:
            continue

        external_user_repo.upsert_external_user(
            db,
            external_user_id=student_id,
            role="student",
            full_name=student.get("full_name"),
            class_name=student.get("class_name"),
        )
        previous_status = existing.get(student_id).enrollment_status if existing.get(student_id) else None
        enrollment, created = section_repo.add_student_to_section(
            db,
            section_id=section_id,
            student_external_id=student_id,
            enrollment_status="active",
        )
        if created or previous_status == "inactive":
            created_or_reactivated += 1

    for student_id, enrollment in existing.items():
        if student_id not in imported_ids and enrollment.enrollment_status != "inactive":
            enrollment.enrollment_status = "inactive"
            db.flush()

    return created_or_reactivated


def import_academic_scheduling_source(db: Session, payload: dict[str, Any]) -> AcademicSchedulingSourceImportResponse:
    normalized_payload = {
        "term_code": str(payload.get("term_code") or "").strip(),
        "program_name": str(payload.get("program_name") or "").strip() or None,
        "program_id": str(payload.get("program_id") or "").strip() or None,
        "cohort": str(payload.get("cohort") or "").strip() or None,
        "curriculum_semester": int(payload.get("curriculum_semester") or 4),
        "strict_curriculum_match": bool(payload.get("strict_curriculum_match") or False),
    }
    batch = academic_import_batch_repo.create_batch(
        db,
        {
            "source": "student_portal",
            "term_code": normalized_payload["term_code"],
            "program_name": normalized_payload["program_name"],
            "cohort": normalized_payload["cohort"],
            "curriculum_semester": normalized_payload["curriculum_semester"],
            "imported_by": payload.get("imported_by"),
            "status": "failed",
        },
    )
    db.commit()

    try:
        source = CoreApiClient().get_academic_scheduling_source(**normalized_payload)
    except Exception as exc:
        batch = academic_import_batch_repo.get_batch(db, batch.id)
        if batch is not None:
            academic_import_batch_repo.update_batch(db, batch, {"status": "failed", "error_message": str(exc)})
            db.commit()
        raise

    term_code = str(source.get("term_code") or payload.get("term_code") or "").strip()
    sections_payload = source.get("sections") or []
    warnings = list(source.get("warnings") or [])
    debug_payload = source.get("debug") or None
    if not term_code:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Student Portal response is missing term_code")

    term, created_term = _upsert_term(db, term_code)
    imported_terms = 1 if created_term else 0
    sections_created = 0
    sections_updated = 0
    student_links_created_or_reactivated = 0
    teachers_upserted: set[str] = set()
    rendered_sections: list[AcademicSchedulingImportedSectionRead] = []

    try:
        for item in sections_payload:
            section_code = str(item.get("class_section_code") or "").strip()
            course_code = str(item.get("course_code") or "").strip()
            course_name = str(item.get("course_name") or "").strip()
            if not section_code or not course_code or not course_name:
                continue

            teacher = item.get("teacher") or {}
            teacher_id = str(teacher.get("teacher_id") or "").strip() or None
            teacher_name = teacher.get("full_name")
            students = item.get("students") or []

            section = section_repo.get_section_by_term_and_code(db, term_id=term.id, section_code=section_code)
            values = {
                "term_id": term.id,
                "course_code": course_code,
                "course_name": course_name,
                "section_code": section_code,
                "teacher_external_id": teacher_id,
                "student_count": len(students),
                "status": "active",
            }
            was_created = section is None
            if was_created:
                section = section_repo.create_section(db, values)
                sections_created += 1
            else:
                section_repo.update_section(db, section, values)
                sections_updated += 1

            if teacher_id:
                external_user_repo.upsert_external_user(
                    db,
                    external_user_id=teacher_id,
                    role="teacher",
                    full_name=teacher_name,
                )
                teacher_assignment_repo.upsert_for_section(
                    db,
                    section_id=section.id,
                    teacher_external_id=teacher_id,
                    teacher_full_name=teacher_name,
                    assignment_type="primary",
                )
                teacher_assignment_repo.deactivate_other_assignments(
                    db,
                    section_id=section.id,
                    keep_teacher_external_id=teacher_id,
                    assignment_type="primary",
                )
                teachers_upserted.add(teacher_id)
            else:
                for assignment in teacher_assignment_repo.get_by_section_and_type(
                    db,
                    section_id=section.id,
                    assignment_type="primary",
                ):
                    assignment.active = False
                db.flush()

            student_links_created_or_reactivated += _sync_section_students(
                db,
                section_id=section.id,
                students=students,
            )

            rendered_sections.append(
                AcademicSchedulingImportedSectionRead(
                    section_code=section_code,
                    course_code=course_code,
                    course_name=course_name,
                    teacher_external_id=teacher_id,
                    teacher_full_name=teacher_name,
                    student_count=len(students),
                    status="created" if was_created else "updated",
                )
            )

        total_students = sum(len(item.get("students") or []) for item in sections_payload)
        final_status = "empty" if not sections_payload else ("partial" if warnings else "success")
        batch = academic_import_batch_repo.get_batch(db, batch.id)
        if batch is not None:
            academic_import_batch_repo.update_batch(
                db,
                batch,
                {
                    "status": final_status,
                    "section_count": len(sections_payload),
                    "student_count": total_students,
                    "teacher_count": len(teachers_upserted),
                    "warnings_json": warnings,
                    "source_payload_snapshot_json": source,
                    "error_message": None,
                },
            )
        db.commit()
    except Exception as exc:
        db.rollback()
        batch = academic_import_batch_repo.get_batch(db, batch.id)
        if batch is not None:
            academic_import_batch_repo.update_batch(
                db,
                batch,
                {
                    "status": "failed",
                    "warnings_json": warnings,
                    "source_payload_snapshot_json": source,
                    "error_message": str(exc),
                },
            )
            db.commit()
        raise

    return AcademicSchedulingSourceImportResponse(
        batch_id=str(batch.id),
        status="empty" if not sections_payload else ("partial" if warnings else "success"),
        term_code=term_code,
        program_name=source.get("program_name"),
        cohort=source.get("cohort"),
        curriculum_semester=int(source.get("curriculum_semester") or payload.get("curriculum_semester")),
        imported_terms=imported_terms,
        sections_created=sections_created,
        sections_updated=sections_updated,
        students_created_or_reactivated=student_links_created_or_reactivated,
        teachers_upserted=len(teachers_upserted),
        total_sections=len(sections_payload),
        total_students=total_students,
        warnings=warnings,
        summary={
            "sections": len(sections_payload),
            "students": total_students,
            "teachers": len(teachers_upserted),
            "sections_created": sections_created,
            "sections_updated": sections_updated,
            "students_created_or_reactivated": student_links_created_or_reactivated,
            "teachers_upserted": len(teachers_upserted),
        },
        debug=AcademicSchedulingSourceDebugRead(**debug_payload) if debug_payload else None,
        sections=rendered_sections,
    )


def list_import_batches(db: Session) -> list[AcademicImportBatchRead]:
    batches = academic_import_batch_repo.list_batches(db)
    return [
        AcademicImportBatchRead(
            id=str(batch.id),
            term_code=batch.term_code,
            program_name=batch.program_name,
            cohort=batch.cohort,
            curriculum_semester=batch.curriculum_semester,
            imported_at=batch.imported_at,
            status=batch.status,
            section_count=batch.section_count,
            student_count=batch.student_count,
            teacher_count=batch.teacher_count,
            warnings=list(batch.warnings_json or []),
            debug=AcademicSchedulingSourceDebugRead(**((batch.source_payload_snapshot_json or {}).get("debug") or {}))
            if (batch.source_payload_snapshot_json or {}).get("debug")
            else None,
        )
        for batch in batches
    ]


def get_import_batch_detail(db: Session, batch_id) -> AcademicImportBatchDetailRead:
    batch = academic_import_batch_repo.get_batch(db, batch_id)
    if batch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Academic import batch not found")
    return AcademicImportBatchDetailRead(
        id=str(batch.id),
        term_code=batch.term_code,
        program_name=batch.program_name,
        cohort=batch.cohort,
        curriculum_semester=batch.curriculum_semester,
        imported_at=batch.imported_at,
        status=batch.status,
        section_count=batch.section_count,
        student_count=batch.student_count,
        teacher_count=batch.teacher_count,
        warnings=list(batch.warnings_json or []),
        debug=AcademicSchedulingSourceDebugRead(**((batch.source_payload_snapshot_json or {}).get("debug") or {}))
        if (batch.source_payload_snapshot_json or {}).get("debug")
        else None,
        source=batch.source,
        imported_by=batch.imported_by,
        snapshot=batch.source_payload_snapshot_json,
        error_message=batch.error_message,
    )
