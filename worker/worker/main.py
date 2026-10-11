"""AstroBlink Ingestion Worker entry point.

Consumes jobs from Redis list (BRPOP with 5s timeout).
A background daemon thread writes a heartbeat file at /tmp/heartbeat
for Docker HEALTHCHECK.

Pipeline steps:
1. Validate job payload (job_id, ra, dec, size_deg)
2. Check PostgreSQL for existing subject within 1″ (idempotent deduplication)
3. Discover candidate Level 2 FITS files covering (ra, dec) via IRSA TAP
4. Download candidate files to local scratch space with automatic cleanup
5. Parse MEF FITS (IMAGE, FLAGS, VARIANCE, WCS-WAVE)
6. Assign observation epochs (Survey 1..4)
7. Build target TAN cutout WCS common to all epochs & bands
8. Bin and mask pixels, reproject and co-add per (epoch, band)
9. Render WebP tiles (< 250 KB) with bad-pixel hatching overlay
10. Write WCS JSON sidecars for browser coordinate readout
11. Upload tiles and sidecars to S3 object store (MinIO in dev)
12. Insert subject row into PostgreSQL (spoint, epochs, tile_urls, mask_fraction)
13. Update ingest_jobs table status to 'completed'

See ARCHITECTURE.md §2.3.
"""

from __future__ import annotations

import json
import logging
import os
import signal
import sys
import threading
import time
import uuid

import numpy as np
import redis

from worker.config import settings
from worker.db import (
    find_existing_subject_nearby,
    get_db_connection,
    insert_subject,
    update_job_status,
)
from worker.processing.fits_parser import parse_mef_fits
from worker.processing.reproject import (
    build_target_wcs,
    determine_epoch,
    reproject_and_coadd,
)
from worker.render.tiles import render_tile_image, upload_tile
from worker.render.wcs_sidecar import build_wcs_sidecar_dict
from worker.sources.s3 import fetch_fits_to_scratch, find_candidate_files

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

# Graceful shutdown flag.
_shutdown = threading.Event()


def _heartbeat_writer() -> None:
    """Background daemon thread: writes Unix timestamp to heartbeat file."""
    while not _shutdown.is_set():
        try:
            with open(settings.heartbeat_path, "w") as f:
                f.write(str(int(time.time())))
        except OSError:
            pass
        _shutdown.wait(timeout=2)


def _handle_signal(signum: int, _frame: object) -> None:
    logger.info("Received signal %d, shutting down...", signum)
    _shutdown.set()


def process_job(payload: dict) -> str | None:
    """Process a single ingestion job end-to-end.

    Args:
        payload: IngestJobPayload dictionary (job_id, ra, dec, size_deg).

    Returns:
        Subject ID string on success, or None on failure/skip.
    """
    job_id = payload.get("job_id", str(uuid.uuid4()))
    ra = float(payload["ra"])
    dec = float(payload["dec"])
    size_deg = float(payload.get("size_deg", 0.1))

    logger.info("Processing job %s: (RA=%.5f, Dec=%.5f, size=%.3f)", job_id, ra, dec, size_deg)

    conn = get_db_connection()
    try:
        update_job_status(conn, job_id, "running")

        # Step 1: Idempotency check before heavy work
        existing = find_existing_subject_nearby(conn, ra, dec)
        if existing is not None:
            subj_id = str(existing["id"])
            logger.info("Subject %s already exists within 1″ of (%.5f, %.5f). Job completed (deduped).", subj_id, ra, dec)
            update_job_status(conn, job_id, "completed", subject_id=subj_id)
            return subj_id

        # Step 2: Spatial discovery of candidate exposures
        candidates = find_candidate_files(ra, dec, limit=2)
        if not candidates:
            err = f"No Level 2 exposures found covering (RA={ra}, Dec={dec})"
            logger.warning(err)
            update_job_status(conn, job_id, "failed", error_message=err)
            return None

        # Step 3: Download and parse candidate FITS files
        parsed_exposures = []
        for cand in candidates:
            s3_key = cand["s3_key"]
            try:
                with fetch_fits_to_scratch(s3_key, ra=ra, dec=dec, size_deg=size_deg) as local_fits:
                    exp_data = parse_mef_fits(local_fits)
                    exp_data["mjd"] = cand.get("mjd")
                    exp_data["epoch"] = determine_epoch(mjd=cand.get("mjd"))
                    parsed_exposures.append(exp_data)
            except Exception as exc:
                logger.warning("Failed to fetch or parse %s: %s", s3_key, exc)

        if not parsed_exposures:
            err = "Failed to parse any candidate exposures"
            logger.error(err)
            update_job_status(conn, job_id, "failed", error_message=err)
            return None

        # Step 4: Group exposures by epoch
        epochs_map: dict[int, list[dict]] = {}
        for exp in parsed_exposures:
            ep = exp["epoch"]
            epochs_map.setdefault(ep, []).append(exp)

        available_epochs = sorted(epochs_map.keys())
        logger.info("Found %d valid exposures across epochs: %s", len(parsed_exposures), available_epochs)

        # Step 5: Build common target WCS grid
        target_wcs, shape_out = build_target_wcs(ra, dec, size_deg=size_deg)

        # Step 6: Render and upload tiles per (epoch, band)
        subject_id = str(uuid.uuid4())
        tile_urls: dict[str, str] = {}
        total_pixels = 0
        total_masked_pixels = 0

        # Composite bands: 'swir', 'mwir', and 'rgb'
        single_bands = ["swir", "mwir"]

        for epoch in available_epochs:
            epoch_exps = epochs_map[epoch]

            # 1. Single bands (swir, mwir)
            for band in single_bands:
                coadd_img, mask = reproject_and_coadd(epoch_exps, target_wcs, shape_out, band)
                tile_bytes = render_tile_image(coadd_img, mask, fmt="webp", quality=85)
                obj_key = f"{subject_id}/{epoch}_{band}.webp"
                upload_tile(tile_bytes, obj_key, content_type="image/webp")
                tile_urls[f"{epoch}_{band}"] = obj_key

                # Upload JSON WCS sidecar
                sidecar_data = build_wcs_sidecar_dict(target_wcs, shape_out)
                sidecar_bytes = json.dumps(sidecar_data, indent=2).encode("utf-8")
                sidecar_key = f"{subject_id}/{epoch}_{band}.wcs.json"
                upload_tile(sidecar_bytes, sidecar_key, content_type="application/json")

                total_pixels += mask.size
                total_masked_pixels += int(np.sum(mask))

            # 2. False-color RGB (B=1.0um, G=2.0um, R=4.0um)
            coadd_b, mask_b = reproject_and_coadd(epoch_exps, target_wcs, shape_out, "rgb_b")
            coadd_g, mask_g = reproject_and_coadd(epoch_exps, target_wcs, shape_out, "rgb_g")
            coadd_r, mask_r = reproject_and_coadd(epoch_exps, target_wcs, shape_out, "rgb_r")

            rgb_stack = np.stack([coadd_r, coadd_g, coadd_b], axis=0)
            combined_rgb_mask = mask_r | mask_g | mask_b

            rgb_bytes = render_tile_image(rgb_stack, combined_rgb_mask, fmt="webp", quality=85)
            rgb_key = f"{subject_id}/{epoch}_rgb.webp"
            upload_tile(rgb_bytes, rgb_key, content_type="image/webp")
            tile_urls[f"{epoch}_rgb"] = rgb_key

            sidecar_rgb_key = f"{subject_id}/{epoch}_rgb.wcs.json"
            upload_tile(sidecar_bytes, sidecar_rgb_key, content_type="application/json")

            total_pixels += combined_rgb_mask.size
            total_masked_pixels += int(np.sum(combined_rgb_mask))

        avg_mask_fraction = float(total_masked_pixels) / float(total_pixels) if total_pixels > 0 else 0.0

        # Step 7: Insert subject row into PostgreSQL
        inserted_id, created = insert_subject(
            conn=conn,
            ra_deg=ra,
            dec_deg=dec,
            size_deg=size_deg,
            epochs=available_epochs,
            tile_urls=tile_urls,
            mask_fraction=avg_mask_fraction,
            subject_id=subject_id,
        )

        update_job_status(conn, job_id, "completed", subject_id=inserted_id)
        logger.info("Job %s completed successfully -> Subject ID: %s", job_id, inserted_id)
        return inserted_id

    except Exception as exc:
        logger.exception("Error processing job %s: %s", job_id, exc)
        update_job_status(conn, job_id, "failed", error_message=str(exc))
        return None
    finally:
        conn.close()


def main() -> None:
    """Main loop: BRPOP from Redis, process jobs."""
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Ensure scratch directory exists.
    os.makedirs(settings.fits_scratch_dir, exist_ok=True)

    # Start heartbeat thread.
    hb_thread = threading.Thread(target=_heartbeat_writer, daemon=True)
    hb_thread.start()
    logger.info("Heartbeat writer started at %s", settings.heartbeat_path)

    # Connect to Redis.
    r = redis.from_url(settings.redis_url, decode_responses=True)
    logger.info(
        "Worker started. Listening on Redis key '%s' (BRPOP timeout=%ds)",
        settings.redis_queue_key,
        settings.brpop_timeout,
    )

    while not _shutdown.is_set():
        try:
            result = r.brpop(settings.redis_queue_key, timeout=settings.brpop_timeout)
        except redis.ConnectionError:
            logger.error("Redis connection lost. Retrying in 5s...")
            _shutdown.wait(timeout=5)
            continue

        if result is None:
            # Timeout — no jobs. Loop continues, heartbeat keeps updating.
            continue

        _key, raw = result
        try:
            payload = json.loads(raw)
            process_job(payload)
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            logger.error("Invalid job payload: %s — %s", raw[:200], exc)

    logger.info("Worker shut down cleanly.")
    r.close()
    sys.exit(0)


if __name__ == "__main__":
    main()
