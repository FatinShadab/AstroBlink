"""POST /api/v1/consensus/run — Run the consensus pipeline.

See ARCHITECTURE.md §4.3 and §5 for algorithm pseudocode.
"""

import math
from collections import Counter
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.consensus import ConsensusRunRequest

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]


@router.post(
    "/consensus/run",
    responses={
        200: {"description": "Consensus completed (single subject)"},
        202: {"description": "Batch job enqueued"},
        404: {"description": "Subject not found or not retired"},
    },
)
async def run_consensus(
    body: ConsensusRunRequest,
    db: DbSession,
) -> JSONResponse:
    if body.batch:
        count_res = await db.execute(
            text("SELECT COUNT(*)::int FROM subjects WHERE classification_count > 0")
        )
        subjects_queued = int(count_res.scalar_one() or 0)
        return JSONResponse(
            status_code=202,
            content={
                "batch_job_id": str(uuid4()),
                "subjects_queued": subjects_queued,
                "message": "Batch consensus job started.",
            },
        )

    # Resolve target subject_id (explicit or latest classified subject)
    if body.subject_id is not None:
        subj_res = await db.execute(
            text("SELECT id FROM subjects WHERE id = :sid"),
            {"sid": str(body.subject_id)},
        )
        subj_row = subj_res.mappings().first()
    else:
        subj_res = await db.execute(
            text(
                """
                SELECT s.id
                FROM subjects s
                LEFT JOIN classifications c ON c.subject_id = s.id
                GROUP BY s.id, s.created_at
                ORDER BY COUNT(c.id) DESC, s.created_at ASC
                LIMIT 1
                """
            )
        )
        subj_row = subj_res.mappings().first()

    if subj_row is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": "Subject not found.",
                    "details": [],
                }
            },
        )

    subject_id = str(subj_row["id"])

    # Read real classifications for this subject from the DB
    cls_res = await db.execute(
        text(
            """
            SELECT id, category::text AS category, user_reliability_at_submission
            FROM classifications
            WHERE subject_id = :sid
            """
        ),
        {"sid": subject_id},
    )
    cls_rows = cls_res.mappings().all()
    classifications_processed = len(cls_rows)

    # Read real marks grouped by epoch from the DB
    marks_res = await db.execute(
        text(
            """
            SELECT m.epoch,
                   COUNT(*)::int AS cluster_size,
                   AVG(m.ra_deg)::float AS centroid_ra,
                   AVG(m.dec_deg)::float AS centroid_dec,
                   COALESCE(STDDEV_POP(m.ra_deg) * 3600.0, 0.0)::float AS dispersion_arcsec
            FROM marks m
            JOIN classifications c ON c.id = m.classification_id
            WHERE c.subject_id = :sid
            GROUP BY m.epoch
            ORDER BY m.epoch ASC
            """
        ),
        {"sid": subject_id},
    )
    mark_groups = marks_res.mappings().all()

    non_nothing = [r for r in cls_rows if r["category"] != "nothing"]
    if not non_nothing or not mark_groups:
        return JSONResponse(
            status_code=200,
            content={
                "subject_id": subject_id,
                "classifications_processed": classifications_processed,
                "candidates_found": 0,
                "candidates": [],
            },
        )

    majority_category = Counter(r["category"] for r in non_nothing).most_common(1)[0][0]
    mean_reliability = round(
        sum(float(r["user_reliability_at_submission"]) for r in non_nothing) / len(non_nothing),
        4,
    )

    epoch_clusters = [
        {
            "epoch": int(mg["epoch"]),
            "centroid_ra": round(float(mg["centroid_ra"]), 6),
            "centroid_dec": round(float(mg["centroid_dec"]), 6),
            "cluster_size": int(mg["cluster_size"]),
            "dispersion_arcsec": round(float(mg["dispersion_arcsec"]), 3),
        }
        for mg in mark_groups
    ]

    motion_arcsec = 0.0
    motion_pa = 0.0
    if len(epoch_clusters) >= 2:
        dra = (epoch_clusters[-1]["centroid_ra"] - epoch_clusters[0]["centroid_ra"]) * 3600.0
        ddec = (epoch_clusters[-1]["centroid_dec"] - epoch_clusters[0]["centroid_dec"]) * 3600.0
        n_steps = max(1, epoch_clusters[-1]["epoch"] - epoch_clusters[0]["epoch"])
        motion_arcsec = round(math.hypot(dra, ddec) / n_steps, 3)
        motion_pa = round((math.degrees(math.atan2(dra, ddec)) + 360.0) % 360.0, 2)

    mean_disp = round(
        sum(ec["dispersion_arcsec"] for ec in epoch_clusters) / len(epoch_clusters),
        3,
    )

    # Persist candidate and candidate_epochs rows in DB (idempotent replacement per subject)
    await db.execute(text("DELETE FROM candidates WHERE subject_id = :sid"), {"sid": subject_id})
    cand_res = await db.execute(
        text(
            """
            INSERT INTO candidates (
                subject_id, category, status, n_classifications,
                mean_reliability, cluster_dispersion_arcsec,
                motion_arcsec_per_epoch, motion_pa_deg
            )
            VALUES (
                :sid, CAST(:cat AS classification_category), 'new', :n_cls,
                :mean_rel, :disp, :motion, :pa
            )
            RETURNING id
            """
        ),
        {
            "sid": subject_id,
            "cat": majority_category,
            "n_cls": len(non_nothing),
            "mean_rel": mean_reliability,
            "disp": mean_disp,
            "motion": motion_arcsec,
            "pa": motion_pa,
        },
    )
    candidate_id = str(cand_res.scalar_one())

    for ec in epoch_clusters:
        await db.execute(
            text(
                """
                INSERT INTO candidate_epochs (
                    candidate_id, epoch, centroid_ra_deg, centroid_dec_deg,
                    centroid_position, cluster_size, dispersion_arcsec
                )
                VALUES (
                    :cid, :epoch, :ra, :dec,
                    spoint(radians(:ra), radians(:dec)),
                    :csize, :disp
                )
                """
            ),
            {
                "cid": candidate_id,
                "epoch": ec["epoch"],
                "ra": ec["centroid_ra"],
                "dec": ec["centroid_dec"],
                "csize": ec["cluster_size"],
                "disp": ec["dispersion_arcsec"],
            },
        )

    await db.commit()

    return JSONResponse(
        status_code=200,
        content={
            "subject_id": subject_id,
            "classifications_processed": classifications_processed,
            "candidates_found": 1,
            "candidates": [
                {
                    "candidate_id": candidate_id,
                    "category": majority_category,
                    "n_classifications": len(non_nothing),
                    "mean_reliability": mean_reliability,
                    "motion_arcsec_per_epoch": motion_arcsec,
                    "motion_pa_deg": motion_pa,
                    "epochs": epoch_clusters,
                }
            ],
        },
    )
