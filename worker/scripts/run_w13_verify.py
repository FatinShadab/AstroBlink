"""W13 End-to-End Verification Script (Items 1, 2, 4, and 5).

1. Deletes Target 1 (RA=15.0, Dec=-20.0) subject and tiles from the ab-worker stack.
2. Re-ingests Target 1 (size_deg=0.5) via Redis (`astroblink:ingest_jobs`) and records
   per-tile valid_fraction, mask_fraction, WebP/PNG sizes, and bytes_transferred.
3. Computes the per-stage valid-pixel breakdown on Target 1, 1_1.0um (W12 buggy vs W13 fixed)
   and the native row-strip footprint coverage across Target 1's matched exposures.
4. Performs the inter-epoch blink check on Target 1, 1.0 um (Epoch 1 vs Epoch 2):
   star matching within 1.0 px, residual noise (1.4826 * MAD), usable blink fraction,
   and saves the difference image to `worker/tile_review/`.
5. Writes `/scratch/w13_results.json` and prints all Markdown tables from program output.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import io
import json
import math
import os
import time
import uuid

from astropy.wcs import WCS
import numpy as np
from PIL import Image
from psycopg2.extras import RealDictCursor
import redis
from scipy import ndimage as ndi
from scipy.interpolate import RegularGridInterpolator

from worker.config import settings
from worker.db import get_db_connection
from worker.processing.masking import (
    apply_airglow_mask,
    apply_flags_mask,
    apply_shared_wavelength_mask,
    combine_masks,
)
from worker.processing.reproject import build_target_wcs, reproject_wavelength_slice
from worker.render.tiles import get_tile_s3_client, render_tile_image
from worker.sources.s3 import (
    compute_cutout_bbox,
    fetch_ranged_cutout,
    fetch_wcs_wave_interpolator,
    get_spherex_s3_client,
)


def _legacy_compute_cutout_bbox_no_sip(img_hdr, ra: float, dec: float, size_deg: float = 0.5, margin: int = 8) -> dict:
    """Reproduce the W12 pre-fix compute_cutout_bbox (wcs_world2pix without SIP)."""
    w = WCS(img_hdr)
    nx = int(img_hdr.get("NAXIS1", 2040))
    ny = int(img_hdr.get("NAXIS2", 2040))
    half = size_deg / 2.0
    cos_dec = max(float(np.cos(np.radians(dec))), 0.05)
    dra = half / cos_dec
    corners_ra = [ra - dra, ra + dra, ra + dra, ra - dra, ra]
    corners_dec = [dec - half, dec - half, dec + half, dec + half, dec]
    px, py = w.wcs_world2pix(corners_ra, corners_dec, 0)
    raw_xmin, raw_xmax = float(np.min(px[:4])), float(np.max(px[:4]))
    raw_ymin, raw_ymax = float(np.min(py[:4])), float(np.max(py[:4]))
    return {
        "x0": max(0, int(np.floor(raw_xmin)) - margin),
        "x1": min(nx, int(np.ceil(raw_xmax)) + margin + 1),
        "y0": max(0, int(np.floor(raw_ymin)) - margin),
        "y1": min(ny, int(np.ceil(raw_ymax)) + margin + 1),
        "nx": nx,
        "ny": ny,
    }


def _compute_stage_breakdown(
    cutout_res: dict,
    target_wcs: WCS,
    shape_out: tuple[int, int],
    wave_interp: RegularGridInterpolator,
    shared_w_min: float,
    shared_w_max: float,
    bbox_override: dict | None = None,
) -> dict:
    img_cut = np.asarray(cutout_res["image_cutout"], dtype=np.float32)
    flg_cut = np.asarray(cutout_res["flags_cutout"], dtype=np.uint32)
    var_cut = np.asarray(cutout_res["variance_cutout"], dtype=np.float32)
    img_hdr = cutout_res["image_header"]
    bbox = cutout_res["bbox"]
    x0, x1, y0, y1 = int(bbox["x0"]), int(bbox["x1"]), int(bbox["y0"]), int(bbox["y1"])
    nx_det, ny_det = int(bbox["nx"]), int(bbox["ny"])

    bx0, bx1, by0, by1 = (
        (int(bbox_override["x0"]), int(bbox_override["x1"]), int(bbox_override["y0"]), int(bbox_override["y1"]))
        if bbox_override is not None
        else (x0, x1, y0, y1)
    )

    total_px = int(shape_out[0] * shape_out[1])
    wcs_in = WCS(img_hdr)

    ty_g, tx_g = np.meshgrid(
        np.arange(shape_out[0], dtype=np.float64),
        np.arange(shape_out[1], dtype=np.float64),
        indexing="ij",
    )
    sky_ra, sky_dec = target_wcs.pixel_to_world_values(tx_g, ty_g)
    px_det, py_det = wcs_in.world_to_pixel_values(sky_ra, sky_dec)

    in_full_det = (px_det >= 0) & (px_det <= nx_det - 1) & (py_det >= 0) & (py_det <= ny_det - 1)
    in_eval_bbox = (
        (px_det >= max(x0, bx0))
        & (px_det <= min(x1, bx1) - 1)
        & (py_det >= max(y0, by0))
        & (py_det <= min(y1, by1) - 1)
    )

    y_axis = np.arange(y0, y1, dtype=np.float64)
    x_axis = np.arange(x0, x1, dtype=np.float64)
    ny_g, nx_g = np.meshgrid(y_axis + 1.0, x_axis + 1.0, indexing="ij")
    w_native = np.asarray(wave_interp((ny_g, nx_g)), dtype=np.float64)

    w_target = np.full(shape_out, np.nan, dtype=np.float64)
    if np.any(in_full_det):
        w_target[in_full_det] = wave_interp((py_det[in_full_det] + 1.0, px_det[in_full_det] + 1.0))

    nan_var_native = (~np.isfinite(img_cut)) | (~np.isfinite(var_cut)) | (var_cut <= 1e-12)
    flags_native = apply_flags_mask(flg_cut, mask_transient_and_outlier=True)
    airglow_native = apply_airglow_mask(w_native)

    def _reproj_valid_mask(native_bad_mask: np.ndarray) -> np.ndarray:
        arr = np.ones_like(img_cut, dtype=np.float64)
        arr[native_bad_mask] = np.nan
        rgi = RegularGridInterpolator(
            (y_axis, x_axis), arr, method="linear", bounds_error=False, fill_value=np.nan
        )
        out = np.full(shape_out, np.nan, dtype=np.float64)
        if np.any(in_eval_bbox):
            out[in_eval_bbox] = rgi((py_det[in_eval_bbox], px_det[in_eval_bbox]))
        return np.isfinite(out)

    # Sequential cumulative stages on the 293x293 target grid:
    s0 = np.ones(shape_out, dtype=bool)
    s1 = in_eval_bbox.copy()
    s2 = _reproj_valid_mask(nan_var_native)
    s3 = _reproj_valid_mask(nan_var_native | flags_native | airglow_native)
    sh_mask = apply_shared_wavelength_mask(w_target, shared_w_min, shared_w_max)
    s4 = s3 & (~sh_mask)

    # Independent per-cause masks on the target grid
    ind_outside_cutout = int(np.sum(~in_eval_bbox))
    ind_nan_var = int(np.sum(in_eval_bbox & (~_reproj_valid_mask(nan_var_native))))
    ind_flags = int(np.sum(in_eval_bbox & (~_reproj_valid_mask(flags_native))))
    ind_airglow = int(np.sum(in_eval_bbox & (~_reproj_valid_mask(airglow_native))))
    ind_outside_shared_wave = int(np.sum(sh_mask))

    stages = [
        {
            "stage": "1. Outside fetched native cutout",
            "before_px": int(np.sum(s0)),
            "before_frac": round(float(np.mean(s0)), 4),
            "removed_px": int(np.sum(s0) - np.sum(s1)),
            "removed_frac": round(float(np.sum(s0) - np.sum(s1)) / total_px, 4),
            "after_px": int(np.sum(s1)),
            "after_frac": round(float(np.mean(s1)), 4),
            "independent_px": ind_outside_cutout,
            "independent_frac": round(ind_outside_cutout / total_px, 4),
        },
        {
            "stage": "2. NaN / non-positive variance masked",
            "before_px": int(np.sum(s1)),
            "before_frac": round(float(np.mean(s1)), 4),
            "removed_px": int(np.sum(s1) - np.sum(s2)),
            "removed_frac": round(float(np.sum(s1) - np.sum(s2)) / total_px, 4),
            "after_px": int(np.sum(s2)),
            "after_frac": round(float(np.mean(s2)), 4),
            "independent_px": ind_nan_var,
            "independent_frac": round(ind_nan_var / total_px, 4),
        },
        {
            "stage": "3. FLAGS (+ airglow) masked",
            "before_px": int(np.sum(s2)),
            "before_frac": round(float(np.mean(s2)), 4),
            "removed_px": int(np.sum(s2) - np.sum(s3)),
            "removed_frac": round(float(np.sum(s2) - np.sum(s3)) / total_px, 4),
            "after_px": int(np.sum(s3)),
            "after_frac": round(float(np.mean(s3)), 4),
            "independent_px": ind_flags,
            "independent_frac": round(ind_flags / total_px, 4),
        },
        {
            "stage": "4. Outside shared wavelength range",
            "before_px": int(np.sum(s3)),
            "before_frac": round(float(np.mean(s3)), 4),
            "removed_px": int(np.sum(s3) - np.sum(s4)),
            "removed_frac": round(float(np.sum(s3) - np.sum(s4)) / total_px, 4),
            "after_px": int(np.sum(s4)),
            "after_frac": round(float(np.mean(s4)), 4),
            "independent_px": ind_outside_shared_wave,
            "independent_frac": round(ind_outside_shared_wave / total_px, 4),
        },
    ]

    return {
        "total_px": total_px,
        "shared_w_min": round(shared_w_min, 6),
        "shared_w_max": round(shared_w_max, 6),
        "shared_overlap_um": round(shared_w_max - shared_w_min, 6),
        "final_valid_px": int(np.sum(s4)),
        "final_valid_frac": round(float(np.mean(s4)), 4),
        "final_mask_frac": round(1.0 - float(np.mean(s4)), 4),
        "stages": stages,
    }


def main():
    ra, dec, size_deg = 15.0, -20.0, 0.5
    conn = get_db_connection()
    r = redis.from_url(settings.redis_url, decode_responses=True)
    s3_tiles = get_tile_s3_client()

    out_review_dir = "/build/tile_review" if os.path.exists("/build") else r"D:\GITHUB\ME\astroblink-worker\worker\tile_review"
    os.makedirs(out_review_dir, exist_ok=True)

    # --- ITEM 4: Delete Target 1 ONLY from PostgreSQL and MinIO ---
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("SELECT id FROM subjects WHERE ABS(ra_deg - %s) < 1e-4 AND ABS(dec_deg - %s) < 1e-4;", (ra, dec))
        old_subjs = [str(row["id"]) for row in cur.fetchall()]

    deleted_tile_objs = 0
    for old_sid in old_subjs:
        objs = s3_tiles.list_objects_v2(Bucket=settings.tile_s3_bucket, Prefix=f"{old_sid}/").get("Contents", [])
        for obj in objs:
            s3_tiles.delete_object(Bucket=settings.tile_s3_bucket, Key=obj["Key"])
            deleted_tile_objs += 1

    with conn.cursor() as cur:
        cur.execute("DELETE FROM ingest_jobs WHERE ABS(ra_deg - %s) < 1e-4 AND ABS(dec_deg - %s) < 1e-4;", (ra, dec))
        del_jobs = cur.rowcount
        cur.execute("DELETE FROM subjects WHERE ABS(ra_deg - %s) < 1e-4 AND ABS(dec_deg - %s) < 1e-4;", (ra, dec))
        del_subjs = cur.rowcount
        conn.commit()

    print(f"Deleted old Target 1 records: {del_subjs} subjects ({old_subjs}), {del_jobs} ingest_jobs, {deleted_tile_objs} MinIO objects.")

    # Enqueue Target 1 into Redis and wait for worker completion
    job_id = str(uuid.uuid4())
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO ingest_jobs (id, ra_deg, dec_deg, size_deg, status)
            VALUES (%s, %s, %s, %s, 'queued'::ingest_job_status);
            """,
            (job_id, ra, dec, size_deg),
        )
        conn.commit()

    t_push = time.perf_counter()
    r.lpush(settings.redis_queue_key, json.dumps({"job_id": job_id, "ra": ra, "dec": dec, "size_deg": size_deg}))
    print(f"Enqueued Target 1 job_id={job_id}; waiting for ab-worker-worker-1...")

    job_row = None
    while True:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id, status, subject_id, error_message FROM ingest_jobs WHERE id = %s;", (job_id,))
            row = cur.fetchone()
        if row and row["status"] in ("completed", "failed"):
            job_row = dict(row)
            break
        if time.perf_counter() - t_push > 600.0:
            raise TimeoutError(f"Timed out waiting for job {job_id}")
        time.sleep(0.5)

    wall_s = round(time.perf_counter() - t_push, 2)
    if job_row["status"] != "completed" or not job_row["subject_id"]:
        raise RuntimeError(f"Target 1 job failed: {job_row}")

    subject_id = str(job_row["subject_id"])
    print(f"Target 1 completed in {wall_s}s -> subject_id={subject_id}")

    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(
            "SELECT id, ra_deg, dec_deg, size_deg, epochs, tile_urls, mask_fraction FROM subjects WHERE id = %s;",
            (subject_id,),
        )
        subj_row = dict(cur.fetchone())

    tile_urls = subj_row["tile_urls"]
    tile_reports = []
    job_runtime_s = wall_s
    job_bytes_transferred = 0
    s3_keys_by_tile: dict[str, str] = {}

    for tile_key in sorted(tile_urls.keys()):
        obj_key = tile_urls[tile_key]
        webp_bytes = s3_tiles.get_object(Bucket=settings.tile_s3_bucket, Key=obj_key)["Body"].read()
        sidecar_key = f"{subject_id}/{tile_key}.wcs.json"
        sidecar = json.loads(s3_tiles.get_object(Bucket=settings.tile_s3_bucket, Key=sidecar_key)["Body"].read().decode("utf-8"))

        if "job_runtime_s" in sidecar:
            job_runtime_s = float(sidecar["job_runtime_s"])
        if "job_bytes_transferred" in sidecar:
            job_bytes_transferred = int(sidecar["job_bytes_transferred"])
        if sidecar.get("exposure_filename"):
            s3_keys_by_tile[tile_key] = sidecar["exposure_filename"]

        pil_img = Image.open(io.BytesIO(webp_bytes))
        png_filename = f"target1_{tile_key}.png"
        png_path = os.path.join(out_review_dir, png_filename)
        pil_img.save(png_path, format="PNG", optimize=True)

        arr = np.asarray(pil_img)
        unique_rgba = int(np.unique(arr.reshape(-1, arr.shape[-1]), axis=0).shape[0]) if arr.ndim == 3 else int(np.unique(arr).size)

        tile_reports.append({
            "tile_key": tile_key,
            "webp_kb": round(len(webp_bytes) / 1024.0, 2),
            "png_filename": png_filename,
            "png_kb": round(os.path.getsize(png_path) / 1024.0, 2),
            "unique_rgba_tuples": unique_rgba,
            "wavelength_min_um": sidecar.get("wavelength_min_um"),
            "wavelength_max_um": sidecar.get("wavelength_max_um"),
            "shared_wavelength_min_um": sidecar.get("shared_wavelength_min_um"),
            "shared_wavelength_max_um": sidecar.get("shared_wavelength_max_um"),
            "shared_overlap_um": sidecar.get("shared_overlap_um"),
            "mask_fraction": sidecar.get("mask_fraction"),
            "valid_fraction": sidecar.get("valid_fraction"),
            "exposure_filename": sidecar.get("exposure_filename"),
            "observation_mjd": sidecar.get("observation_mjd"),
        })

    # --- ITEMS 1, 2, and 5: Fetch the 6 Target 1 cutouts in parallel to compute exact stage breakdown, footprint table, and 1.0um blink check ---
    t1_exposure_keys = {
        "1_1.0um": "qr2/level2/2025W25_1B/l2b-v20-2025-253/1/level2_2025W25_1B_0173_4D1_spx_l2b-v20-2025-253.fits",
        "2_1.0um": "qr2/level2/2025W52_2A/l2b-v22-2026-006/1/level2_2025W52_2A_0107_1D1_spx_l2b-v22-2026-006.fits",
        "1_2.0um": "qr2/level2/2025W27_2A/l2b-v20-2025-259/3/level2_2025W27_2A_0373_1D3_spx_l2b-v20-2025-259.fits",
        "2_2.0um": "qr2/level2/2025W51_1A/l2b-v21-2025-354/3/level2_2025W51_1A_0732_1D3_spx_l2b-v21-2025-354.fits",
        "1_4.0um": "qr2/level2/2025W27_1A/l2b-v20-2025-258/5/level2_2025W27_1A_0157_3D5_spx_l2b-v20-2025-258.fits",
        "2_4.0um": "qr2/level2/2025W52_1A/l2b-v21-2025-363/5/level2_2025W52_1A_0503_2D5_spx_l2b-v21-2025-363.fits",
    }
    s3_spherex = get_spherex_s3_client(max_pool_connections=30)

    def _load_header_only(key: str):
        from astropy.io import fits
        head_bytes = s3_spherex.get_object(Bucket=settings.spherex_s3_bucket, Key=key, Range="bytes=0-32767")["Body"].read()
        pos = 0
        while pos + 2880 <= len(head_bytes):
            block = head_bytes[pos : pos + 2880]
            pos += 2880
            if b"END     " in block:
                break
        img_hdr_start = pos
        while pos + 2880 <= len(head_bytes):
            block = head_bytes[pos : pos + 2880]
            pos += 2880
            if b"END     " in block:
                break
        return fits.Header.fromstring(head_bytes[img_hdr_start:pos].decode("ascii", errors="ignore"))

    def _load_1um(tk_and_key):
        tk, key = tk_and_key
        cut = fetch_ranged_cutout(key, ra, dec, size_deg=size_deg, s3_client=s3_spherex)
        wi, _ = fetch_wcs_wave_interpolator(key, s3_client=s3_spherex)
        return tk, key, cut, wi

    loaded: dict[str, tuple[str, dict, RegularGridInterpolator]] = {}
    with ThreadPoolExecutor(max_workers=2) as pool:
        for tk, key, cut, wi in pool.map(
            _load_1um,
            [("1_1.0um", t1_exposure_keys["1_1.0um"]), ("2_1.0um", t1_exposure_keys["2_1.0um"])],
        ):
            loaded[tk] = (key, cut, wi)

    headers_by_tk: dict[str, Any] = {
        "1_1.0um": loaded["1_1.0um"][1]["image_header"],
        "2_1.0um": loaded["2_1.0um"][1]["image_header"],
    }
    for tk in ["1_2.0um", "2_2.0um", "1_4.0um", "2_4.0um"]:
        headers_by_tk[tk] = _load_header_only(t1_exposure_keys[tk])

    target_wcs, shape_out = build_target_wcs(ra, dec, size_deg=size_deg)
    tot_px = int(shape_out[0] * shape_out[1])
    ty_g, tx_g = np.meshgrid(
        np.arange(shape_out[0], dtype=np.float64),
        np.arange(shape_out[1], dtype=np.float64),
        indexing="ij",
    )
    sky_ra, sky_dec = target_wcs.pixel_to_world_values(tx_g, ty_g)

    # Item 2: Footprint table across all 6 exposures of Target 1
    footprint_rows = []
    for tk in ["1_1.0um", "2_1.0um", "1_2.0um", "2_2.0um", "1_4.0um", "2_4.0um"]:
        key = t1_exposure_keys[tk]
        hdr = headers_by_tk[tk]
        wcs_in = WCS(hdr)
        nx_det = int(hdr.get("NAXIS1", 2040))
        ny_det = int(hdr.get("NAXIS2", 2040))
        px_det, py_det = wcs_in.world_to_pixel_values(sky_ra, sky_dec)

        in_native = (px_det >= 0) & (px_det <= nx_det - 1) & (py_det >= 0) & (py_det <= ny_det - 1)
        val_py = py_det[in_native]
        val_px = px_det[in_native]
        req_y0 = max(0, int(np.floor(np.min(val_py))))
        req_y1 = min(ny_det, int(np.ceil(np.max(val_py))) + 1)
        req_x0 = max(0, int(np.floor(np.min(val_px))))
        req_x1 = min(nx_det, int(np.ceil(np.max(val_px))) + 1)
        req_rows = req_y1 - req_y0

        old_bb = _legacy_compute_cutout_bbox_no_sip(hdr, ra, dec, size_deg=size_deg, margin=8)
        in_old_bb = (
            (px_det >= old_bb["x0"])
            & (px_det <= old_bb["x1"] - 1)
            & (py_det >= old_bb["y0"])
            & (py_det <= old_bb["y1"] - 1)
        )
        new_bb = compute_cutout_bbox(hdr, ra, dec, size_deg=size_deg, margin=8)
        in_new_bb = (
            (px_det >= new_bb["x0"])
            & (px_det <= new_bb["x1"] - 1)
            & (py_det >= new_bb["y0"])
            & (py_det <= new_bb["y1"] - 1)
        )
        footprint_rows.append({
            "tile_key": tk,
            "filename": os.path.basename(key),
            "in_native_px": int(np.sum(in_native)),
            "in_native_frac": round(float(np.mean(in_native)), 4),
            "req_y_range": [req_y0, req_y1],
            "req_rows": req_rows,
            "req_x_range": [req_x0, req_x1],
            "w12_old_y_range": [old_bb["y0"], old_bb["y1"]],
            "w12_old_rows": old_bb["y1"] - old_bb["y0"],
            "w12_old_in_bbox_px": int(np.sum(in_old_bb)),
            "w12_old_in_bbox_frac": round(float(np.mean(in_old_bb)), 4),
            "w13_new_y_range": [new_bb["y0"], new_bb["y1"]],
            "w13_new_rows": new_bb["y1"] - new_bb["y0"],
            "w13_new_in_bbox_px": int(np.sum(in_new_bb)),
            "w13_new_in_bbox_frac": round(float(np.mean(in_new_bb)), 4),
        })

    # Item 1: Stage breakdown on Target 1, 1_1.0um (W12 buggy 0.1-deg shared range vs W13 fixed 0.5-deg shared range)
    _, cut_1_1, wi_1_1 = loaded["1_1.0um"]
    _, cut_2_1, wi_2_1 = loaded["2_1.0um"]

    # W12 buggy shared range from core_size_deg=0.1: [0.983847, 0.998655]
    w12_buggy_1_1 = _compute_stage_breakdown(
        cut_1_1, target_wcs, shape_out, wi_1_1, 0.9838465822389244, 0.9986547102336011
    )
    # W13 fixed 0.5-deg shared range: [0.951595, 1.031168]
    rep_1_1 = reproject_wavelength_slice(cut_1_1, target_wcs, shape_out, None, None, wave_interp=wi_1_1)
    rep_2_1 = reproject_wavelength_slice(cut_2_1, target_wcs, shape_out, None, None, wave_interp=wi_2_1)
    true_sh_min = max(rep_1_1["cutout_w_min"], rep_2_1["cutout_w_min"])
    true_sh_max = min(rep_1_1["cutout_w_max"], rep_2_1["cutout_w_max"])

    w13_fixed_1_1 = _compute_stage_breakdown(
        cut_1_1, target_wcs, shape_out, wi_1_1, true_sh_min, true_sh_max
    )
    w13_fixed_2_1 = _compute_stage_breakdown(
        cut_2_1, target_wcs, shape_out, wi_2_1, true_sh_min, true_sh_max
    )

    # Item 5: Blink check on NEW tiles (Target 1, 1.0 um, Epoch 1 vs Epoch 2)
    sh_m1 = apply_shared_wavelength_mask(rep_1_1["wavelength_map"], true_sh_min, true_sh_max)
    sh_m2 = apply_shared_wavelength_mask(rep_2_1["wavelength_map"], true_sh_min, true_sh_max)
    img1 = rep_1_1["image"].copy()
    img1[sh_m1] = np.nan
    img2 = rep_2_1["image"].copy()
    img2[sh_m2] = np.nan
    mask1 = ~np.isfinite(img1)
    mask2 = ~np.isfinite(img2)

    joint_valid = np.isfinite(img1) & np.isfinite(img2)
    diff = np.full(shape_out, np.nan, dtype=np.float32)
    diff[joint_valid] = img2[joint_valid] - img1[joint_valid]

    diff_vals = diff[joint_valid]
    diff_med = float(np.median(diff_vals))
    diff_std = float(np.std(diff_vals))
    diff_mad = float(np.median(np.abs(diff_vals - diff_med)))
    robust_sigma = 1.4826 * diff_mad

    diff_scaled = np.clip((diff - (diff_med - 3.0 * robust_sigma)) / max(1e-6, 6.0 * robust_sigma), 0.0, 1.0)
    diff_u8 = (np.nan_to_num(diff_scaled, nan=0.0) * 255.0).astype(np.uint8)
    diff_rgb = np.stack([diff_u8, diff_u8, diff_u8], axis=-1)
    diff_rgb[~joint_valid] = [120, 30, 30]
    diff_pil = Image.fromarray(diff_rgb)
    p_diff_png = os.path.join(out_review_dir, "target1_1.0um_w13_diff.png")
    p_diff_webp = os.path.join(out_review_dir, "target1_1.0um_w13_diff.webp")
    diff_pil.save(p_diff_png, format="PNG", optimize=True)
    diff_pil.save(p_diff_webp, format="WEBP", quality=85)

    def _find_peaks(im_arr, mask_bad, sigma_thresh=5.0):
        good = np.isfinite(im_arr) & (~mask_bad)
        med = float(np.median(im_arr[good]))
        mad = float(np.median(np.abs(im_arr[good] - med)))
        sig = 1.4826 * mad
        thresh = med + sigma_thresh * sig
        filled = np.where(good, im_arr, -np.inf)
        local_max = ndi.maximum_filter(filled, size=5) == filled
        peaks = (im_arr > thresh) & local_max & good
        y_p, x_p = np.where(peaks)
        centroids = []
        for yp, xp in zip(y_p, x_p):
            y0, y1 = max(0, yp - 2), min(im_arr.shape[0], yp + 3)
            x0, x1 = max(0, xp - 2), min(im_arr.shape[1], xp + 3)
            sub = np.where(np.isfinite(im_arr[y0:y1, x0:x1]), im_arr[y0:y1, x0:x1] - med, 0.0)
            sub_pos = np.clip(sub, 0.0, None)
            total = float(np.sum(sub_pos))
            if total > 0:
                grid_y, grid_x = np.meshgrid(np.arange(y0, y1), np.arange(x0, x1), indexing="ij")
                cy = float(np.sum(grid_y * sub_pos) / total)
                cx = float(np.sum(grid_x * sub_pos) / total)
            else:
                cy, cx = float(yp), float(xp)
            centroids.append((cy, cx, float(im_arr[yp, xp])))
        return centroids

    stars1 = _find_peaks(img1, mask1, sigma_thresh=5.0)
    stars2 = _find_peaks(img2, mask2, sigma_thresh=5.0)
    # Also evaluate stars restricted to the joint_valid region
    stars1_joint = [s for s in stars1 if joint_valid[int(round(s[0])), int(round(s[1]))]]
    stars2_joint = [s for s in stars2 if joint_valid[int(round(s[0])), int(round(s[1]))]]

    matches = []
    for s1 in stars1:
        y1, x1, f1_val = s1
        dists = [math.hypot(y1 - s2[0], x1 - s2[1]) for s2 in stars2]
        if dists:
            min_d = min(dists)
            if min_d <= 1.0:
                idx2 = dists.index(min_d)
                matches.append({
                    "ep1_xy": [round(x1, 2), round(y1, 2)],
                    "ep2_xy": [round(stars2[idx2][1], 2), round(stars2[idx2][0], 2)],
                    "dist_px": round(min_d, 3),
                    "ep1_flux_mjy_sr": round(f1_val, 2),
                    "ep2_flux_mjy_sr": round(stars2[idx2][2], 2),
                })

    blink_check = {
        "grid_shape": list(shape_out),
        "total_px": tot_px,
        "ep1_valid_px": int(np.sum(~mask1)),
        "ep1_valid_frac": round(float(np.mean(~mask1)), 4),
        "ep2_valid_px": int(np.sum(~mask2)),
        "ep2_valid_frac": round(float(np.mean(~mask2)), 4),
        "joint_usable_blink_px": int(np.sum(joint_valid)),
        "joint_usable_blink_frac": round(float(np.mean(joint_valid)), 4),
        "stars_ep1_total": len(stars1),
        "stars_ep2_total": len(stars2),
        "stars_ep1_in_joint_valid": len(stars1_joint),
        "stars_ep2_in_joint_valid": len(stars2_joint),
        "stars_matched_within_1px": len(matches),
        "mean_offset_px": round(float(np.mean([m["dist_px"] for m in matches])), 3) if matches else None,
        "median_offset_px": round(float(np.median([m["dist_px"] for m in matches])), 3) if matches else None,
        "max_offset_px": round(float(np.max([m["dist_px"] for m in matches])), 3) if matches else None,
        "residual_median_mjy_sr": round(diff_med, 4),
        "residual_mad_mjy_sr": round(diff_mad, 4),
        "residual_robust_sigma_mjy_sr": round(robust_sigma, 4),
        "residual_std_mjy_sr": round(diff_std, 4),
        "diff_png_file": "target1_1.0um_w13_diff.png",
        "diff_webp_file": "target1_1.0um_w13_diff.webp",
    }

    output = {
        "item1_breakdown": {
            "w12_buggy_1_1.0um": w12_buggy_1_1,
            "w13_fixed_1_1.0um": w13_fixed_1_1,
            "w13_fixed_2_1.0um": w13_fixed_2_1,
        },
        "item2_footprint": footprint_rows,
        "item4_reingest": {
            "deleted_old_subject_ids": old_subjs,
            "deleted_minio_objects": deleted_tile_objs,
            "new_subject_id": subject_id,
            "new_job_id": job_id,
            "epochs": list(subj_row["epochs"]),
            "subject_mask_fraction": round(float(subj_row["mask_fraction"]), 4),
            "subject_valid_fraction": round(1.0 - float(subj_row["mask_fraction"]), 4),
            "job_runtime_s": job_runtime_s,
            "bytes_transferred": job_bytes_transferred,
            "tiles": tile_reports,
        },
        "item5_blink_check": blink_check,
    }

    out_dir = "/scratch" if os.path.exists("/scratch") else "."
    out_json_path = os.path.join(out_dir, "w13_results.json")
    with open(out_json_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)
    print(f"Saved W13 results to {out_json_path}")

    conn.close()
    r.close()


if __name__ == "__main__":
    main()
