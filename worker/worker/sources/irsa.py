"""IRSA SPHEREx Cutout Service client.

Endpoint and query parameters verified per docs/VERIFIED_FACTS.md:
- Base URL pattern: https://irsa.ipac.caltech.edu/ibe/data/spherex/{release_path_to_fits}
- Query parameters: center={ra},{dec} (or {ra},{dec}d) and size={size_deg}
- Note: Live Cutout service returned HTTP 503 during de-risking; S3 download is primary fallback.
- [VERIFY] Runtime Cutout HDU preservation (whether all MEF HDUs are intact in live returned cutouts).

See ARCHITECTURE.md §2.3, ROADMAP P1-07, docs/VERIFIED_FACTS.md.
"""

from worker.config import settings


def build_cutout_url(fits_rel_path: str, ra: float, dec: float, size_deg: float = 0.1) -> str:
    """Build the verified IRSA IBE SPHEREx cutout URL.

    Args:
        fits_rel_path: Relative path to FITS file, e.g.
            'qr2/level2/2025W17_4B/l2b-v20-2025-240/2/level2_2025W17_4B_0001_1D2_spx_l2b-v20-2025-240.fits'
        ra: Right ascension in degrees [0, 360).
        dec: Declination in degrees [-90, 90].
        size_deg: Angular cutout size in degrees.

    Returns:
        Full cutout URL with verified query parameters.
    """
    clean_path = fits_rel_path.lstrip("/")
    base = settings.irsa_cutout_base_url.rstrip("/")
    return f"{base}/{clean_path}?center={ra},{dec}d&size={size_deg}"


def fetch_cutout(fits_rel_path: str, ra: float, dec: float, size_deg: float = 0.1) -> bytes:
    """Fetch a FITS cutout from the IRSA Cutout Service.

    Args:
        fits_rel_path: Relative path to FITS file.
        ra: Right ascension in degrees [0, 360).
        dec: Declination in degrees [-90, 90].
        size_deg: Angular size of cutout in degrees.

    Returns:
        Raw FITS bytes.
    """
    url = build_cutout_url(fits_rel_path, ra, dec, size_deg)
    # [VERIFY] Live cutout payload preservation when IRSA IBE service is operational.
    raise NotImplementedError(f"IRSA cutout fetch not yet active for {url}; use S3 fallback.")
