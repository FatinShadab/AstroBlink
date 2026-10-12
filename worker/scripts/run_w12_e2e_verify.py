"""W12 Step 5 End-to-End Redis Ingestion & Tile Review Verification Script.

Enqueues Target 1, Target 3, and Target 4 (size_deg=0.5) into Redis (`astroblink:ingest_jobs`),
waits for the running worker container (`ab-worker-worker-1`) to process each job,
inspects the resulting PostgreSQL `subjects` rows and MinIO WebP/sidecar objects,
saves PNG review copies to `worker/tile_review/`, and generates JSON + Markdown tables
from program output.
"""

from __future__ import annotations

import io
import json
import os
import time
import uuid

import numpy as np
from PIL import Image
from psycopg2.extras import RealDictCursor
import redis

from worker.config import settings
from worker.db import get_db_connection
from worker.render.tiles import get_tile_s3_client

E2E_TARGETS = [
    {"name": "Target 1", "slug": "target1", "ra": 15.0, "dec": -20.0, "size_deg": 0.5},
    {"name": "Target 3", "slug": "target3", "ra": 180.0, "dec": 0.0, "size_deg": 0.5},
    {"name": "Target 4", "slug": "target4", "ra": 45.0, "dec": -45.0, "size_deg": 0.5},
]


def run_e2e_ingestion():
    conn = get_db_connection()
    r = redis.from_url(settings.redis_url, decode_responses=True)
    s3_tiles = get_tile_s3_client()

    out_review_dir = "/build/tile_review" if os.path.exists("/build") else r"D:\GITHUB\ME\astroblink-worker\worker\tile_review"
    os.makedirs(out_review_dir, exist_ok=True)

    # Ensure clean state in PostgreSQL, Redis, and MinIO before running the 3 targets
    r.delete(settings.redis_queue_key)
    with conn.cursor() as cur:
        cur.execute("DELETE FROM ingest_jobs; DELETE FROM subjects;")
        conn.commit()
    existing_objs = s3_tiles.list_objects_v2(Bucket=settings.tile_s3_bucket).get("Contents", [])
    for obj in existing_objs:
        s3_tiles.delete_object(Bucket=settings.tile_s3_bucket, Key=obj["Key"])

    results = []

    for tgt in E2E_TARGETS:
        job_id = str(uuid.uuid4())
        ra = tgt["ra"]
        dec = tgt["dec"]
        sz = tgt["size_deg"]

        print(f"Enqueuing {tgt['name']} (RA={ra}, Dec={dec}, size_deg={sz}) -> job_id={job_id}")
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO ingest_jobs (id, ra_deg, dec_deg, size_deg, status)
                VALUES (%s, %s, %s, %s, 'queued'::ingest_job_status);
                """,
                (job_id, ra, dec, sz),
            )
            conn.commit()

        t_push = time.perf_counter()
        payload = {"job_id": job_id, "ra": ra, "dec": dec, "size_deg": sz}
        r.lpush(settings.redis_queue_key, json.dumps(payload))

        # Poll ingest_jobs until completed or failed
        job_row = None
        while True:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute(
                    "SELECT id, status, subject_id, error_message, updated_at, created_at FROM ingest_jobs WHERE id = %s;",
                    (job_id,),
                )
                row = cur.fetchone()
            if row and row["status"] in ("completed", "failed"):
                job_row = dict(row)
                break
            if time.perf_counter() - t_push > 600.0:
                raise TimeoutError(f"Timed out waiting for worker to finish job {job_id}")
            time.sleep(0.5)

        wall_elapsed_s = round(time.perf_counter() - t_push, 2)
        print(f"  Job {job_id} finished with status={job_row['status']} in {wall_elapsed_s}s -> subject_id={job_row['subject_id']}")

        if job_row["status"] != "completed" or not job_row["subject_id"]:
            raise RuntimeError(f"Job {job_id} failed: {job_row.get('error_message')}")

        subject_id = str(job_row["subject_id"])
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                "SELECT id, ra_deg, dec_deg, size_deg, epochs, tile_urls, mask_fraction, retired, classification_count FROM subjects WHERE id = %s;",
                (subject_id,),
            )
            subj_row = dict(cur.fetchone())

        tile_urls = subj_row["tile_urls"]
        tile_reports = []
        total_tile_kb = 0.0
        job_runtime_s = wall_elapsed_s
        job_bytes_transferred = 0

        for tile_key in sorted(tile_urls.keys()):
            obj_key = tile_urls[tile_key]
            webp_bytes = s3_tiles.get_object(Bucket=settings.tile_s3_bucket, Key=obj_key)["Body"].read()
            sidecar_key = f"{subject_id}/{tile_key}.wcs.json"
            sidecar_bytes = s3_tiles.get_object(Bucket=settings.tile_s3_bucket, Key=sidecar_key)["Body"].read()
            sidecar = json.loads(sidecar_bytes.decode("utf-8"))

            if "job_runtime_s" in sidecar:
                job_runtime_s = float(sidecar["job_runtime_s"])
            if "job_bytes_transferred" in sidecar:
                job_bytes_transferred = int(sidecar["job_bytes_transferred"])

            # Decode WebP and save PNG review artifact
            pil_img = Image.open(io.BytesIO(webp_bytes))
            png_filename = f"{tgt['slug']}_{tile_key}.png"
            png_path = os.path.join(out_review_dir, png_filename)
            pil_img.save(png_path, format="PNG", optimize=True)
            png_kb = round(os.path.getsize(png_path) / 1024.0, 2)
            webp_kb = round(len(webp_bytes) / 1024.0, 2)
            total_tile_kb += webp_kb

            arr = np.asarray(pil_img)
            # Compute unique pixel intensities / RGB colors
            if arr.ndim == 3:
                flat_colors = arr.reshape(-1, arr.shape[-1])
                unique_colors = int(np.unique(flat_colors, axis=0).shape[0])
                unique_intensities = int(np.unique(arr[:, :, :3]).size)
            else:
                unique_colors = int(np.unique(arr).size)
                unique_intensities = unique_colors

            tile_reports.append({
                "tile_key": tile_key,
                "s3_key": obj_key,
                "webp_kb": webp_kb,
                "png_filename": png_filename,
                "png_kb": png_kb,
                "image_size": list(pil_img.size),
                "unique_rgba_tuples": unique_colors,
                "unique_channel_levels": unique_intensities,
                "epoch": sidecar.get("epoch"),
                "target_wavelength_um": sidecar.get("target_wavelength_um"),
                "wavelength_min_um": sidecar.get("wavelength_min_um"),
                "wavelength_max_um": sidecar.get("wavelength_max_um"),
                "shared_wavelength_min_um": sidecar.get("shared_wavelength_min_um"),
                "shared_wavelength_max_um": sidecar.get("shared_wavelength_max_um"),
                "shared_overlap_um": sidecar.get("shared_overlap_um"),
                "observation_mjd": sidecar.get("observation_mjd"),
                "observation_date_utc": sidecar.get("observation_date_utc"),
                "exposure_filename": sidecar.get("exposure_filename"),
                "detector": sidecar.get("detector"),
                "match_quality": sidecar.get("match_quality"),
                "mask_fraction": sidecar.get("mask_fraction"),
                "valid_fraction": sidecar.get("valid_fraction"),
            })

        results.append({
            "target_name": tgt["name"],
            "slug": tgt["slug"],
            "job_id": job_id,
            "subject_id": subject_id,
            "ra_deg": float(subj_row["ra_deg"]),
            "dec_deg": float(subj_row["dec_deg"]),
            "size_deg": float(subj_row["size_deg"]),
            "epochs": list(subj_row["epochs"]),
            "blinkable": len(subj_row["epochs"]) >= 2,
            "subject_mask_fraction": round(float(subj_row["mask_fraction"]), 4),
            "job_runtime_s": job_runtime_s,
            "wall_runtime_s": wall_elapsed_s,
            "bytes_transferred": job_bytes_transferred,
            "tiles_count": len(tile_reports),
            "total_webp_kb": round(total_tile_kb, 2),
            "tiles": tile_reports,
        })

    conn.close()
    r.close()

    out_dir = "/scratch" if os.path.exists("/scratch") else "."
    with open(os.path.join(out_dir, "w12_e2e_results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print("Saved results to w12_e2e_results.json")


if __name__ == "__main__":
    run_e2e_ingestion()
