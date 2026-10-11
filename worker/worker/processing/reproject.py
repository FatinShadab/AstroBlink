"""Reprojection and co-addition onto a common celestial WCS grid.

Pixel scale: 6.15 arcsec/pixel (nominal SPHEREx detector scale, docs/VERIFIED_FACTS.md §5).
Default cutout: 0.1 deg x 0.1 deg (~59 x 59 pixels).

Epoch grouping:
- Observation date / MJD mapped to Survey 1..4 per PRD §6.1 / mission timeline:
  - Survey 1: 2025-05-01 (MJD 60796) to 2025-10-31 (MJD 60979)
  - Survey 2: 2025-11-01 (MJD 60980) to 2026-05-31 (MJD 61191)
  - Survey 3: 2026-06-01 (MJD 61192) to 2026-12-31 (MJD 61405)
  - Survey 4: 2027-01-01 (MJD 61406) to 2027-06-30 (MJD 61586)
- [VERIFY] Exact survey epoch date boundaries from flight operations timeline.

Co-addition rule:
- Inverse-variance weighting: weight = 1.0 / VARIANCE for valid, unmasked pixels.
- Mask propagation: output pixel masked if ALL contributing input pixels were masked,
  or if there is no coverage from any exposure.
- Blinkability rule: A subject with fewer than 2 distinct epochs must be flagged as not blinkable.

See ARCHITECTURE.md §2.3, PRD §6.1, ROADMAP P1-11.
"""

from __future__ import annotations

import logging
import math
from typing import Any

from astropy.time import Time
from astropy.wcs import WCS
import numpy as np
from reproject import reproject_interp

from worker.processing.binning import get_band_pixels
from worker.processing.masking import apply_airglow_mask, apply_flags_mask, combine_masks

logger = logging.getLogger(__name__)

# Nominal detector pixel scale in arcseconds (VERIFIED_FACTS.md §5)
PIXEL_SCALE_ARCSEC: float = 6.15
PIXEL_SCALE_DEG: float = PIXEL_SCALE_ARCSEC / 3600.0

# [VERIFY] Survey epoch MJD boundaries
SURVEY_EPOCHS_MJD: list[tuple[int, float, float]] = [
    (1, 60796.0, 60979.999),  # 2025-05-01 to 2025-10-31
    (2, 60980.0, 61191.999),  # 2025-11-01 to 2026-05-31
    (3, 61192.0, 61405.999),  # 2026-06-01 to 2026-12-31
    (4, 61406.0, 61586.999),  # 2027-01-01 to 2027-06-30
]


def determine_epoch(mjd: float | None = None, date_obs: str | None = None) -> int:
    """Determine survey epoch index (1..4) from observation MJD or ISO date string.

    Args:
        mjd: Observation Modified Julian Day.
        date_obs: Optional ISO observation timestamp string (e.g. '2025-06-15T12:00:00').

    Returns:
        Epoch integer (1, 2, 3, or 4). Defaults to 1 if prior to Survey 1.
    """
    if mjd is None and date_obs is not None:
        try:
            mjd = Time(date_obs).mjd
        except Exception:
            mjd = None

    if mjd is None:
        # Fallback default epoch if no timing metadata available
        return 1

    for epoch_idx, mjd_start, mjd_end in SURVEY_EPOCHS_MJD:
        if mjd_start <= mjd <= mjd_end:
            return epoch_idx

    if mjd < SURVEY_EPOCHS_MJD[0][1]:
        return 1
    return 4


def build_target_wcs(
    ra_center: float,
    dec_center: float,
    size_deg: float = 0.1,
    pixel_scale_arcsec: float = PIXEL_SCALE_ARCSEC,
) -> tuple[WCS, tuple[int, int]]:
    """Build a standard gnomonic (TAN) WCS centered on (ra_center, dec_center).

    Args:
        ra_center: Central RA in degrees [0, 360).
        dec_center: Central Dec in degrees [-90, 90].
        size_deg: Angular cutout size in degrees.
        pixel_scale_arcsec: Pixel scale in arcsec/pixel.

    Returns:
        Tuple of (target_wcs, (ny, nx)) where ny, nx are the output grid dimensions.
    """
    deg_per_pixel = pixel_scale_arcsec / 3600.0
    # Number of pixels along each axis
    npix = max(1, int(math.ceil(size_deg / deg_per_pixel)))
    # Ensure square grid
    nx = npix
    ny = npix

    w = WCS(naxis=2)
    w.wcs.crpix = [(nx + 1.0) / 2.0, (ny + 1.0) / 2.0]
    w.wcs.crval = [ra_center, dec_center]
    # Standard astronomical orientation: RA increases left (-CDELT1), Dec increases up (+CDELT2)
    w.wcs.cdelt = [-deg_per_pixel, deg_per_pixel]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]

    return w, (ny, nx)


def reproject_and_coadd(
    exposures: list[dict[str, Any]],
    target_wcs: WCS,
    shape_out: tuple[int, int],
    band: str,
) -> tuple[np.ndarray, np.ndarray]:
    """Reproject exposures matching the given band onto target_wcs and co-add them.

    Uses inverse-variance weighting:
        coadd = sum(image_i * weight_i) / sum(weight_i)
    Propagates a separate boolean mask:
        pixel is masked (True) if no unmasked input pixels contributed.

    Args:
        exposures: List of exposure dicts containing parsed data:
                   'image', 'flags', 'variance', 'wavelength_map', 'wcs'
        target_wcs: Output astropy.wcs.WCS.
        shape_out: (ny, nx) output grid shape.
        band: Spectral composite band ('swir', 'mwir', etc.).

    Returns:
        Tuple of:
        - coadd_image: 2D float32 ndarray (NaN or 0.0 where unobserved/fully masked)
        - mask_array: 2D bool ndarray (True = masked / no valid data)
    """
    sum_weight = np.zeros(shape_out, dtype=np.float64)
    weighted_sum = np.zeros(shape_out, dtype=np.float64)
    coverage_count = np.zeros(shape_out, dtype=np.int32)

    for exp in exposures:
        img = exp["image"]
        var = exp["variance"]
        flags = exp["flags"]
        waves = exp["wavelength_map"]
        wcs_in = exp["wcs"]

        flags_m = apply_flags_mask(flags)
        airglow_m = apply_airglow_mask(waves)
        bad_mask = combine_masks(flags_m, airglow_m)

        band_img, band_weights, band_valid = get_band_pixels(
            img, var, waves, band, bad_pixel_mask=bad_mask
        )

        if not np.any(band_valid):
            continue

        # Zero out invalid pixels for reprojection
        safe_img = np.where(band_valid, band_img, 0.0).astype(np.float32)
        safe_wt = np.where(band_valid, band_weights, 0.0).astype(np.float32)

        # Reproject image * weight and weight
        weighted_img = (safe_img * safe_wt).astype(np.float32)
        reproj_weighted_img, _ = reproject_interp(
            (weighted_img, wcs_in),
            target_wcs,
            shape_out=shape_out,
        )
        reproj_wt, _ = reproject_interp(
            (safe_wt, wcs_in),
            target_wcs,
            shape_out=shape_out,
        )

        valid_reproj = np.isfinite(reproj_weighted_img) & np.isfinite(reproj_wt) & (reproj_wt > 0)
        weighted_sum[valid_reproj] += reproj_weighted_img[valid_reproj]
        sum_weight[valid_reproj] += reproj_wt[valid_reproj]
        coverage_count[valid_reproj] += 1

    has_data = (sum_weight > 0) & (coverage_count > 0)
    coadd = np.zeros(shape_out, dtype=np.float32)
    coadd[has_data] = (weighted_sum[has_data] / sum_weight[has_data]).astype(np.float32)
    coadd[~has_data] = np.nan

    # Mask array: True if masked or no valid coverage
    mask = ~has_data

    return coadd, mask
