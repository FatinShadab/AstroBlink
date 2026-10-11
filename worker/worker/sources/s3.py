"""Anonymous S3 client for SPHEREx data with scratch budget management.

Accesses the `nasa-irsa-spherex` bucket with unsigned requests (botocore.UNSIGNED).
See ARCHITECTURE.md §2.3, ROADMAP P1-07, docs/VERIFIED_FACTS.md §2.

Verified S3 Key Pattern:
qr2/level2/{YYYY}W{WW}_{step}/{l2b_pipeline_tag}/{detector}/level2_{YYYY}W{WW}_{step}_{exp_id}_{sub_exp}D{detector}_spx_{l2b_pipeline_tag}.fits

[VERIFY] Future DR1/DR2 key layout is unconfirmed until future data release.
"""

from __future__ import annotations

import contextlib
import logging
import os
import shutil
import tempfile
import urllib.parse
from typing import Any, Generator

import boto3
from botocore import UNSIGNED
from botocore.config import Config

from worker.config import settings
from worker.sources.irsa import fetch_cutout, find_exposures_at_position

logger = logging.getLogger(__name__)

# Single SPHEREx Level 2 MEF file is ~71.6 MB (~68.3 MiB).
# Scratch budget is ~500 MB (sufficient for ~5-7 full Level 2 files simultaneously).
SPHEREX_FILE_BYTES = 71634240
MAX_SCRATCH_BYTES = 500 * 1024 * 1024


def get_spherex_s3_client():
    """Create a boto3 S3 client with anonymous (unsigned) access."""
    return boto3.client(
        "s3",
        region_name=settings.spherex_s3_region,
        config=Config(signature_version=UNSIGNED),
    )


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


def find_candidate_files(ra: float, dec: float, limit: int = 6) -> list[dict[str, Any]]:
    """Find Level 2 candidate files covering (ra, dec).

    Uses the IRSA TAP spatial index. If TAP fails, returns an empty list.

    Returns:
        List of candidate exposure records with 's3_key', 'mjd', 'bandpass', etc.
    """
    candidates = find_exposures_at_position(ra, dec, limit=limit)
    if candidates:
        logger.info("Found %d candidate files for (%.4f, %.4f) via IRSA TAP", len(candidates), ra, dec)
        return candidates
    logger.warning("No candidate files discovered via IRSA TAP for (%.4f, %.4f)", ra, dec)
    return []


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
