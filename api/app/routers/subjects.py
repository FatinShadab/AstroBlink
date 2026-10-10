"""GET /api/v1/subjects/next — Serve next unretired subject.

See ARCHITECTURE.md \u00a76.2 for subject queue caching.
"""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

router = APIRouter()


@router.get("/subjects/next")
async def get_next_subject() -> JSONResponse:
    # Stub: query unretired subject not yet classified by current user.
    # MVP: no auth, hardcoded demo-user.
    # See ARCHITECTURE.md \u00a74 (subjects/next not fully contracted but used by frontend).
    return JSONResponse(
        status_code=200,
        content={
            "id": "00000000-0000-0000-0000-000000000000",
            "ra_deg": 180.0,
            "dec_deg": 0.0,
            "size_deg": 0.1,
            "epochs": [1, 2, 3],
            "tile_urls": {},
            "wcs_urls": {},
            "classification_count": 0,
            "retired": False,
        },
    )
