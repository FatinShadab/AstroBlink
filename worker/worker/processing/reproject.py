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
from worker.processing.masking import (
    apply_airglow_mask,
    apply_flags_mask,
    apply_shared_wavelength_mask,
    combine_masks,
    extract_transient_outlier_overlay,
)

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


def reproject_wavelength_slice(
    cutout_res: dict[str, Any],
    target_wcs: WCS,
    shape_out: tuple[int, int],
    shared_w_min: float | None = None,
    shared_w_max: float | None = None,
    wave_interp: Any | None = None,
    mask_transient_and_outlier: bool | None = None,
) -> dict[str, Any]:
    """Reproject a ranged exposure cutout onto target_wcs and optionally apply the shared-wavelength mask.

    Args:
        cutout_res: Dict returned by `fetch_ranged_cutout` ('image_cutout', 'flags_cutout',
            'variance_cutout', 'image_header', 'bbox').
        target_wcs: Target TAN WCS grid.
        shape_out: (ny, nx) dimensions of the target grid.
        shared_w_min: Optional lower bound of shared wavelength interval (um) across matched epochs.
        shared_w_max: Optional upper bound of shared wavelength interval (um) across matched epochs.
        wave_interp: 2D RegularGridInterpolator mapping (y_1based, x_1based) -> wavelength_um.
            If None, looks for 'wavelength_cutout' in `cutout_res`.
        mask_transient_and_outlier: Optional override for masking Bits 0 and 19.

    Returns:
        Dictionary containing:
        - 'image': 2D float32 array on target grid (np.nan where masked)
        - 'mask': 2D bool array on target grid (True = masked)
        - 'wavelength_map': 2D float64 array of wavelengths on target grid
        - 'cutout_w_min': float (min wavelength on target grid before shared clip)
        - 'cutout_w_max': float (max wavelength on target grid before shared clip)
        - 'mask_fraction': float (fraction of masked pixels in [0.0, 1.0])
        - 'valid_fraction': float (fraction of valid pixels in [0.0, 1.0])
    """
    img_cut = np.asarray(cutout_res["image_cutout"], dtype=np.float32)
    flg_cut = np.asarray(cutout_res["flags_cutout"], dtype=np.uint32)
    var_cut = np.asarray(cutout_res["variance_cutout"], dtype=np.float32)
    img_hdr = cutout_res["image_header"]
    bbox = cutout_res["bbox"]
    x0, x1, y0, y1 = int(bbox["x0"]), int(bbox["x1"]), int(bbox["y0"]), int(bbox["y1"])
    nx_det, ny_det = int(bbox["nx"]), int(bbox["ny"])

    wcs_in = WCS(img_hdr)

    ty_g, tx_g = np.meshgrid(
        np.arange(shape_out[0], dtype=np.float64),
        np.arange(shape_out[1], dtype=np.float64),
        indexing="ij",
    )
    sky_ra, sky_dec = target_wcs.pixel_to_world_values(tx_g, ty_g)
    px_det, py_det = wcs_in.world_to_pixel_values(sky_ra, sky_dec)
    in_det = (px_det >= x0) & (px_det <= x1 - 1) & (py_det >= y0) & (py_det <= y1 - 1)

    from scipy.interpolate import RegularGridInterpolator

    y_axis = np.arange(y0, y1, dtype=np.float64)
    x_axis = np.arange(x0, x1, dtype=np.float64)

    # Evaluate native cutout wavelength map and target-grid wavelength map
    if wave_interp is not None:
        ny_g, nx_g = np.meshgrid(y_axis + 1.0, x_axis + 1.0, indexing="ij")
        w_native = np.asarray(wave_interp((ny_g, nx_g)), dtype=np.float64)

        w_target = np.full(shape_out, np.nan, dtype=np.float64)
        in_full_det = (px_det >= 0) & (px_det < nx_det) & (py_det >= 0) & (py_det < ny_det)
        if np.any(in_full_det):
            w_target[in_full_det] = wave_interp((py_det[in_full_det] + 1.0, px_det[in_full_det] + 1.0))
    elif "wavelength_cutout" in cutout_res:
        w_native = np.asarray(cutout_res["wavelength_cutout"], dtype=np.float64)
        w_rgi = RegularGridInterpolator(
            (y_axis, x_axis), w_native, method="linear", bounds_error=False, fill_value=np.nan
        )
        w_target = np.full(shape_out, np.nan, dtype=np.float64)
        if np.any(in_det):
            w_target[in_det] = w_rgi((py_det[in_det], px_det[in_det]))
    else:
        raise ValueError("Either wave_interp or cutout_res['wavelength_cutout'] must be provided")

    finite_wt = w_target[np.isfinite(w_target)]
    cutout_w_min = float(np.min(finite_wt)) if finite_wt.size > 0 else float("nan")
    cutout_w_max = float(np.max(finite_wt)) if finite_wt.size > 0 else float("nan")

    # Apply native defect flags, airglow mask, and variance sanity check
    flags_m = apply_flags_mask(flg_cut, mask_transient_and_outlier=mask_transient_and_outlier)
    airglow_m = apply_airglow_mask(w_native)
    bad_native = (
        combine_masks(flags_m, airglow_m)
        | (~np.isfinite(img_cut))
        | (~np.isfinite(var_cut))
        | (var_cut <= 1e-12)
    )

    clean_cut = img_cut.copy().astype(np.float64)
    clean_cut[bad_native] = np.nan

    img_rgi = RegularGridInterpolator(
        (y_axis, x_axis), clean_cut, method="linear", bounds_error=False, fill_value=np.nan
    )
    reproj_img = np.full(shape_out, np.nan, dtype=np.float32)
    if np.any(in_det):
        reproj_img[in_det] = img_rgi((py_det[in_det], px_det[in_det])).astype(np.float32)

    # Apply per-pixel shared-wavelength mask on the target grid if bounds are provided
    if shared_w_min is not None and shared_w_max is not None:
        sh_mask = apply_shared_wavelength_mask(w_target, shared_w_min, shared_w_max)
        reproj_img[sh_mask] = np.nan

    final_mask = ~np.isfinite(reproj_img)
    total_px = int(final_mask.size)
    masked_px = int(np.sum(final_mask))
    mask_fraction = float(masked_px) / float(total_px) if total_px > 0 else 1.0
    valid_fraction = 1.0 - mask_fraction

    return {
        "image": reproj_img,
        "mask": final_mask,
        "wavelength_map": w_target,
        "cutout_w_min": cutout_w_min,
        "cutout_w_max": cutout_w_max,
        "mask_fraction": mask_fraction,
        "valid_fraction": valid_fraction,
    }

