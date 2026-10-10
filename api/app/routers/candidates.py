"""Candidate management and export endpoints.

GET  /api/v1/candidates         — list candidates
GET  /api/v1/candidates/export  — export as CSV or VOTable
PATCH /api/v1/candidates/{id}   — update status (astronomer/admin)

See ARCHITECTURE.md \u00a74.4 for export contract.
"""

from uuid import UUID

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/candidates")
async def list_candidates(
    status: str | None = Query(None),
    category: str | None = Query(None),
    min_reliability: float | None = Query(None),
    min_classifications: int | None = Query(None),
) -> JSONResponse:
    # Stub: query candidates with filters.
    return JSONResponse(status_code=200, content={"candidates": [], "count": 0})


@router.get("/candidates/export")
async def export_candidates(
    format: str = Query(..., pattern="^(csv|votable)$"),
    status: str | None = Query(None),
    category: str | None = Query(None),
    min_reliability: float | None = Query(None),
    min_classifications: int | None = Query(None),
) -> JSONResponse:
    # Stub: generate CSV or IVOA VOTable 1.4.
    # See ARCHITECTURE.md \u00a74.4 for VOTable structure with UCDs.
    # See services/export.py for implementation.
    return JSONResponse(
        status_code=200,
        content={"message": f"Stub: export as {format} not yet implemented."},
    )


@router.patch("/candidates/{candidate_id}")
async def update_candidate_status(
    candidate_id: UUID,
) -> JSONResponse:
    # Stub: update candidate status, insert candidate_review audit row.
    # Requires astronomer or admin role.
    return JSONResponse(
        status_code=200,
        content={"message": f"Stub: candidate {candidate_id} status update not yet implemented."},
    )
