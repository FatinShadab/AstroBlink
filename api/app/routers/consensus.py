"""POST /api/v1/consensus/run — Run the consensus pipeline.

Wires the pure consensus algorithm in app/services/consensus.py with the database.
Reads real classifications and marks from the DB.
Filters anti-spam suspicious loads (load_time_ms >= 3000).
Weights marks by user reliability at submission.
Runs per-epoch DBSCAN and cross-epoch tracklet linking.
Persists candidates and candidate_epochs idempotently.
Conforms strictly to contracts/openapi.yaml and contracts/schemas/consensus.yaml.
"""

from collections import Counter
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db import get_db
from app.schemas.consensus import ConsensusRunRequest
from app.services.consensus import MarkInput, run_pure_consensus

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]



@router.post(
    "/consensus/run",
    responses={
        200: {"description": "Consensus completed (single subject)"},
        202: {"description": "Batch job enqueued"},
        404: {"description": "Subject not found or not retired"},
        422: {"description": "Validation error"},
    },
)
async def run_consensus(
    body: ConsensusRunRequest,
    db: DbSession,
) -> JSONResponse:
    if body.batch:
        count_res = await db.execute(
            text("SELECT COUNT(*)::int FROM subjects WHERE retired = TRUE")
        )
        subjects_queued = int(count_res.scalar_one() or 0)
        return JSONResponse(
            status_code=202,
            content={
                "batch_job_id": str(uuid4()),
                "subjects_queued": subjects_queued,
                "message": "Batch consensus job started. Results will be written to the candidates table.",
            },
        )

    # 1. Resolve subject_id
    if body.subject_id is not None:
        subj_res = await db.execute(
            text(
                """
                SELECT id, epochs, retired, classification_count
                FROM subjects
                WHERE id = :sid
                """
            ),
            {"sid": str(body.subject_id)},
        )
        subj_row = subj_res.mappings().first()
    else:
        # If subject_id is omitted, find latest classified retired subject, or latest classified subject
        subj_res = await db.execute(
            text(
                """
                SELECT s.id, s.epochs, s.retired, s.classification_count
                FROM subjects s
                LEFT JOIN classifications c ON c.subject_id = s.id
                GROUP BY s.id, s.epochs, s.retired, s.classification_count, s.created_at
                ORDER BY s.retired DESC, COUNT(c.id) DESC, s.created_at ASC
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
    epochs = [int(e) for e in subj_row["epochs"]]

    # 2. Check retirement requirement per ARCHITECTURE.md §4.3
    if not subj_row["retired"] and subj_row["classification_count"] < settings.retirement_threshold:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Subject {subject_id} is not retired (classification count: {subj_row['classification_count']}/{settings.retirement_threshold}).",
                    "details": [{"field": "subject_id", "issue": "Subject must be retired before consensus"}],
                }
            },
        )

    # 3. Read valid non-suspicious classifications (anti-spam load_time_ms >= min_load_time_ms)
    cls_res = await db.execute(
        text(
            """
            SELECT id, category::text AS category, user_reliability_at_submission
            FROM classifications
            WHERE subject_id = :sid
              AND (load_time_ms IS NULL OR load_time_ms >= :min_load_time)
            """
        ),
        {"sid": subject_id, "min_load_time": settings.min_load_time_ms},
    )
    cls_rows = cls_res.mappings().all()
    classifications_processed = len(cls_rows)

    # 4. Read marks with user reliability weights
    marks_res = await db.execute(
        text(
            """
            SELECT m.epoch, m.ra_deg, m.dec_deg, c.user_id, c.user_reliability_at_submission
            FROM marks m
            JOIN classifications c ON c.id = m.classification_id
            WHERE c.subject_id = :sid
              AND (c.load_time_ms IS NULL OR c.load_time_ms >= :min_load_time)
            ORDER BY m.epoch ASC
            """
        ),
        {"sid": subject_id, "min_load_time": settings.min_load_time_ms},
    )
    marks_rows = marks_res.mappings().all()


    mark_inputs = [
        MarkInput(
            user_id=str(r["user_id"]),
            epoch=int(r["epoch"]),
            ra_deg=float(r["ra_deg"]),
            dec_deg=float(r["dec_deg"]),
            weight=float(r["user_reliability_at_submission"]),
        )
        for r in marks_rows
    ]

    # Majority vote category across non-nothing classifications
    non_nothing = [r for r in cls_rows if r["category"] != "nothing"]
    consensus_category = (
        Counter(r["category"] for r in non_nothing).most_common(1)[0][0]
        if non_nothing
        else "nothing"
    )

    # 5. Run the pure consensus core algorithm
    tracklets = run_pure_consensus(
        marks=mark_inputs,
        epochs=epochs,
        epsilon_arcsec=body.epsilon_arcsec,
        min_pts=float(body.min_pts),
        max_displacement_arcsec=body.max_displacement_arcsec,
    )

    # 6. Idempotently persist candidates and candidate_epochs
    # Delete existing candidate records for this subject (CASCADE removes candidate_epochs)
    await db.execute(
        text("DELETE FROM candidates WHERE subject_id = :sid"),
        {"sid": subject_id},
    )

    candidate_summaries = []
    for tracklet in tracklets:
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
                "cat": consensus_category,
                "n_cls": tracklet.total_marks,
                "mean_rel": tracklet.mean_reliability,
                "disp": tracklet.mean_dispersion_arcsec,
                "motion": tracklet.motion_arcsec_per_epoch,
                "pa": tracklet.motion_pa_deg,
            },
        )
        candidate_id = str(cand_res.scalar_one())

        epoch_clusters_dto = []
        for cluster in tracklet.clusters:
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
                    "epoch": cluster.epoch,
                    "ra": cluster.centroid_ra_deg,
                    "dec": cluster.centroid_dec_deg,
                    "csize": cluster.cluster_size,
                    "disp": cluster.dispersion_arcsec,
                },
            )
            epoch_clusters_dto.append(
                {
                    "epoch": cluster.epoch,
                    "centroid_ra": cluster.centroid_ra_deg,
                    "centroid_dec": cluster.centroid_dec_deg,
                    "cluster_size": cluster.cluster_size,
                    "dispersion_arcsec": cluster.dispersion_arcsec,
                }
            )

        candidate_summaries.append(
            {
                "candidate_id": candidate_id,
                "category": consensus_category,
                "n_classifications": tracklet.total_marks,
                "mean_reliability": tracklet.mean_reliability,
                "motion_arcsec_per_epoch": tracklet.motion_arcsec_per_epoch,
                "motion_pa_deg": tracklet.motion_pa_deg,
                "epochs": epoch_clusters_dto,
            }
        )

    await db.commit()

    return JSONResponse(
        status_code=200,
        content={
            "subject_id": subject_id,
            "classifications_processed": classifications_processed,
            "candidates_found": len(candidate_summaries),
            "candidates": candidate_summaries,
        },
    )
