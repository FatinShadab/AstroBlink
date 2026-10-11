"""IRSA SPHEREx Cutout Service and TAP query client.

Endpoint and query parameters verified per docs/VERIFIED_FACTS.md:
- TAP URL: https://irsa.ipac.caltech.edu/TAP/sync
- Cutout Base URL pattern: https://irsa.ipac.caltech.edu/ibe/data/spherex/{release_path_to_fits}
- Query parameters: center={ra},{dec} (or {ra},{dec}d) and size={size_deg}
- [VERIFY] Runtime Cutout HDU preservation (whether all MEF HDUs are intact in live returned cutouts).

See ARCHITECTURE.md §2.3, ROADMAP P1-07, docs/VERIFIED_FACTS.md.
"""

from __future__ import annotations

import json
import logging
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from worker.config import settings

logger = logging.getLogger(__name__)

IRSA_TAP_SYNC_URL = "https://irsa.ipac.caltech.edu/TAP/sync"


def find_exposures_at_position(
    ra: float,
    dec: float,
    bandpass: str | None = None,
    limit: int = 10,
    timeout_sec: float = 20.0,
) -> list[dict[str, Any]]:
    """Query IRSA TAP service for Level 2 exposures covering (ra, dec).

    Uses the verified ADQL query against spherex.artifact and spherex.plane.

    Args:
        ra: Right ascension in degrees [0, 360).
        dec: Declination in degrees [-90, 90].
        bandpass: Optional bandpass/detector filter (e.g. 'SPHEREx-D2' or 'SPHEREx-D1').
        limit: Maximum candidate exposures to return.
        timeout_sec: Network timeout for TAP query.

    Returns:
        List of dicts: [{'uri': ..., 's3_key': ..., 'mjd': ..., 'bandpass': ...}, ...]
    """
    bandpass_clause = f"AND p.energy_bandpassname = '{bandpass}'" if bandpass else ""
    adql_query = f"""
    SELECT TOP {limit} p.energy_bandpassname, a.uri, p.time_bounds_lower
    FROM spherex.artifact a
    JOIN spherex.plane p ON a.planeid = p.planeid
    WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)
      {bandpass_clause}
    ORDER BY p.time_bounds_lower
    """
    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "json",
        "QUERY": adql_query.strip(),
    }
    encoded = urllib.parse.urlencode(params)
    req = urllib.request.Request(f"{IRSA_TAP_SYNC_URL}?{encoded}")

    try:
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.warning("IRSA TAP spatial query failed: %s", exc)
        return []

    resources = data.get("VOTABLE", {}).get("RESOURCE_ARRAY", [])
    if not resources:
        return []

    table = resources[0].get("TABLE", {})
    field_array = table.get("FIELD_ARRAY", [])
    fields = [f.get("<xmlattr>", {}).get("name") for f in field_array]
    rows = table.get("DATA", {}).get("TABLEDATA", [])

    results = []
    for r in rows:
        row_dict = dict(zip(fields, r))
        uri = row_dict.get("uri", "")
        # uri from TAP is like "ibe/data/spherex/qr2/level2/..."
        # In S3 bucket, key is "qr2/level2/..."
        s3_key = uri
        if s3_key.startswith("ibe/data/spherex/"):
            s3_key = s3_key[len("ibe/data/spherex/"):]
        elif s3_key.startswith("/ibe/data/spherex/"):
            s3_key = s3_key[len("/ibe/data/spherex/"):]

        mjd_val = row_dict.get("time_bounds_lower")
        mjd = float(mjd_val) if mjd_val is not None else None

        results.append({
            "uri": uri,
            "s3_key": s3_key,
            "mjd": mjd,
            "bandpass": row_dict.get("energy_bandpassname", ""),
        })

    return results


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


def fetch_cutout(fits_rel_path: str, ra: float, dec: float, size_deg: float = 0.1, timeout_sec: float = 15.0) -> bytes | None:
    """Fetch a FITS cutout from the IRSA Cutout Service if operational.

    Returns None if the cutout service is unreachable, 503, or fails.
    """
    url = build_cutout_url(fits_rel_path, ra, dec, size_deg)
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
            if resp.status == 200:
                return resp.read()
    except Exception as exc:
        logger.info("Cutout service unavailable (%s): falling back to S3 download.", exc)
    return None
