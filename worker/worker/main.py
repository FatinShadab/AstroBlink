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
from worker.processing.masking import apply_shared_wavelength_mask
from worker.processing.reproject import (
    build_target_wcs,
    reproject_wavelength_slice,
)
from worker.render.tiles import render_tile_image, upload_tile
from worker.render.wcs_sidecar import build_wcs_sidecar_dict
from worker.sources.s3 import (
    fetch_ranged_cutout,
    fetch_wcs_wave_interpolator,
    find_candidate_files,
    get_spherex_s3_client,
)

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


def process_job(payload: dict) -> dict:
    """Process a single ingestion job end-to-end using wavelength-matched ranged cutouts.

    Args:
        payload: IngestJobPayload dictionary (job_id, ra, dec, optional size_deg).

    Returns:
        Structured result dictionary containing status ('completed', 'deduped',
        'rejected', or 'failed'), subject_id (or None), reason, and telemetry.
    """
    t0 = time.perf_counter()
    job_id = payload.get("job_id", str(uuid.uuid4()))
    ra = float(payload["ra"])
    dec = float(payload["dec"])
    size_deg = float(payload.get("size_deg", settings.default_size_deg))

    logger.info("Processing job %s: (RA=%.5f, Dec=%.5f, size=%.3f)", job_id, ra, dec, size_deg)

    conn = get_db_connection()
    try:
        update_job_status(conn, job_id, "running")

        # Step 1: Idempotency check before heavy work (within 1 arcsecond via pgSphere)
        existing = find_existing_subject_nearby(conn, ra, dec)
        if existing is not None:
            subj_id = str(existing["id"])
            logger.info(
                "Subject %s already exists within 1″ of (%.5f, %.5f). Job completed (deduped).",
                subj_id,
                ra,
                dec,
            )
            update_job_status(conn, job_id, "completed", subject_id=subj_id)
            return {
                "status": "deduped",
                "subject_id": subj_id,
                "reason": "existing_subject_within_1_arcsec",
                "epochs": list(existing.get("epochs") or []),
                "tile_urls": dict(existing.get("tile_urls") or {}),
                "mask_fraction": existing.get("mask_fraction"),
                "runtime_s": round(time.perf_counter() - t0, 3),
                "bytes_transferred": 0,
                "blinkable": len(existing.get("epochs") or []) >= 2,
            }

        # Step 2: Wavelength-matched candidate discovery across survey epochs
        candidates_by_epoch = find_candidate_files(
            ra=ra,
            dec=dec,
            size_deg=size_deg,
            target_wavelengths_um=settings.target_wavelengths_um,
            wavelength_tol_k=settings.wavelength_tol_k,
            include_epoch_3=settings.include_epoch_3,
            max_candidates_per_det_epoch=settings.max_candidates_per_det_epoch,
        )
        discovered_epochs = sorted(candidates_by_epoch.keys())
        if len(discovered_epochs) < 2:
            reason = f"fewer_than_2_matched_epochs: found {len(discovered_epochs)} matched epochs ({discovered_epochs})"
            logger.warning("Job %s rejected: %s", job_id, reason)
            update_job_status(conn, job_id, "failed", error_message=reason)
            return {
                "status": "rejected",
                "subject_id": None,
                "reason": reason,
                "epochs": discovered_epochs,
                "tile_urls": {},
                "runtime_s": round(time.perf_counter() - t0, 3),
                "bytes_transferred": 0,
                "blinkable": False,
            }

        # Step 3: Build common target TAN WCS grid at native 6.15"/px scale
        target_wcs, shape_out = build_target_wcs(ra, dec, size_deg=size_deg)

        # Group matched exposure records by target_wavelength_um -> epoch -> record
        by_wave_epoch: dict[float, dict[int, dict]] = {}
        for ep, exp_list in candidates_by_epoch.items():
            for exp_rec in exp_list:
                tw = float(exp_rec["target_wavelength_um"])
                by_wave_epoch.setdefault(tw, {})[ep] = exp_rec

        s3_client = get_spherex_s3_client(
            connect_timeout=settings.s3_connect_timeout,
            read_timeout=settings.s3_read_timeout,
            max_retries=settings.s3_max_retries,
            max_pool_connections=max(10, settings.s3_parallel_threads + 4),
        )

        total_bytes_transferred = 0
        # Store reprojected slices: epoch -> target_w -> slice_dict
        slices_by_epoch: dict[int, dict[float, dict]] = {}

        # Step 4: Fetch ranged cutouts and reproject with per-pixel shared-wavelength mask
        for target_w in sorted(by_wave_epoch.keys()):
            ep_records = by_wave_epoch[target_w]
            if len(ep_records) < 2:
                continue

            raw_slices: dict[int, dict] = {}
            for ep in sorted(ep_records.keys()):
                rec = ep_records[ep]
                s3_key = rec["s3_key"]
                try:
                    cutout_res = fetch_ranged_cutout(
                        s3_key,
                        ra=ra,
                        dec=dec,
                        size_deg=size_deg,
                        num_threads=settings.s3_parallel_threads,
                        connect_timeout=settings.s3_connect_timeout,
                        read_timeout=settings.s3_read_timeout,
                        max_retries=settings.s3_max_retries,
                        s3_client=s3_client,
                    )
                    total_bytes_transferred += int(cutout_res.get("bytes_transferred", 0))

                    wave_interp = None
                    if "wavelength_cutout" not in cutout_res:
                        wave_interp, wave_bytes = fetch_wcs_wave_interpolator(
                            s3_key,
                            s3_client=s3_client,
                            max_retries=settings.s3_max_retries,
                        )
                        total_bytes_transferred += int(wave_bytes)

                    reproj_res = reproject_wavelength_slice(
                        cutout_res=cutout_res,
                        target_wcs=target_wcs,
                        shape_out=shape_out,
                        shared_w_min=float(rec["shared_w_min"]),
                        shared_w_max=float(rec["shared_w_max"]),
                        wave_interp=wave_interp,
                        mask_transient_and_outlier=settings.mask_transient_and_outlier_flags,
                    )
                    raw_slices[ep] = {
                        "record": rec,
                        "reproj": reproj_res,
                    }
                except Exception as exc:
                    logger.warning(
                        "Failed ranged cutout or reprojection for %s (ep=%d, wave=%.1fum): %s",
                        s3_key,
                        ep,
                        target_w,
                        exc,
                    )

            if len(raw_slices) < 2:
                continue

            # Refine shared wavelength bounds on the target grid across all matched epochs for this slice
            valid_w_mins = [
                s["reproj"]["cutout_w_min"]
                for s in raw_slices.values()
                if np.isfinite(s["reproj"]["cutout_w_min"])
            ]
            valid_w_maxs = [
                s["reproj"]["cutout_w_max"]
                for s in raw_slices.values()
                if np.isfinite(s["reproj"]["cutout_w_max"])
            ]
            if valid_w_mins and valid_w_maxs and min(valid_w_maxs) > max(valid_w_mins):
                grid_sh_min = max(valid_w_mins)
                grid_sh_max = min(valid_w_maxs)
            else:
                first_rec = next(iter(raw_slices.values()))["record"]
                grid_sh_min = float(first_rec["shared_w_min"])
                grid_sh_max = float(first_rec["shared_w_max"])

            grid_sh_overlap = max(0.0, grid_sh_max - grid_sh_min)
            if grid_sh_overlap <= 0.0:
                logger.warning(
                    "Target grid shared overlap <= 0 for %.1f um (%.4f..%.4f); skipping slice.",
                    target_w,
                    grid_sh_min,
                    grid_sh_max,
                )
                continue

            # Enforce refined target-grid shared wavelength mask and verify valid pixels exist in >=2 epochs
            valid_ep_slices: dict[int, dict] = {}
            for ep, item in raw_slices.items():
                reproj = item["reproj"]
                sh_m = apply_shared_wavelength_mask(reproj["wavelength_map"], grid_sh_min, grid_sh_max)
                img = reproj["image"].copy()
                img[sh_m] = np.nan
                mask = ~np.isfinite(img)
                if np.all(mask):
                    continue
                total_px = int(mask.size)
                masked_px = int(np.sum(mask))
                m_frac = float(masked_px) / float(total_px)
                reproj["image"] = img
                reproj["mask"] = mask
                reproj["mask_fraction"] = m_frac
                reproj["valid_fraction"] = 1.0 - m_frac
                reproj["shared_w_min"] = grid_sh_min
                reproj["shared_w_max"] = grid_sh_max
                reproj["shared_overlap_um"] = grid_sh_overlap
                valid_ep_slices[ep] = {
                    "record": item["record"],
                    "reproj": reproj,
                }

            if len(valid_ep_slices) >= 2:
                for ep, item in valid_ep_slices.items():
                    slices_by_epoch.setdefault(ep, {})[target_w] = item

        available_epochs = sorted(slices_by_epoch.keys())
        if len(available_epochs) < 2:
            reason = f"fewer_than_2_matched_epochs: {len(available_epochs)} epochs had valid reprojected slices"
            logger.warning("Job %s rejected: %s", job_id, reason)
            update_job_status(conn, job_id, "failed", error_message=reason)
            return {
                "status": "rejected",
                "subject_id": None,
                "reason": reason,
                "epochs": available_epochs,
                "tile_urls": {},
                "runtime_s": round(time.perf_counter() - t0, 3),
                "bytes_transferred": total_bytes_transferred,
                "blinkable": False,
            }

        # Step 5: Render and upload narrow-slice tiles ("{epoch}_{wavelength}um") and "{epoch}_rgb"
        subject_id = str(uuid.uuid4())
        tile_urls: dict[str, str] = {}
        tiles_metadata: dict[str, dict] = {}
        tile_sizes_bytes: dict[str, int] = {}
        tile_mask_fractions: list[float] = []

        for epoch in available_epochs:
            ep_slices = slices_by_epoch[epoch]

            # 1. Narrow wavelength slices (e.g. 1_1.0um, 1_2.0um, 1_4.0um)
            for target_w in sorted(ep_slices.keys()):
                item = ep_slices[target_w]
                rec = item["record"]
                reproj = item["reproj"]
                tile_key = f"{epoch}_{target_w:.1f}um"

                tile_bytes = render_tile_image(reproj["image"], reproj["mask"], fmt="webp", quality=85)
                obj_key = f"{subject_id}/{tile_key}.webp"
                upload_tile(tile_bytes, obj_key, content_type="image/webp")
                tile_urls[tile_key] = obj_key
                tile_sizes_bytes[tile_key] = len(tile_bytes)
                tile_mask_fractions.append(float(reproj["mask_fraction"]))

                w_min_val = (
                    float(reproj["cutout_w_min"])
                    if np.isfinite(reproj["cutout_w_min"])
                    else float(rec["wavelength_min_um"])
                )
                w_max_val = (
                    float(reproj["cutout_w_max"])
                    if np.isfinite(reproj["cutout_w_max"])
                    else float(rec["wavelength_max_um"])
                )
                t_meta = {
                    "tile_key": tile_key,
                    "epoch": int(epoch),
                    "target_wavelength_um": float(target_w),
                    "wavelength_min_um": round(w_min_val, 6),
                    "wavelength_max_um": round(w_max_val, 6),
                    "shared_wavelength_min_um": round(float(reproj["shared_w_min"]), 6),
                    "shared_wavelength_max_um": round(float(reproj["shared_w_max"]), 6),
                    "shared_overlap_um": round(float(reproj["shared_overlap_um"]), 6),
                    "observation_mjd": rec.get("observation_mjd"),
                    "observation_date_utc": rec.get("observation_date_utc"),
                    "exposure_filename": rec.get("exposure_filename"),
                    "detector": rec.get("detector"),
                    "match_quality": rec.get("match_quality", "good"),
                    "marginal": bool(rec.get("marginal", False)),
                    "mask_fraction": round(float(reproj["mask_fraction"]), 6),
                    "valid_fraction": round(float(reproj["valid_fraction"]), 6),
                }
                tiles_metadata[tile_key] = t_meta

            # 2. False-color RGB ("{epoch}_rgb") ONLY if all three slices (1.0, 2.0, 4.0 um) exist in this epoch
            required_rgb_waves = [1.0, 2.0, 4.0]
            if all(w in ep_slices for w in required_rgb_waves):
                s_b = ep_slices[1.0]["reproj"]
                s_g = ep_slices[2.0]["reproj"]
                s_r = ep_slices[4.0]["reproj"]

                rgb_stack = np.stack([s_r["image"], s_g["image"], s_b["image"]], axis=0)
                combined_rgb_mask = s_r["mask"] | s_g["mask"] | s_b["mask"]

                if not np.all(combined_rgb_mask):
                    rgb_key = f"{epoch}_rgb"
                    rgb_bytes = render_tile_image(rgb_stack, combined_rgb_mask, fmt="webp", quality=85)
                    rgb_obj_key = f"{subject_id}/{rgb_key}.webp"
                    upload_tile(rgb_bytes, rgb_obj_key, content_type="image/webp")
                    tile_urls[rgb_key] = rgb_obj_key
                    tile_sizes_bytes[rgb_key] = len(rgb_bytes)

                    rgb_mask_frac = float(np.sum(combined_rgb_mask)) / float(combined_rgb_mask.size)
                    tile_mask_fractions.append(rgb_mask_frac)

                    tiles_metadata[rgb_key] = {
                        "tile_key": rgb_key,
                        "epoch": int(epoch),
                        "channels": {
                            "R": f"{epoch}_4.0um",
                            "G": f"{epoch}_2.0um",
                            "B": f"{epoch}_1.0um",
                        },
                        "mask_fraction": round(rgb_mask_frac, 6),
                        "valid_fraction": round(1.0 - rgb_mask_frac, 6),
                    }

        # Upload WCS JSON sidecar next to every produced tile
        for tile_key in tile_urls:
            sidecar_data = build_wcs_sidecar_dict(
                target_wcs,
                shape_out,
                tiles_metadata=tiles_metadata,
                tile_metadata=tiles_metadata.get(tile_key),
            )
            sidecar_bytes = json.dumps(sidecar_data, indent=2).encode("utf-8")
            sidecar_key = f"{subject_id}/{tile_key}.wcs.json"
            upload_tile(sidecar_bytes, sidecar_key, content_type="application/json")

        avg_mask_fraction = float(np.mean(tile_mask_fractions)) if tile_mask_fractions else 0.0

        # Step 6: Insert subject row into PostgreSQL using existing schema only
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

        elapsed_s = round(time.perf_counter() - t0, 3)
        update_job_status(conn, job_id, "completed", subject_id=inserted_id)
        logger.info(
            "Job %s completed in %.2fs -> Subject ID: %s (epochs=%s, tiles=%d, bytes=%d)",
            job_id,
            elapsed_s,
            inserted_id,
            available_epochs,
            len(tile_urls),
            total_bytes_transferred,
        )
        return {
            "status": "completed" if created else "deduped",
            "subject_id": inserted_id,
            "epochs": available_epochs,
            "tile_urls": tile_urls,
            "tile_sizes_bytes": tile_sizes_bytes,
            "tiles_metadata": tiles_metadata,
            "mask_fraction": avg_mask_fraction,
            "runtime_s": elapsed_s,
            "bytes_transferred": total_bytes_transferred,
            "blinkable": len(available_epochs) >= 2,
        }

    except Exception as exc:
        logger.exception("Error processing job %s: %s", job_id, exc)
        update_job_status(conn, job_id, "failed", error_message=str(exc))
        return {
            "status": "failed",
            "subject_id": None,
            "reason": str(exc),
            "runtime_s": round(time.perf_counter() - t0, 3),
        }
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
