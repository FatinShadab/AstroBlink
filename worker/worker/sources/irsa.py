"""IRSA SPHEREx Cutout Service client.

[VERIFY: OQ-1] Exact API query-string parameters are not documented.
[VERIFY: OQ-4] Base URL is a placeholder.
[VERIFY: OQ-7] Whether cutout preserves all 6 MEF HDUs.

Fallback: full-frame S3 download + local astropy Cutout2D.
See ARCHITECTURE.md \u00a72.3, ROADMAP P1-07, Risk R4.
"""

from worker.config import settings


def fetch_cutout(ra: float, dec: float, size_deg: float = 0.1) -> bytes:
    """Fetch a FITS cutout from the IRSA Cutout Service.

    Stub — raises NotImplementedError.
    Real implementation: HTTP GET to IRSA with position/size params.

    Args:
        ra: Right ascension in degrees [0, 360).
        dec: Declination in degrees [-90, 90].
        size_deg: Angular size of cutout in degrees.

    Returns:
        Raw FITS bytes.
    """
    # [VERIFY: OQ-1] Exact query params unknown.
    _url = f"{settings.irsa_cutout_base_url}?pos={ra},{dec}&size={size_deg}"
    raise NotImplementedError("IRSA cutout fetch not yet implemented.")
