"""POST /api/v1/consensus/run — Run the consensus pipeline.

See ARCHITECTURE.md \u00a74.3 and \u00a75 for algorithm pseudocode.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.consensus import ConsensusRunRequest

router = APIRouter()


@router.post(
    "/consensus/run",
    responses={
        200: {"description": "Consensus completed (single subject)"},
        202: {"description": "Batch job enqueued"},
        404: {"description": "Subject not found or not retired"},
    },
)
async def run_consensus(body: ConsensusRunRequest) -> JSONResponse:
    # Stub: run per-epoch DBSCAN clustering, tracklet linking, candidate extraction.
    # See ARCHITECTURE.md \u00a75 (Consensus Algorithm Pseudocode)
    if body.batch:
        return JSONResponse(
            status_code=202,
            content={
                "batch_job_id": "00000000-0000-0000-0000-000000000000",
                "subjects_queued": 0,
                "message": "Stub: batch consensus enqueued.",
            },
        )
    return JSONResponse(
        status_code=200,
        content={
            "subject_id": str(body.subject_id) if body.subject_id else None,
            "classifications_processed": 0,
            "candidates_found": 0,
            "candidates": [],
        },
    )
