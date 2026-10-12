"""POST /api/v1/classify — Submit a classification with marks.

See ARCHITECTURE.md §4.2 for the full contract.
"""

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.schemas.classification import ClassificationRequest, ClassificationResponse

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_db)]

DEMO_USER_ID = "00000000-0000-0000-0000-000000000001"
VALID_CATEGORIES = {
    "asteroid_neo",
    "comet",
    "brown_dwarf",
    "planet_x_candidate",
    "artifact",
    "nothing",
}


@router.post(
    "/classify",
    response_model=ClassificationResponse,
    status_code=201,
    responses={
        404: {"description": "Subject not found"},
        409: {"description": "Already classified"},
        422: {"description": "Validation error"},
    },
)
async def submit_classification(
    body: ClassificationRequest,
    db: DbSession,
) -> JSONResponse:
    if body.category not in VALID_CATEGORIES:
        allowed = sorted(VALID_CATEGORIES)
        return JSONResponse(
            status_code=422,
            content={
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": f"Invalid category: {body.category}",
                    "details": [{"field": "category", "issue": f"Must be one of {allowed}"}],
                }
            },
        )

    subj_res = await db.execute(
        text(
            """
            SELECT id, epochs, classification_count, retired, is_gold_standard, gold_expected
            FROM subjects
            WHERE id = :id
            """
        ),
        {"id": str(body.subject_id)},
    )
    subj = subj_res.mappings().first()
    if subj is None:
        return JSONResponse(
            status_code=404,
            content={
                "error": {
                    "code": "NOT_FOUND",
                    "message": f"Subject {body.subject_id} not found.",
                    "details": [],
                }
            },
        )

    # Ensure default demo user exists
    await db.execute(
        text(
            """
            INSERT INTO users (id, display_name, email, role, reliability)
            VALUES (:id, 'demo-classifier', 'demo@astroblink.local', 'volunteer', 0.8)
            ON CONFLICT (id) DO NOTHING
            """
        ),
        {"id": DEMO_USER_ID},
    )

    # Check if demo user already classified this subject; if so, create a fresh guest user
    existing = await db.execute(
        text("SELECT id FROM classifications WHERE user_id = :uid AND subject_id = :sid"),
        {"uid": DEMO_USER_ID, "sid": str(body.subject_id)},
    )
    if existing.first() is None:
        user_id = DEMO_USER_ID
        user_res = await db.execute(
            text("SELECT reliability, gold_total, gold_correct FROM users WHERE id = :uid"),
            {"uid": DEMO_USER_ID},
        )
        user_row = user_res.mappings().one()
        reliability = float(user_row["reliability"])
        gold_total = int(user_row["gold_total"])
        gold_correct = int(user_row["gold_correct"])
    else:
        guest_res = await db.execute(
            text(
                """
                INSERT INTO users (display_name, role, reliability)
                VALUES ('guest-classifier', 'volunteer', 0.8)
                RETURNING id, reliability, gold_total, gold_correct
                """
            )
        )
        guest_row = guest_res.mappings().one()
        user_id = str(guest_row["id"])
        reliability = float(guest_row["reliability"])
        gold_total = int(guest_row["gold_total"])
        gold_correct = int(guest_row["gold_correct"])

    cls_res = await db.execute(
        text(
            """
            INSERT INTO classifications (
                user_id, subject_id, category, load_time_ms, user_reliability_at_submission
            )
            VALUES (
                :user_id, :subject_id,
                CAST(:category AS classification_category),
                :load_time_ms, :reliability
            )
            RETURNING id
            """
        ),
        {
            "user_id": user_id,
            "subject_id": str(body.subject_id),
            "category": body.category,
            "load_time_ms": body.load_time_ms,
            "reliability": reliability,
        },
    )
    classification_id = str(cls_res.scalar_one())

    for mark in body.marks:
        await db.execute(
            text(
                """
                INSERT INTO marks (
                    classification_id, epoch, pixel_x, pixel_y, ra_deg, dec_deg, position
                )
                VALUES (
                    :cid, :epoch, :px, :py, :ra, :dec,
                    spoint(radians(:ra), radians(:dec))
                )
                """
            ),
            {
                "cid": classification_id,
                "epoch": mark.epoch,
                "px": mark.pixel_x,
                "py": mark.pixel_y,
                "ra": mark.ra,
                "dec": mark.dec,
            },
        )

    # Gold standard update if applicable (ARCHITECTURE.md §4.2 step 3)
    if bool(subj.get("is_gold_standard")) and subj.get("gold_expected") is not None:
        gold_total += 1
        gold_exp = subj["gold_expected"]
        if isinstance(gold_exp, str):
            import json
            try:
                gold_exp = json.loads(gold_exp)
            except Exception:
                gold_exp = {}

        from app.services.consensus import MarkInput, compute_updated_reliability, evaluate_gold_classification
        mark_inputs = [
            MarkInput(user_id=user_id, epoch=m.epoch, ra_deg=m.ra, dec_deg=m.dec)
            for m in body.marks
        ]
        is_hit = evaluate_gold_classification(body.category, mark_inputs, gold_exp)
        if is_hit:
            gold_correct += 1

        new_reliability = compute_updated_reliability(gold_total, gold_correct)
        await db.execute(
            text(
                """
                UPDATE users
                SET gold_total = :gt,
                    gold_correct = :gc,
                    reliability = :rel
                WHERE id = :uid
                """
            ),
            {"gt": gold_total, "gc": gold_correct, "rel": new_reliability, "uid": user_id},
        )

    upd_subj = await db.execute(
        text(
            """
            UPDATE subjects
            SET classification_count = classification_count + 1,
                retired = CASE WHEN classification_count + 1 >= 10 THEN TRUE ELSE retired END
            WHERE id = :sid
            RETURNING classification_count, retired
            """
        ),
        {"sid": str(body.subject_id)},
    )
    subj_after = upd_subj.mappings().one()

    await db.execute(
        text("UPDATE users SET classification_count = classification_count + 1 WHERE id = :uid"),
        {"uid": user_id},
    )

    await db.commit()

    new_count = int(subj_after["classification_count"])
    badges = ["first_classify"] if new_count == 1 else []

    return JSONResponse(
        status_code=201,
        content={
            "classification_id": classification_id,
            "subject_id": str(body.subject_id),
            "category": body.category,
            "marks_count": len(body.marks),
            "subject_classification_count": new_count,
            "subject_retired": bool(subj_after["retired"]),
            "badges_earned": badges,
            "message": "Classification recorded.",
        },
    )
