"""Candidate management and export endpoints.

GET  /api/v1/candidates         — list candidates
GET  /api/v1/candidates/export  — export as CSV or VOTable
PATCH /api/v1/candidates/{id}   — update status (astronomer/admin)

See ARCHITECTURE.md §4.4 for export contract.
"""

from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.services.export import export_candidates_to_csv, export_candidates_to_votable

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.get("/candidates")
async def list_candidates(
    db: DbSession,
    status: str | None = Query(None),
    category: str | None = Query(None),
    min_reliability: float | None = Query(None),
    min_classifications: int | None = Query(None),
) -> JSONResponse:
    query = """
        SELECT id, subject_id, category::text AS category, status::text AS status,
               n_classifications, mean_reliability, cluster_dispersion_arcsec,
               motion_arcsec_per_epoch, motion_pa_deg, created_at, updated_at
        FROM candidates
        WHERE 1=1
    """
    params = {}
    if status is not None:
        query += " AND status = CAST(:status AS candidate_status)"
        params["status"] = status
    if category is not None:
        query += " AND category = CAST(:category AS classification_category)"
        params["category"] = category
    if min_reliability is not None:
        query += " AND mean_reliability >= :min_rel"
        params["min_rel"] = min_reliability
    if min_classifications is not None:
        query += " AND n_classifications >= :min_cls"
        params["min_cls"] = min_classifications

    query += " ORDER BY created_at DESC"
    res = await db.execute(text(query), params)
    rows = [dict(r) for r in res.mappings().all()]
    for r in rows:
        r["id"] = str(r["id"])
        r["subject_id"] = str(r["subject_id"])
        r["created_at"] = r["created_at"].isoformat()
        r["updated_at"] = r["updated_at"].isoformat()

    return JSONResponse(status_code=200, content={"candidates": rows, "count": len(rows)})


@router.get("/candidates/export")
async def export_candidates(
    db: DbSession,
    format: str = Query(..., pattern="^(csv|votable)$"),
    status: str | None = Query(None),
    category: str | None = Query(None),
    min_reliability: float | None = Query(None),
    min_classifications: int | None = Query(None),
) -> Response:
    query = """
        SELECT c.id, c.subject_id, c.category::text AS category, c.status::text AS status,
               c.n_classifications, c.mean_reliability, c.cluster_dispersion_arcsec,
               c.motion_arcsec_per_epoch, c.motion_pa_deg
        FROM candidates c
        WHERE 1=1
    """
    params = {}
    if status is not None:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if statuses:
            query += " AND c.status::text = ANY(:statuses)"
            params["statuses"] = statuses
    if category is not None:
        query += " AND c.category = CAST(:category AS classification_category)"
        params["category"] = category
    if min_reliability is not None:
        query += " AND c.mean_reliability >= :min_rel"
        params["min_rel"] = min_reliability
    if min_classifications is not None:
        query += " AND c.n_classifications >= :min_cls"
        params["min_cls"] = min_classifications

    query += " ORDER BY c.created_at DESC"
    res = await db.execute(text(query), params)
    candidate_rows = [dict(r) for r in res.mappings().all()]

    if not candidate_rows:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "No candidates found matching the specified filters.",
                    "details": [],
                }
            },
        )

    cand_ids = [r["id"] for r in candidate_rows]
    epochs_res = await db.execute(
        text(
            """
            SELECT candidate_id, epoch, centroid_ra_deg, centroid_dec_deg
            FROM candidate_epochs
            WHERE candidate_id = ANY(:cids)
            ORDER BY epoch ASC
            """
        ),
        {"cids": cand_ids},
    )
    epochs_by_cand: dict[str, dict[int, tuple[float, float]]] = {}
    for er in epochs_res.mappings().all():
        cid_str = str(er["candidate_id"])
        epochs_by_cand.setdefault(cid_str, {})[int(er["epoch"])] = (
            float(er["centroid_ra_deg"]),
            float(er["centroid_dec_deg"]),
        )

    for r in candidate_rows:
        cid_str = str(r["id"])
        e_map = epochs_by_cand.get(cid_str, {})
        for ep_num in (1, 2, 3, 4):
            if ep_num in e_map:
                r[f"epoch_{ep_num}_ra"], r[f"epoch_{ep_num}_dec"] = e_map[ep_num]
            else:
                r[f"epoch_{ep_num}_ra"], r[f"epoch_{ep_num}_dec"] = None, None

    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")

    if format == "csv":
        csv_data = export_candidates_to_csv(candidate_rows)
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={
                "Content-Disposition": f'attachment; filename="astroblink_candidates_{date_str}.csv"'
            },
        )
    else:
        votable_xml = export_candidates_to_votable(candidate_rows)
        return Response(
            content=votable_xml,
            media_type="application/x-votable+xml",
            headers={
                "Content-Disposition": f'attachment; filename="astroblink_candidates_{date_str}.xml"'
            },
        )


@router.patch("/candidates/{candidate_id}")
async def update_candidate_status(
    candidate_id: UUID,
) -> JSONResponse:
    return JSONResponse(
        status_code=200,
        content={"message": f"Stub: candidate {candidate_id} status update not yet implemented."},
    )
