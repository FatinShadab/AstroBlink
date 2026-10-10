"""POST /api/v1/cutouts/fetch — Enqueue an ingestion job.

See ARCHITECTURE.md \u00a74.1 for the full contract.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.cutout import CutoutFetchRequest, CutoutFetchResponse

router = APIRouter()


@router.post(
    "/cutouts/fetch",
    response_model=CutoutFetchResponse,
    status_code=202,
    responses={409: {"description": "Subject exists"}, 422: {"description": "Validation error"}},
)
async def fetch_cutout(body: CutoutFetchRequest) -> JSONResponse:
    # Stub: insert ingest_jobs row, push job_id to Redis list.
    # See ARCHITECTURE.md \u00a74.1
    return JSONResponse(
        status_code=202,
        content={
            "job_id": "00000000-0000-0000-0000-000000000000",
            "status": "queued",
            "ra": body.ra,
            "dec": body.dec,
            "size_deg": body.size_deg,
            "message": "Stub: ingestion job enqueued.",
        },
    )
