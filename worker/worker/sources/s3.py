"""Anonymous S3 client for SPHEREx data.

Accesses the `nasa-irsa-spherex` bucket with unsigned requests (botocore.UNSIGNED).
See ARCHITECTURE.md §2.3, ROADMAP P1-07, docs/VERIFIED_FACTS.md §2.

Verified S3 Key Pattern:
qr2/level2/{YYYY}W{WW}_{step}/{l2b_pipeline_tag}/{detector}/level2_{YYYY}W{WW}_{step}_{exp_id}_{sub_exp}D{detector}_spx_{l2b_pipeline_tag}.fits

[VERIFY] Future DR1/DR2 key layout is unconfirmed until future data release.
"""

import boto3
from botocore import UNSIGNED
from botocore.config import Config

from worker.config import settings


def get_spherex_s3_client():
    """Create a boto3 S3 client with anonymous (unsigned) access."""
    return boto3.client(
        "s3",
        region_name=settings.spherex_s3_region,
        config=Config(signature_version=UNSIGNED),
    )


def list_level2_exposures(prefix: str = "qr2/level2/", max_keys: int = 100) -> list[dict]:
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


def download_fits(key: str, local_path: str) -> str:
    """Download a FITS file from SPHEREx S3 to local scratch.

    Args:
        key: S3 object key.
        local_path: Destination path on local filesystem.

    Returns:
        The local path of the downloaded file.
    """
    s3 = get_spherex_s3_client()
    s3.download_file(settings.spherex_s3_bucket, key, local_path)
    return local_path
