from __future__ import annotations

from pathlib import Path
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.dependencies import CurrentUser, require_role
from app.schemas.import_schema import (
    AcademicSchedulingSourceImportRequest,
    AcademicSchedulingSourceImportResponse,
    AcademicImportBatchDetailRead,
    AcademicImportBatchRead,
    AcademicSchedulingOptionsResponse,
    ImportDebugSummaryResponse,
    ImportFromCoreRequest,
    ImportFromCoreResponse,
    SourceTermsResponse,
    TimetableEntriesCsvImportResponse,
    TimetableEntriesImportRequest,
    TimetableEntriesImportResponse,
)
from app.schemas.section_schema import CoreCourseSectionsImportRequest, CoreCourseSectionsImportResponse
from app.services import academic_scheduling_import_service, import_service, section_service
from app.services.core_api_client import CoreApiClient

router = APIRouter(prefix="/admin/import", tags=["admin-import"], dependencies=[Depends(require_role(["admin"]))])
CSV_TEMPLATE_PATH = Path(__file__).resolve().parent.parent / "seed_data" / "timetable_entries.sample.csv"


@router.post("/seed-from-core", response_model=ImportFromCoreResponse)
def seed_from_core(payload: ImportFromCoreRequest, db: Annotated[Session, Depends(get_db)]):
    return import_service.import_seed_from_core(db, payload.model_dump(exclude_none=True))


@router.post("/core-sections", response_model=CoreCourseSectionsImportResponse)
def import_core_sections(payload: CoreCourseSectionsImportRequest, db: Annotated[Session, Depends(get_db)]):
    return section_service.import_course_sections_from_core(db, payload.model_dump(exclude_none=True))


@router.post("/academic-scheduling-source", response_model=AcademicSchedulingSourceImportResponse)
def import_academic_scheduling_source(
    payload: AcademicSchedulingSourceImportRequest,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[CurrentUser, Depends(require_role(["admin"]))],
):
    values = payload.model_dump(exclude_none=True)
    values["imported_by"] = current_user.external_id
    return academic_scheduling_import_service.import_academic_scheduling_source(db, values)


@router.get("/academic-batches", response_model=list[AcademicImportBatchRead])
def list_academic_import_batches(db: Annotated[Session, Depends(get_db)]):
    return academic_scheduling_import_service.list_import_batches(db)


@router.get("/academic-batches/{batch_id}", response_model=AcademicImportBatchDetailRead)
def get_academic_import_batch(batch_id: UUID, db: Annotated[Session, Depends(get_db)]):
    return academic_scheduling_import_service.get_import_batch_detail(db, batch_id)


@router.get("/academic-scheduling-options", response_model=AcademicSchedulingOptionsResponse)
def get_academic_scheduling_options():
    return CoreApiClient().get_academic_scheduling_options()


@router.get("/debug-summary", response_model=ImportDebugSummaryResponse)
def debug_summary(
    db: Annotated[Session, Depends(get_db)],
    term: str | None = None,
    term_code: str | None = None,
    term_id: UUID | None = None,
):
    return import_service.get_import_debug_summary(db, term=term, term_code=term_code, term_id=term_id)


@router.get("/source-terms", response_model=SourceTermsResponse)
def source_terms():
    return import_service.get_source_terms()


@router.post("/timetable-entries", response_model=TimetableEntriesImportResponse)
def import_timetable_entries(payload: TimetableEntriesImportRequest, db: Annotated[Session, Depends(get_db)]):
    return import_service.import_timetable_entries_from_payload(db, payload.model_dump(exclude_none=True))


@router.get("/timetable-entries/csv-template")
def download_timetable_entries_csv_template():
    if not CSV_TEMPLATE_PATH.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="CSV template not found")
    return FileResponse(
        path=CSV_TEMPLATE_PATH,
        media_type="text/csv; charset=utf-8",
        filename="timetable_entries.sample.csv",
    )


@router.get("/timetable-entries/csv-scaffold")
def download_timetable_entries_csv_scaffold(
    db: Annotated[Session, Depends(get_db)],
    term_code: str,
    include_optional: bool = True,
):
    filename, content = import_service.build_timetable_entries_csv_scaffold(
        db,
        term_code=term_code,
        include_optional=include_optional,
    )
    return Response(
        content=content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/timetable-entries/csv", response_model=TimetableEntriesCsvImportResponse)
async def import_timetable_entries_csv(
    db: Annotated[Session, Depends(get_db)],
    file: UploadFile = File(...),
):
    content = await file.read()
    return import_service.import_timetable_entries_from_csv(
        db,
        filename=file.filename or "timetable_entries.csv",
        content=content,
    )
