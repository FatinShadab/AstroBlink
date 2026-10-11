"""GET /api/v1/subjects/next — Serve next unretired subject.

See ARCHITECTURE.md §6.2 for subject queue caching.
"""

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.schemas.subject import SubjectResponse

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get(
    "/subjects/next",
    response_model=SubjectResponse,
    responses={
        200: {"description": "Next subject"},
        204: {"description": "No unretired subjects available"},
    },
)
async def get_next_subject(db: DbSession) -> Response:
    result = await db.execute(
        text(
            """
            SELECT id, ra_deg, dec_deg, size_deg, epochs, tile_urls, classification_count, retired
            FROM subjects
            WHERE retired = FALSE
            ORDER BY classification_count ASC, created_at ASC
            LIMIT 1
            """
        )
    )
    row = result.mappings().first()
    if row is None:
        return Response(status_code=204)

    base_url = settings.tile_base_url.rstrip("/")
    raw_tiles: dict[str, str] = row["tile_urls"] or {}
    tile_urls = {
        k: (v if v.startswith(("http://", "https://")) else f"{base_url}/{v.lstrip('/')}")
        for k, v in raw_tiles.items()
    }

    return JSONResponse(
        status_code=200,
        content={
            "id": str(row["id"]),
            "ra_deg": float(row["ra_deg"]),
            "dec_deg": float(row["dec_deg"]),
            "size_deg": float(row["size_deg"]),
            "epochs": list(row["epochs"]),
            "tile_urls": tile_urls,
            "wcs_urls": {},
            "classification_count": int(row["classification_count"]),
            "retired": bool(row["retired"]),
        },
    )
