"""Anonymous S3 client for SPHEREx data.

Accesses the `nasa-irsa-spherex` bucket with unsigned requests.
See ARCHITECTURE.md \u00a72.3, ROADMAP P1-07.

Key layout: qr2/level2/, qr3/  [VERIFY: OQ-3 for DR1/DR2]
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


def list_level2_exposures(prefix: str = "qr2/level2/") -> list[str]:
    """List Level 2 FITS file keys under the given prefix.

    Stub — returns empty list.
    Real implementation: paginate s3.list_objects_v2().
    """
    # See ROADMAP P1-07
    return []


def download_fits(key: str, local_path: str) -> str:
    """Download a FITS file from SPHEREx S3 to local scratch.

    Stub — raises NotImplementedError.
    Real implementation: s3.download_file(bucket, key, local_path).
    """
    # See ROADMAP P1-07
    raise NotImplementedError("S3 download not yet implemented.")
