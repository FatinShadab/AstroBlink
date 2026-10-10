"""POST /api/v1/classify — Submit a classification with marks.

See ARCHITECTURE.md \u00a74.2 for the full contract.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.schemas.classification import ClassificationRequest, ClassificationResponse

router = APIRouter()


@router.post(
    "/classify",
    response_model=ClassificationResponse,
    status_code=201,
    responses={
        409: {"description": "Already classified"},
        422: {"description": "Validation error"},
    },
)
async def submit_classification(body: ClassificationRequest) -> JSONResponse:
    # Stub: validate marks, insert classification + marks, increment counts.
    # See ARCHITECTURE.md \u00a74.2
    return JSONResponse(
        status_code=201,
        content={
            "classification_id": "00000000-0000-0000-0000-000000000000",
            "subject_id": str(body.subject_id),
            "category": body.category,
            "marks_count": len(body.marks),
            "subject_classification_count": 1,
            "subject_retired": False,
            "badges_earned": [],
            "message": "Stub: classification recorded.",
        },
    )
