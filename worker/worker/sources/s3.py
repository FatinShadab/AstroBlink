"""Anonymous S3 client for SPHEREx data with scratch budget management.

Accesses the `nasa-irsa-spherex` bucket with unsigned requests (botocore.UNSIGNED).
See ARCHITECTURE.md §2.3, ROADMAP P1-07, docs/VERIFIED_FACTS.md §2.

Verified S3 Key Pattern:
qr2/level2/{YYYY}W{WW}_{step}/{l2b_pipeline_tag}/{detector}/level2_{YYYY}W{WW}_{step}_{exp_id}_{sub_exp}D{detector}_spx_{l2b_pipeline_tag}.fits

[VERIFY] Future DR1/DR2 key layout is unconfirmed until future data release.
"""

from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
import contextlib
import logging
import os
import shutil
import tempfile
import time
import urllib.parse
from typing import Any, Generator

from astropy.io import fits
from astropy.wcs import WCS
import boto3
from botocore import UNSIGNED
from botocore.config import Config
import numpy as np

from worker.config import settings
from worker.sources.irsa import fetch_cutout, find_exposures_at_position

logger = logging.getLogger(__name__)

# Single SPHEREx Level 2 MEF file is ~71.6 MB (~68.3 MiB).
# Scratch budget is ~500 MB (sufficient for ~5-7 full Level 2 files simultaneously).
SPHEREX_FILE_BYTES = 71634240
MAX_SCRATCH_BYTES = 500 * 1024 * 1024


def get_spherex_s3_client(
    connect_timeout: int = 10,
    read_timeout: int = 30,
    max_retries: int = 4,
    max_pool_connections: int = 10,
):
    """Create a boto3 S3 client with anonymous (unsigned) access and timeout/retry policy."""
    return boto3.client(
        "s3",
        region_name=settings.spherex_s3_region,
        config=Config(
            signature_version=UNSIGNED,
            connect_timeout=connect_timeout,
            read_timeout=read_timeout,
            retries={"max_attempts": max_retries + 1, "mode": "standard"},
            max_pool_connections=max_pool_connections,
        ),
    )


def _s3_get_range_with_retry(
    s3_client: Any,
    bucket: str,
    key: str,
    byte_start: int,
    byte_end: int,
    max_retries: int = 4,
    backoff_base: float = 1.0,
) -> tuple[bytes, int]:
    """Fetch an inclusive byte range [byte_start, byte_end] with 4 retries and exponential backoff.

    Handles both initial HTTP request errors and mid-stream body read timeouts.

    Returns:
        Tuple of (raw_bytes, retries_used).
    """
    expected_len = byte_end - byte_start + 1
    last_exc: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            resp = s3_client.get_object(
                Bucket=bucket,
                Key=key,
                Range=f"bytes={byte_start}-{byte_end}",
            )
            data = resp["Body"].read()
            if len(data) != expected_len and attempt < max_retries:
                raise IOError(f"Incomplete range read: got {len(data)} bytes, expected {expected_len}")
            return data, attempt
        except Exception as exc:
            last_exc = exc
            if attempt >= max_retries:
                break
            sleep_s = backoff_base * (2**attempt)
            logger.warning(
                "S3 range read retry %d/%d for %s [%d..%d] after %s (sleeping %.1fs)",
                attempt + 1,
                max_retries,
                key,
                byte_start,
                byte_end,
                exc,
                sleep_s,
            )
            time.sleep(sleep_s)
    raise RuntimeError(f"Failed S3 range read for {key} [{byte_start}..{byte_end}] after {max_retries} retries") from last_exc


def compute_cutout_bbox(
    img_hdr: fits.Header,
    ra: float,
    dec: float,
    size_deg: float = 0.1,
    margin: int = 8,
) -> dict[str, Any]:
    """Compute the native detector bounding box [x0:x1, y0:y1] for a sky cutout.

    Projects the 4 sky corners (and center) of the North-up `size_deg x size_deg` square
    through the exposure's full TAN-SIP WCS into native detector coordinates, then pads
    by `margin` pixels on each edge and clips to [0, NAXIS1] x [0, NAXIS2].
    """
    w = WCS(img_hdr)
    nx = int(img_hdr.get("NAXIS1", 2040))
    ny = int(img_hdr.get("NAXIS2", 2040))
    half = size_deg / 2.0
    cos_dec = max(float(np.cos(np.radians(dec))), 0.05)
    dra = half / cos_dec

    corners_ra = [ra - dra, ra + dra, ra + dra, ra - dra, ra]
    corners_dec = [dec - half, dec - half, dec + half, dec + half, dec]
    px, py = w.wcs_world2pix(corners_ra, corners_dec, 0)

    raw_xmin = float(np.min(px[:4]))
    raw_xmax = float(np.max(px[:4]))
    raw_ymin = float(np.min(py[:4]))
    raw_ymax = float(np.max(py[:4]))

    x0 = max(0, int(np.floor(raw_xmin)) - margin)
    x1 = min(nx, int(np.ceil(raw_xmax)) + margin + 1)
    y0 = max(0, int(np.floor(raw_ymin)) - margin)
    y1 = min(ny, int(np.ceil(raw_ymax)) + margin + 1)

    return {
        "x0": x0,
        "x1": x1,
        "y0": y0,
        "y1": y1,
        "nx": nx,
        "ny": ny,
        "raw_xmin": raw_xmin,
        "raw_xmax": raw_xmax,
        "raw_ymin": raw_ymin,
        "raw_ymax": raw_ymax,
        "corners_px": list(zip([float(v) for v in px[:4]], [float(v) for v in py[:4]])),
        "center_px": (float(px[4]), float(py[4])),
    }


def fetch_ranged_cutout(
    key: str,
    ra: float,
    dec: float,
    size_deg: float = 0.1,
    margin: int = 8,
    num_threads: int = 6,
    connect_timeout: int = 10,
    read_timeout: int = 30,
    max_retries: int = 4,
    s3_client: Any | None = None,
) -> dict[str, Any]:
    """Fetch cutout sub-arrays of IMAGE, FLAGS, and VARIANCE via parallel boto3 Range GETs.

    Uses `connect_timeout=10`, `read_timeout=30`, `max_retries=4` with exponential backoff,
    and 3 to 6 parallel worker threads to read the row strips covering the cutout.
    """
    n_workers = max(3, min(6, int(num_threads)))
    s3 = s3_client or get_spherex_s3_client(
        connect_timeout=connect_timeout,
        read_timeout=read_timeout,
        max_retries=max_retries,
        max_pool_connections=max(10, n_workers + 2),
    )
    bucket = settings.spherex_s3_bucket

    total_bytes = 0
    total_gets = 0
    total_retries = 0

    # 1. Read Primary + IMAGE header (first 32 KiB)
    head_bytes, r0 = _s3_get_range_with_retry(s3, bucket, key, 0, 32767, max_retries=max_retries)
    total_bytes += len(head_bytes)
    total_gets += 1
    total_retries += r0

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
    img_hdr_bytes = head_bytes[img_hdr_start:pos]
    img_hdr = fits.Header.fromstring(img_hdr_bytes.decode("ascii", errors="ignore"))
    img_data_start = pos

    bbox = compute_cutout_bbox(img_hdr, ra, dec, size_deg=size_deg, margin=margin)
    nx, ny = bbox["nx"], bbox["ny"]
    x0, x1, y0, y1 = bbox["x0"], bbox["x1"], bbox["y0"], bbox["y1"]
    data_len = nx * ny * 4  # 2040 * 2040 * 4 = 16,646,400 bytes (divisible by 2880)

    # 2. Locate FLAGS and VARIANCE data offsets (read up to 5 FITS blocks = 14,400 B per header)
    flg_hdr_start = img_data_start + data_len
    flg_head_bytes, r1 = _s3_get_range_with_retry(
        s3, bucket, key, flg_hdr_start, flg_hdr_start + 14399, max_retries=max_retries
    )
    total_bytes += len(flg_head_bytes)
    total_gets += 1
    total_retries += r1
    p_flg = 0
    while p_flg + 2880 <= len(flg_head_bytes):
        block = flg_head_bytes[p_flg : p_flg + 2880]
        p_flg += 2880
        if b"END     " in block:
            break
    flg_hdr = fits.Header.fromstring(flg_head_bytes[:p_flg].decode("ascii", errors="ignore"))
    flg_bzero = int(flg_hdr.get("BZERO", 0))
    flg_data_start = flg_hdr_start + p_flg

    var_hdr_start = flg_data_start + data_len
    var_head_bytes, r2 = _s3_get_range_with_retry(
        s3, bucket, key, var_hdr_start, var_hdr_start + 14399, max_retries=max_retries
    )
    total_bytes += len(var_head_bytes)
    total_gets += 1
    total_retries += r2
    p_var = 0
    while p_var + 2880 <= len(var_head_bytes):
        block = var_head_bytes[p_var : p_var + 2880]
        p_var += 2880
        if b"END     " in block:
            break
    var_data_start = var_hdr_start + p_var

    # 3. Partition the 3 extension row strips across n_workers (3 or 6 parallel tasks)
    n_rows = y1 - y0
    splits_per_ext = 2 if n_workers >= 6 and n_rows >= 2 else 1
    row_Mid = y0 + (n_rows // 2)

    tasks: list[tuple[str, int, int, int, int, str, int]] = []
    for ext_name, base_off, dtype_str, bzero_val in [
        ("IMAGE", img_data_start, ">f4", 0),
        ("FLAGS", flg_data_start, ">i4", flg_bzero),
        ("VARIANCE", var_data_start, ">f4", 0),
    ]:
        if splits_per_ext == 2:
            tasks.append((ext_name, 0, y0, row_Mid, base_off, dtype_str, bzero_val))
            tasks.append((ext_name, 1, row_Mid, y1, base_off, dtype_str, bzero_val))
        else:
            tasks.append((ext_name, 0, y0, y1, base_off, dtype_str, bzero_val))

    def _fetch_chunk(task: tuple[str, int, int, int, int, str, int]):
        ext_name, part_idx, r_start, r_end, base_off, dtype_str, bzero_val = task
        b_start = base_off + r_start * nx * 4
        b_end = base_off + r_end * nx * 4 - 1
        raw, retries = _s3_get_range_with_retry(
            s3, bucket, key, b_start, b_end, max_retries=max_retries
        )
        arr = np.frombuffer(raw, dtype=dtype_str).reshape((r_end - r_start, nx))[:, x0:x1]
        if dtype_str == ">f4":
            out_arr = np.asarray(arr, dtype=np.float32)
        else:
            if bzero_val != 0:
                out_arr = np.asarray(arr.astype(np.int64) + bzero_val, dtype=np.uint32).astype(np.int32)
            else:
                out_arr = np.asarray(arr, dtype=np.int32)
        return ext_name, part_idx, out_arr, len(raw), retries

    parts: dict[str, dict[int, np.ndarray]] = {"IMAGE": {}, "FLAGS": {}, "VARIANCE": {}}
    with ThreadPoolExecutor(max_workers=n_workers) as pool:
        for ext_name, part_idx, sub_arr, nbytes, retries in pool.map(_fetch_chunk, tasks):
            parts[ext_name][part_idx] = sub_arr
            total_bytes += nbytes
            total_gets += 1
            total_retries += retries

    out_arrays = {}
    for ext_name in ("IMAGE", "FLAGS", "VARIANCE"):
        ordered = [parts[ext_name][i] for i in sorted(parts[ext_name].keys())]
        out_arrays[ext_name] = np.vstack(ordered) if len(ordered) > 1 else ordered[0]

    return {
        "image_cutout": out_arrays["IMAGE"],
        "flags_cutout": out_arrays["FLAGS"],
        "variance_cutout": out_arrays["VARIANCE"],
        "image_header": img_hdr,
        "bbox": bbox,
        "bytes_transferred": total_bytes,
        "http_gets": total_gets,
        "retries_used": total_retries,
    }


def list_level2_exposures(prefix: str = "qr2/level2/", max_keys: int = 100) -> list[dict[str, Any]]:
    """List Level 2 FITS file keys under the given prefix.

    Args:
        prefix: S3 key prefix (defaults to verified 'qr2/level2/').
        max_keys: Maximum number of objects to list per page.

    Returns:
        List of object summary dicts containing 'Key' and 'Size'.
    """
    s3 = get_spherex_s3_client()
    paginator = s3.get_paginator("list_objects_v2")
    results = []
    for page in paginator.paginate(Bucket=settings.spherex_s3_bucket, Prefix=prefix):
        for item in page.get("Contents", []):
            if item["Key"].endswith(".fits"):
                results.append({"Key": item["Key"], "Size": item["Size"]})
                if len(results) >= max_keys:
                    return results
    return results


def find_candidate_files(
    ra: float,
    dec: float,
    size_deg: float = 0.1,
    min_cutout_coverage: float | None = None,
    target_wavelengths_um: list[float] | None = None,
    wavelength_tol_k: float | None = None,
    include_epoch_3: bool | None = None,
    max_candidates_per_det_epoch: int | None = None,
) -> dict[int, list[dict[str, Any]]]:
    """Find Level 2 candidate files covering (ra, dec), wavelength-matched across survey epochs.

    Uses the IRSA TAP spatial index, filters by detector footprint coverage, groups by
    data-driven observation epochs, and inspects WCS-WAVE lookup tables in S3 to select
    exposures matched in cutout wavelength across epochs with physical interval overlap.

    Returns:
        Dict mapping epoch integer (1, 2, 3...) to list of wavelength-matched exposure records.
    """
    candidates_by_epoch = find_exposures_at_position(
        ra=ra,
        dec=dec,
        size_deg=size_deg,
        min_cutout_coverage=min_cutout_coverage,
        target_wavelengths_um=target_wavelengths_um,
        wavelength_tol_k=wavelength_tol_k,
        include_epoch_3=include_epoch_3,
        max_candidates_per_det_epoch=max_candidates_per_det_epoch,
    )
    total_files = sum(len(v) for v in candidates_by_epoch.values())
    if total_files > 0:
        logger.info(
            "Found %d wavelength-matched candidate files across epochs %s for (%.4f, %.4f)",
            total_files,
            sorted(list(candidates_by_epoch.keys())),
            ra,
            dec,
        )
        return candidates_by_epoch
    logger.warning("No wavelength-matched candidate files discovered for (%.4f, %.4f)", ra, dec)
    return {}


def download_fits(key: str, local_path: str) -> str:
    """Download a FITS file from SPHEREx S3 to local scratch.

    Args:
        key: S3 object key.
        local_path: Destination path on local filesystem.

    Returns:
        The local path of the downloaded file.
    """
    os.makedirs(os.path.dirname(os.path.abspath(local_path)), exist_ok=True)
    s3 = get_spherex_s3_client()
    s3.download_file(settings.spherex_s3_bucket, key, local_path)
    return local_path


@contextlib.contextmanager
def fetch_fits_to_scratch(
    key: str,
    ra: float | None = None,
    dec: float | None = None,
    size_deg: float = 0.1,
    scratch_dir: str | None = None,
) -> Generator[str, None, None]:
    """Fetch a SPHEREx Level 2 FITS file into scratch space, with automatic cleanup.

    Attempt strategy:
    1. Prefer IRSA Cutout Service when available and coordinates are provided.
    2. Fall back to downloading the full Level 2 file from anonymous S3.
    3. Guarantees scratch cleanup on context exit.

    Yields:
        Local filesystem path to the FITS file.
    """
    base_scratch = scratch_dir or settings.fits_scratch_dir
    os.makedirs(base_scratch, exist_ok=True)
    temp_dir = tempfile.mkdtemp(dir=base_scratch, prefix="spx_job_")
    filename = os.path.basename(key)
    dest_path = os.path.join(temp_dir, filename)

    try:
        cutout_bytes = None
        if ra is not None and dec is not None:
            # Try cutout service first
            cutout_bytes = fetch_cutout(key, ra, dec, size_deg)

        if cutout_bytes:
            logger.info("Fetched cutout (%d bytes) for %s", len(cutout_bytes), key)
            with open(dest_path, "wb") as f:
                f.write(cutout_bytes)
        else:
            # Fall back to anonymous S3 download
            logger.info("Downloading full Level 2 file from S3: s3://%s/%s", settings.spherex_s3_bucket, key)
            download_fits(key, dest_path)

        yield dest_path

    finally:
        # Guarantee cleanup after use
        shutil.rmtree(temp_dir, ignore_errors=True)
        logger.debug("Cleaned up scratch directory: %s", temp_dir)
