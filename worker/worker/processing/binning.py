"""Wavelength binning and channel selection for SPHEREx spectral composites.

SPHEREx composite bands:
- SWIR:  0.75 - 2.42 µm  (reflected sunlight)
- MWIR:  3.80 - 5.00 µm  (thermal emission)
- RGB:
  - B (Blue):  0.95 - 1.05 µm (centered on 1.0 µm)
  - G (Green): 1.90 - 2.10 µm (centered on 2.0 µm)
  - R (Red):   3.90 - 4.10 µm (centered on 4.0 µm)

[VERIFY: OQ-5] Optimal RGB sub-band wavelength window width (currently ±0.1 µm).
Note: The 2.42 - 3.80 µm gap is intentional to avoid strong atmospheric / instrumental absorption.

Bands are built by selecting pixels per exposure by wavelength and combining across exposures,
NOT by co-adding a 102-channel cube.
See ARCHITECTURE.md §2.3, PRD §6.1, ROADMAP P1-09.
"""

from __future__ import annotations

import numpy as np

# Band wavelength ranges in microns (inclusive)
BAND_RANGES: dict[str, tuple[float, float]] = {
    "swir": (0.75, 2.42),
    "mwir": (3.80, 5.00),
    "rgb_b": (0.95, 1.05),
    "rgb_g": (1.90, 2.10),
    "rgb_r": (3.90, 4.10),
}


def select_pixels_by_band(
    wavelength_map: np.ndarray,
    band: str,
) -> np.ndarray:
    """Create a boolean inclusion mask for pixels falling within the band wavelength range.

    Args:
        wavelength_map: 2D float32 ndarray of central wavelengths in microns.
        band: Band key ('swir', 'mwir', 'rgb_b', 'rgb_g', 'rgb_r').

    Returns:
        Boolean ndarray where True means pixel falls within the band's wavelength range.
    """
    if band not in BAND_RANGES:
        raise ValueError(f"Unknown band '{band}'. Valid bands: {list(BAND_RANGES.keys())}")

    w_min, w_max = BAND_RANGES[band]
    return (wavelength_map >= w_min) & (wavelength_map <= w_max)


def get_band_pixels(
    image: np.ndarray,
    variance: np.ndarray,
    wavelength_map: np.ndarray,
    band: str,
    bad_pixel_mask: np.ndarray | None = None,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Extract pixels for a specific band, applying bad-pixel mask and calculating weights.

    Args:
        image: 2D float32 image data (MJy/sr).
        variance: 2D float32 variance data.
        wavelength_map: 2D float32 wavelength map (microns).
        band: Band key ('swir', 'mwir', etc.).
        bad_pixel_mask: Optional boolean mask where True = bad/excluded.

    Returns:
        Tuple of (selected_image, inv_variance_weights, final_valid_mask)
        where invalid/unselected pixels are masked (weight 0).
    """
    in_band = select_pixels_by_band(wavelength_map, band)
    valid = in_band.copy()
    if bad_pixel_mask is not None:
        valid = valid & (~bad_pixel_mask)

    # Compute inverse-variance weights for valid pixels
    weights = np.zeros_like(variance, dtype=np.float32)
    # Guard against zero or negative variance
    pos_var = valid & (variance > 1e-12) & np.isfinite(variance)
    weights[pos_var] = 1.0 / variance[pos_var]

    filtered_image = np.where(valid, image, np.nan).astype(np.float32)

    return filtered_image, weights, valid
