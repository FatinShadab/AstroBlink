"""IRSA SPHEREx Cutout Service and TAP query client.

Endpoint and query parameters verified per docs/VERIFIED_FACTS.md:
- TAP URL: https://irsa.ipac.caltech.edu/TAP/sync
- Cutout Base URL pattern: https://irsa.ipac.caltech.edu/ibe/data/spherex/{release_path_to_fits}
- Query parameters: center={ra},{dec} (or {ra},{dec}d) and size={size_deg}
- [VERIFY] Runtime Cutout HDU preservation (whether all MEF HDUs are intact in live returned cutouts).

See ARCHITECTURE.md §2.3, ROADMAP P1-07, docs/VERIFIED_FACTS.md.
"""

from __future__ import annotations

import binascii
from collections import defaultdict
import json
import logging
import math
import re
import struct
import urllib.error
import urllib.parse
import urllib.request
from typing import Any

from worker.config import settings

logger = logging.getLogger(__name__)

IRSA_TAP_SYNC_URL = "https://irsa.ipac.caltech.edu/TAP/sync"


def parse_poly_wkb(hex_wkb: str) -> list[tuple[float, float]]:
    """Parse PostGIS EWKB hex string into list of (lon, lat) polygon vertices."""
    raw = binascii.unhexlify(hex_wkb)
    # EWKB format: byteorder (1B), geom_type (4B), srid (4B), num_rings (4B), num_pts (4B)
    _geom_type, _srid, _num_rings, num_pts = struct.unpack("<IIII", raw[1:17])
    pts = []
    for i in range(num_pts):
        offset = 17 + i * 16
        x, y = struct.unpack("<dd", raw[offset : offset + 16])
        pts.append((x, y))
    return pts


def point_in_polygon(x: float, y: float, poly: list[tuple[float, float]]) -> bool:
    """Ray casting algorithm for point in spherical-planar polygon."""
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(1, n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xinters:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def normalize_poly_pts(pts: list[tuple[float, float]], ref_ra: float) -> list[tuple[float, float]]:
    """Normalize polygon RA coordinates near ref_ra to avoid 0/360 or 180/-180 wrap discontinuities."""
    norm = []
    for ra, dec in pts:
        d_ra = ra - ref_ra
        while d_ra > 180.0:
            d_ra -= 360.0
        while d_ra < -180.0:
            d_ra += 360.0
        norm.append((ref_ra + d_ra, dec))
    return norm


def cutout_coverage_fraction(
    ra: float,
    dec: float,
    poly_pts: list[tuple[float, float]],
    size_deg: float = 0.1,
    grid_n: int = 5,
) -> float:
    """Calculate the fraction of the cutout box covered by the exposure polygon.

    Samples an NxN point grid across the target cutout area.
    """
    norm_pts = normalize_poly_pts(poly_pts, ra)
    half = size_deg / 2.0
    cos_d = math.cos(math.radians(dec))
    # Correct for spherical RA convergence
    cos_d = max(cos_d, 0.01)
    ra_step = (size_deg / cos_d) / (grid_n - 1)
    dec_step = size_deg / (grid_n - 1)
    ra_start = ra - (size_deg / cos_d) / 2.0
    dec_start = dec - half

    inside_count = 0
    total_count = grid_n * grid_n
    for i in range(grid_n):
        cur_ra = ra_start + i * ra_step
        for j in range(grid_n):
            cur_dec = dec_start + j * dec_step
            if point_in_polygon(cur_ra, cur_dec, norm_pts):
                inside_count += 1
    return inside_count / float(total_count)


def detector_for_wavelength(wave_um: float) -> str:
    """Return the SPHEREx detector whose spectral bandpass covers wave_um (in microns)."""
    if wave_um < 1.11:
        return "SPHEREx-D1"
    elif wave_um < 1.63:
        return "SPHEREx-D2"
    elif wave_um < 2.42:
        return "SPHEREx-D3"
    elif wave_um < 3.82:
        return "SPHEREx-D4"
    elif wave_um < 4.42:
        return "SPHEREx-D5"
    else:
        return "SPHEREx-D6"


def cluster_exposures_into_epochs(
    exposures: list[dict[str, Any]],
    gap_days: float | None = None,
    cvz_span_days: float | None = None,
) -> dict[int, list[dict[str, Any]]]:
    """Group exposures sorted by MJD into survey epochs using data-driven temporal clustering.

    - Standard sky regions observe a pass cluster over ~10-30 days, separated by ~140-195 day gaps.
      When (mjd - prev_mjd) > gap_days (default 30.0 days, [VERIFY]), a new epoch starts.
    - Continuous Viewing Zone (CVZ) targets near the ecliptic poles have no 30-day gap;
      a new epoch starts when the elapsed span within the current epoch exceeds the 6-month
      survey sweep duration `cvz_span_days` (default 182.5 days, [VERIFY]).
    """
    gap_thresh = gap_days if gap_days is not None else settings.survey_epoch_gap_days
    span_thresh = cvz_span_days if cvz_span_days is not None else settings.cvz_epoch_span_days

    sorted_exps = sorted(exposures, key=lambda x: x.get("mjd") or 0.0)
    clusters: list[list[dict[str, Any]]] = []
    cur: list[dict[str, Any]] = []
    prev_mjd: float | None = None

    for exp in sorted_exps:
        mjd = exp.get("mjd")
        if mjd is None:
            cur.append(exp)
            continue
        if prev_mjd is None:
            cur.append(exp)
        elif (mjd - prev_mjd) > gap_thresh or (mjd - (cur[0].get("mjd") or mjd)) > span_thresh:
            clusters.append(cur)
            cur = [exp]
        else:
            cur.append(exp)
        prev_mjd = mjd

    if cur:
        clusters.append(cur)

    result: dict[int, list[dict[str, Any]]] = {}
    for idx, cluster in enumerate(clusters, 1):
        for item in cluster:
            item["epoch"] = idx
        result[idx] = cluster
    return result


def fetch_cutout_wavelength_range(
    s3_client: Any,
    bucket: str,
    s3_key: str,
    ra: float,
    dec: float,
    size_deg: float = 0.1,
) -> tuple[float, float, float] | None:
    """Fetch only the IMAGE WCS header and WCS-WAVE lookup table (~40 KB total via S3 Range)
    and compute (w_min, w_max, w_mid) in microns across the cutout footprint.

    No image arrays are downloaded.
    """
    from astropy.io import fits
    from astropy.wcs import WCS
    import numpy as np
    from scipy.interpolate import RegularGridInterpolator

    try:
        r_head = s3_client.get_object(Bucket=bucket, Key=s3_key, Range="bytes=0-31679")["Body"].read()
        r_tail = s3_client.get_object(Bucket=bucket, Key=s3_key, Range="bytes=-11520")["Body"].read()

        idx_img = r_head.find(b"XTENSION= 'IMAGE   '")
        if idx_img < 0:
            return None
        pos = idx_img
        hdr_end = min(len(r_head), idx_img + 2880 * 8)
        while pos < len(r_head):
            card = r_head[pos : pos + 80]
            pos += 80
            if card.startswith(b"END     "):
                hdr_end = ((pos + 2879) // 2880) * 2880
                break
        img_hdr = fits.Header.fromstring(r_head[idx_img:hdr_end].decode("ascii", errors="ignore"))
        nx = int(img_hdr.get("NAXIS1", 2040))
        ny = int(img_hdr.get("NAXIS2", 2040))
        wcs = WCS(img_hdr)

        idx_wave = r_tail.find(b"XTENSION= 'BINTABLE'")
        if idx_wave < 0:
            return None
        hdu_wave = fits.BinTableHDU.fromstring(r_tail[idx_wave : idx_wave + 2880 * 2])
        wave_table = hdu_wave.data

        half = size_deg / 2.0
        cos_d = max(math.cos(math.radians(dec)), 0.01)
        ra_min, ra_max = ra - half / cos_d, ra + half / cos_d
        dec_min, dec_max = dec - half, dec + half
        corners = [(ra_min, dec_min), (ra_max, dec_min), (ra_max, dec_max), (ra_min, dec_max)]
        pix_corners = [wcs.world_to_pixel_values(c_ra, c_dec) for c_ra, c_dec in corners]
        xs = [p[0] for p in pix_corners]
        ys = [p[1] for p in pix_corners]
        x_min, x_max = max(0, int(min(xs))), min(nx - 1, int(max(xs)))
        y_min, y_max = max(0, int(min(ys))), min(ny - 1, int(max(ys)))

        x_knots = np.squeeze(wave_table["X"])
        y_knots = np.squeeze(wave_table["Y"])
        vals = np.squeeze(wave_table["VALUES"])
        wave_grid = vals[:, :, 0]
        interp = RegularGridInterpolator(
            (y_knots, x_knots), wave_grid, method="linear", bounds_error=False, fill_value=None
        )
        grid_y, grid_x = np.meshgrid(
            np.linspace(y_min, y_max, 5), np.linspace(x_min, x_max, 5), indexing="ij"
        )
        cutout_waves = interp((grid_y, grid_x))
        w_min = float(np.min(cutout_waves))
        w_max = float(np.max(cutout_waves))
        w_mid = 0.5 * (w_min + w_max)
        return (w_min, w_max, w_mid)
    except Exception as exc:
        logger.debug("Failed to inspect WCS-WAVE for %s: %s", s3_key, exc)
        return None


def find_exposures_at_position(
    ra: float,
    dec: float,
    size_deg: float = 0.1,
    min_cutout_coverage: float | None = None,
    target_wavelengths_um: list[float] | None = None,
    wavelength_tol_k: float | None = None,
    include_epoch_3: bool | None = None,
    max_candidates_per_det_epoch: int | None = None,
    timeout_sec: float = 30.0,
    s3_client: Any = None,
) -> dict[int, list[dict[str, Any]]]:
    """Query IRSA TAP service and select wavelength-matched exposures across survey epochs.

    1. Filters exposures for >= `min_cutout_coverage` (default 95%) footprint overlap.
    2. Verifies detector key in URI matches `energy_bandpassname`.
    3. Groups exposures into survey epochs via data-driven temporal clustering (defaulting to
       epochs 1 and 2 unless `include_epoch_3=True`).
    4. Samples up to `max_candidates_per_det_epoch` exposures evenly spaced across each epoch
       (ensuring CVZ targets sample across the full epoch rather than only the first exposures).
    5. Per target wavelength, uses R from TAP (`energy_resolvingpower`) to set per-detector
       tolerance `tol = k * (lambda / R)` (default k=1.0).
    6. Applies deterministic tie-breaking when top candidates are within 0.002 um in error:
       (smaller error, then larger shared overlap, then earlier MJD).
    7. Rejects any matched pair whose cutout wavelength intervals do not physically overlap
       (requires `min(w_max) > max(w_min)` across matched epochs), and marks fragile matches
       (best_err > 60% of tolerance or shared overlap < 0.01 um) as `"marginal"`.
    """
    from concurrent.futures import ThreadPoolExecutor
    import os
    from astropy.time import Time
    import boto3
    from botocore import UNSIGNED
    from botocore.config import Config
    import numpy as np

    min_cov = min_cutout_coverage if min_cutout_coverage is not None else settings.min_cutout_coverage
    target_waves = target_wavelengths_um if target_wavelengths_um is not None else settings.target_wavelengths_um
    k_tol = wavelength_tol_k if wavelength_tol_k is not None else settings.wavelength_tol_k
    use_ep3 = include_epoch_3 if include_epoch_3 is not None else settings.include_epoch_3
    max_cands = (
        max_candidates_per_det_epoch
        if max_candidates_per_det_epoch is not None
        else settings.max_candidates_per_det_epoch
    )
    tie_tol_um = settings.tie_break_tol_um
    marginal_err_frac = settings.marginal_err_fraction
    marginal_min_ov = settings.marginal_min_overlap_um

    req_detectors = sorted(list({detector_for_wavelength(w) for w in target_waves}))
    det_list_sql = ", ".join(f"'{d}'" for d in req_detectors)

    adql_query = f"""
    SELECT a.uri, p.energy_bandpassname, p.time_bounds_lower, p.poly, p.energy_resolvingpower
    FROM spherex.artifact a
    JOIN spherex.plane p ON a.planeid = p.planeid
    WHERE 1 = CONTAINS(POINT('ICRS', {ra}, {dec}), p.poly)
      AND p.energy_bandpassname IN ({det_list_sql})
    ORDER BY p.time_bounds_lower
    """
    params = {
        "REQUEST": "doQuery",
        "LANG": "ADQL",
        "FORMAT": "json",
        "QUERY": adql_query.strip(),
    }
    encoded = urllib.parse.urlencode(params)
    tap_url = f"{IRSA_TAP_SYNC_URL}?{encoded}"

    import time

    data = None
    max_tap_retries = settings.tap_max_retries
    for attempt in range(max_tap_retries + 1):
        try:
            req = urllib.request.Request(tap_url)
            with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
                data = json.loads(resp.read().decode("utf-8"))
            break
        except Exception as exc:
            if attempt >= max_tap_retries:
                logger.warning("IRSA TAP spatial query failed after %d retries: %s", max_tap_retries, exc)
                return {}
            time.sleep(1.0 * (2**attempt))

    if data is None:
        return {}

    resources = data.get("VOTABLE", {}).get("RESOURCE_ARRAY", [])
    if not resources:
        return {}

    table = resources[0].get("TABLE", {})
    field_array = table.get("FIELD_ARRAY", [])
    fields = [f.get("<xmlattr>", {}).get("name") for f in field_array]
    rows = table.get("DATA", {}).get("TABLEDATA", [])

    eligible: list[dict[str, Any]] = []
    for r in rows:
        row_dict = dict(zip(fields, r))
        uri = row_dict.get("uri", "")
        bandpass = row_dict.get("energy_bandpassname", "")
        poly_hex = row_dict.get("poly", "")
        r_val = row_dict.get("energy_resolvingpower")
        resolving_power = float(r_val) if r_val is not None else 40.0

        # Confirm detector tag in file key matches energy_bandpassname if present
        m_det = re.search(r"_([0-9]D[1-6])_spx_", uri)
        if m_det:
            expected_bp = f"SPHEREx-{m_det.group(1)[-2:]}"
            if expected_bp != bandpass:
                logger.warning("Detector mismatch: URI %s has %s vs TAP %s", uri, expected_bp, bandpass)
                continue

        poly_pts = parse_poly_wkb(poly_hex)
        core_size_deg = min(float(size_deg), 0.1)
        cov = cutout_coverage_fraction(ra, dec, poly_pts, size_deg=core_size_deg)
        if cov < min_cov:
            continue

        s3_key = uri
        if s3_key.startswith("ibe/data/spherex/"):
            s3_key = s3_key[len("ibe/data/spherex/") :]
        elif s3_key.startswith("/ibe/data/spherex/"):
            s3_key = s3_key[len("/ibe/data/spherex/") :]

        mjd_val = row_dict.get("time_bounds_lower")
        mjd = float(mjd_val) if mjd_val is not None else None

        eligible.append({
            "uri": uri,
            "s3_key": s3_key,
            "mjd": mjd,
            "bandpass": bandpass,
            "coverage": cov,
            "resolving_power": resolving_power,
        })

    if not eligible:
        return {}

    epochs_map = cluster_exposures_into_epochs(eligible)
    allowed_epochs = [ep for ep in sorted(epochs_map.keys()) if ep in (1, 2) or (use_ep3 and ep == 3)]

    # Sample up to max_cands evenly spaced across each epoch & detector
    to_inspect: list[dict[str, Any]] = []
    for ep in allowed_epochs:
        ep_exps = epochs_map[ep]
        by_det: dict[str, list[dict[str, Any]]] = defaultdict(list)
        for item in ep_exps:
            by_det[item["bandpass"]].append(item)
        for det, d_items in by_det.items():
            if len(d_items) > max_cands:
                idxs = np.linspace(0, len(d_items) - 1, max_cands, dtype=int)
                sampled = [d_items[i] for i in idxs]
            else:
                sampled = d_items
            to_inspect.extend(sampled)

    if s3_client is None:
        s3_client = boto3.client(
            "s3",
            region_name=settings.spherex_s3_region,
            config=Config(
                signature_version=UNSIGNED,
                connect_timeout=settings.s3_connect_timeout,
                read_timeout=settings.s3_read_timeout,
                retries={"max_attempts": settings.s3_max_retries + 1, "mode": "standard"},
                max_pool_connections=25,
            ),
        )

    core_size_deg = min(float(size_deg), 0.1)

    def _inspect_one(item: dict[str, Any]) -> dict[str, Any] | None:
        res = fetch_cutout_wavelength_range(
            s3_client, settings.spherex_s3_bucket, item["s3_key"], ra, dec, size_deg=core_size_deg
        )
        if res is None:
            return None
        item["w_min"], item["w_max"], item["w_mid"] = res
        return item

    with ThreadPoolExecutor(max_workers=20) as ex:
        inspected = [r for r in ex.map(_inspect_one, to_inspect) if r is not None]

    by_ep_det: dict[int, dict[str, list[dict[str, Any]]]] = defaultdict(lambda: defaultdict(list))
    for item in inspected:
        by_ep_det[item["epoch"]][item["bandpass"]].append(item)

    selected_by_epoch: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for target_w in target_waves:
        det = detector_for_wavelength(target_w)
        # First pass: find the nominal minimum-error candidate per epoch
        prelim_by_ep: dict[int, list[dict[str, Any]]] = {}
        tol_by_ep: dict[int, float] = {}
        for ep in allowed_epochs:
            cands = by_ep_det[ep].get(det, [])
            if not cands:
                continue
            r_power = cands[0].get("resolving_power", 40.0)
            tol_um = k_tol * (target_w / r_power)
            tol_by_ep[ep] = tol_um
            sorted_cands = sorted(
                cands,
                key=lambda x: (abs(x["w_mid"] - target_w), x.get("mjd") or 0.0, x["s3_key"]),
            )
            if abs(sorted_cands[0]["w_mid"] - target_w) <= tol_um:
                prelim_by_ep[ep] = sorted_cands

        if len(prelim_by_ep) < 2:
            continue

        # Deterministic tie-break when top candidates in an epoch are within tie_tol_um (0.002 um):
        # Order: (larger shared overlap with other epochs' reference best, then earlier MJD)
        matched_for_wave: dict[int, dict[str, Any]] = {}
        for ep, sorted_cands in prelim_by_ep.items():
            tol_um = tol_by_ep[ep]
            min_err = abs(sorted_cands[0]["w_mid"] - target_w)
            near_ties = [
                c for c in sorted_cands
                if (abs(c["w_mid"] - target_w) - min_err) <= tie_tol_um and abs(c["w_mid"] - target_w) <= tol_um
            ]
            other_refs = [prelim_by_ep[o_ep][0] for o_ep in prelim_by_ep if o_ep != ep]
            if len(near_ties) > 1 and other_refs:
                def _tie_key(c: dict[str, Any]) -> tuple[float, float, str]:
                    sh_min = max([c["w_min"]] + [o["w_min"] for o in other_refs])
                    sh_max = min([c["w_max"]] + [o["w_max"] for o in other_refs])
                    sh_ov = max(0.0, sh_max - sh_min)
                    return (-round(sh_ov, 9), round(c.get("mjd") or 0.0, 9), c["s3_key"])

                near_ties = sorted(near_ties, key=_tie_key)
                best = near_ties[0]
                tie_broken = True
            else:
                best = sorted_cands[0]
                tie_broken = False

            best_err = abs(best["w_mid"] - target_w)
            sec_err = abs(sorted_cands[1]["w_mid"] - target_w) if len(sorted_cands) > 1 else None
            obs_mjd = best.get("mjd")
            obs_date_utc = (
                Time(obs_mjd, format="mjd", scale="utc").isot[:19] + "Z"
                if obs_mjd is not None
                else None
            )
            best_copy = dict(best)
            if float(size_deg) > core_size_deg:
                wide_res = fetch_cutout_wavelength_range(
                    s3_client, settings.spherex_s3_bucket, best["s3_key"], ra, dec, size_deg=float(size_deg)
                )
                if wide_res is not None:
                    best_copy["w_min"], best_copy["w_max"], _ = wide_res
            best_copy["target_wavelength_um"] = target_w
            best_copy["wavelength_min_um"] = best_copy["w_min"]
            best_copy["wavelength_max_um"] = best_copy["w_max"]
            best_copy["observation_mjd"] = obs_mjd
            best_copy["observation_date_utc"] = obs_date_utc
            best_copy["exposure_filename"] = os.path.basename(best["s3_key"])
            best_copy["detector"] = det.replace("SPHEREx-", "")
            best_copy["tol_um"] = tol_um
            best_copy["best_err_um"] = best_err
            best_copy["second_best_err_um"] = sec_err
            best_copy["candidates_examined"] = len(sorted_cands)
            best_copy["tie_broken"] = tie_broken
            matched_for_wave[ep] = best_copy

        # Require physical wavelength overlap across all matched epochs
        shared_w_min = max(m["w_min"] for m in matched_for_wave.values())
        shared_w_max = min(m["w_max"] for m in matched_for_wave.values())
        shared_overlap_um = shared_w_max - shared_w_min
        if shared_overlap_um > 0.0:
            is_marginal = (
                shared_overlap_um < marginal_min_ov
                or any(m["best_err_um"] > marginal_err_frac * m["tol_um"] for m in matched_for_wave.values())
            )
            match_quality = "marginal" if is_marginal else "good"
            for ep, exp_rec in matched_for_wave.items():
                exp_rec["shared_w_min"] = shared_w_min
                exp_rec["shared_w_max"] = shared_w_max
                exp_rec["shared_overlap_um"] = shared_overlap_um
                exp_rec["marginal"] = is_marginal
                exp_rec["match_quality"] = match_quality
                selected_by_epoch[ep].append(exp_rec)
        else:
            logger.info(
                "Rejected wavelength %.2f um group: no physical overlap (shared_min=%.4f >= shared_max=%.4f)",
                target_w,
                shared_w_min,
                shared_w_max,
            )

    return dict(selected_by_epoch)


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
