"""PostgreSQL database operations for ingestion worker subjects.

Includes:
- Idempotent subject deduplication check (within 1 arcsecond using pgSphere).
- Insertion of subject rows matching schema (spoint, ra_deg, dec_deg, size_deg, epochs, tile_urls, mask_fraction).
- Updates to ingest_jobs status ('running', 'completed', 'failed').

The worker connects directly to PostgreSQL and NEVER modifies schemas or runs migrations.
See ARCHITECTURE.md §2.3, §3.
"""

from __future__ import annotations

import json
import logging
import math
import uuid
from typing import Any

import psycopg2
from psycopg2.extras import RealDictCursor

from worker.config import settings

logger = logging.getLogger(__name__)

# 1 arcsecond in radians = (1.0 / 3600.0) * (pi / 180.0)
ONE_ARCSEC_RAD: float = (1.0 / 3600.0) * (math.pi / 180.0)


def get_db_connection():
    """Get a psycopg2 connection to PostgreSQL."""
    db_url = settings.database_url.replace("postgresql+asyncpg://", "postgresql://")
    return psycopg2.connect(db_url)


def find_existing_subject_nearby(
    conn,
    ra_deg: float,
    dec_deg: float,
    threshold_rad: float = ONE_ARCSEC_RAD,
) -> dict[str, Any] | None:
    """Check if a subject already exists within threshold_rad (default 1 arcsecond) using pgSphere.

    Operator `<->` on pgSphere `spoint` returns angular distance in radians on the celestial sphere.

    Args:
        conn: psycopg2 connection.
        ra_deg: RA in degrees [0, 360).
        dec_deg: Dec in degrees [-90, 90].
        threshold_rad: Maximum spherical distance in radians (default 1″).

    Returns:
        Existing subject row dictionary or None if not found.
    """
    query = """
        SELECT id, ra_deg, dec_deg, epochs, tile_urls, mask_fraction, retired
        FROM subjects
        WHERE position <-> spoint(radians(%s), radians(%s)) < %s
        ORDER BY position <-> spoint(radians(%s), radians(%s)) ASC
        LIMIT 1;
    """
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, (ra_deg, dec_deg, threshold_rad, ra_deg, dec_deg))
        row = cur.fetchone()
        return dict(row) if row else None


def insert_subject(
    conn,
    ra_deg: float,
    dec_deg: float,
    size_deg: float,
    epochs: list[int],
    tile_urls: dict[str, str],
    mask_fraction: float | None = None,
    subject_id: str | None = None,
) -> tuple[str, bool]:
    """Idempotently insert a new subject into the database.

    If a subject already exists within 1″, the insertion is skipped (deduped).

    Args:
        conn: psycopg2 connection.
        ra_deg: RA in degrees.
        dec_deg: Dec in degrees.
        size_deg: Cutout angular size in degrees.
        epochs: Available epoch indices list (e.g. [1, 2]).
        tile_urls: Dictionary mapping "{epoch}_{band}" to object keys / URLs.
        mask_fraction: Average fraction of masked pixels across rendered tiles.
        subject_id: Optional UUID string; generated if None.

    Returns:
        Tuple of (subject_id, created), where created is True if inserted, False if deduped.
    """
    # 1. Check for existing subject within 1″
    existing = find_existing_subject_nearby(conn, ra_deg, dec_deg)
    if existing is not None:
        logger.info(
            "Found existing subject %s within 1″ of (%.5f, %.5f). Skipping insertion.",
            existing["id"],
            ra_deg,
            dec_deg,
        )
        return str(existing["id"]), False

    # 2. Insert new subject
    new_id = subject_id or str(uuid.uuid4())
    insert_query = """
        INSERT INTO subjects (
            id, position, ra_deg, dec_deg, size_deg,
            epochs, tile_urls, is_gold_standard, mask_fraction,
            retired, classification_count
        )
        VALUES (
            %s,
            spoint(radians(%s), radians(%s)),
            %s, %s, %s,
            %s, %s::jsonb, FALSE, %s,
            FALSE, 0
        )
        RETURNING id;
    """
    with conn.cursor() as cur:
        cur.execute(
            insert_query,
            (
                new_id,
                ra_deg,
                dec_deg,
                ra_deg,
                dec_deg,
                size_deg,
                epochs,
                json.dumps(tile_urls),
                mask_fraction,
            ),
        )
        conn.commit()

    logger.info("Successfully inserted new subject %s at (%.5f, %.5f)", new_id, ra_deg, dec_deg)
    return new_id, True


def update_job_status(
    conn,
    job_id: str,
    status: str,
    subject_id: str | None = None,
    error_message: str | None = None,
) -> None:
    """Update status of ingest_jobs row if the table and row exist."""
    try:
        uuid_obj = uuid.UUID(job_id)
    except (ValueError, AttributeError):
        return  # Not a valid UUID, e.g. placeholder string

    query = """
        UPDATE ingest_jobs
        SET status = %s::ingest_job_status,
            subject_id = %s,
            error_message = %s,
            updated_at = now()
        WHERE id = %s;
    """
    with conn.cursor() as cur:
        cur.execute(query, (status, subject_id, error_message, str(uuid_obj)))
        conn.commit()
