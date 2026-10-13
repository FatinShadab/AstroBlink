"""MEF FITS parser for SPHEREx Level 2 data.

Extracts from Multi-Extension FITS (Level 2):
- HDU 1: IMAGE (MJy/sr, float32)
- HDU 2: FLAGS (bitmask, uint32)
- HDU 3: VARIANCE (variance, float32)
- HDU 6: WCS-WAVE (Binary Table) -> bilinear lookup table for central wavelength
- Celestial WCS (extracted from HDU 1 IMAGE header)

See ARCHITECTURE.md §2.3, PRD §6.1, docs/VERIFIED_FACTS.md §3.
"""

from __future__ import annotations

import logging
from typing import Any

from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
from scipy.interpolate import RegularGridInterpolator

logger = logging.getLogger(__name__)


def compute_wavelength_map(
    wcs_wave_hdu: fits.BinTableHDU,
    image_shape: tuple[int, int],
) -> np.ndarray:
    """Compute 2D central wavelength map in microns using WCS-WAVE binary table.

    Per FITS Paper III and SPHEREx Level 2 format:
    - 'X': 1D grid of 1-based X pixel coordinates (e.g. 11 sample points)
    - 'Y': 1D grid of 1-based Y pixel coordinates (e.g. 11 sample points)
    - 'VALUES': 3D array of shape (N_y, N_x, 2), where index 0 is central wavelength (um)
      and index 1 is bandwidth (um).

    Args:
        wcs_wave_hdu: HDU 6 (EXTNAME='WCS-WAVE')
        image_shape: (ny, nx) shape of the image array.

    Returns:
        2D numpy float32 array of shape (ny, nx) containing central wavelength in microns.
    """
    data = wcs_wave_hdu.data
    x_grid = np.asarray(data["X"][0], dtype=np.float64)
    y_grid = np.asarray(data["Y"][0], dtype=np.float64)
    values = np.asarray(data["VALUES"][0], dtype=np.float64)  # shape: (11, 11, 2)

    # First component is central wavelength in microns
    wave_grid = values[:, :, 0]

    ny, nx = image_shape
    # FITS pixel coordinates are 1-based: x in [1, nx], y in [1, ny]
    interp = RegularGridInterpolator(
        (y_grid, x_grid),
        wave_grid,
        method="linear",
        bounds_error=False,
        fill_value=None,  # extrapolate linearly to detector borders if needed
    )

    y_coords = np.arange(1, ny + 1, dtype=np.float64)
    x_coords = np.arange(1, nx + 1, dtype=np.float64)

    # Meshgrid with indexing='ij' for (y, x) evaluation
    yy, xx = np.meshgrid(y_coords, x_coords, indexing="ij")
    pts = np.stack([yy.ravel(), xx.ravel()], axis=-1)
    wave_map = interp(pts).reshape((ny, nx)).astype(np.float32)

    return wave_map


def parse_mef_fits(fits_path: str) -> dict[str, Any]:
    """Parse a Level 2 MEF FITS file and return typed arrays and celestial WCS.

    Args:
        fits_path: Path to the Level 2 FITS file.

    Returns:
        Dictionary containing:
        - 'image': float32 2D ndarray (MJy/sr)
        - 'flags': uint32 2D ndarray (bitmask)
        - 'variance': float32 2D ndarray
        - 'wavelength_map': float32 2D ndarray (microns)
        - 'wcs': astropy.wcs.WCS (celestial WCS from HDU 1)
        - 'primary_header': fits.Header
        - 'image_header': fits.Header
    """
    with fits.open(fits_path, memmap=False) as hdul:
        # HDU 1: IMAGE
        image_hdu = hdul["IMAGE"]
        image = np.asarray(image_hdu.data, dtype=np.float32)
        image_header = image_hdu.header.copy()

        # Celestial WCS from HDU 1
        celestial_wcs = WCS(image_header)

        # HDU 2: FLAGS
        flags_hdu = hdul["FLAGS"]
        flags = np.asarray(flags_hdu.data, dtype=np.uint32)

        # HDU 3: VARIANCE
        var_hdu = hdul["VARIANCE"]
        variance = np.asarray(var_hdu.data, dtype=np.float32)

        # HDU 6: WCS-WAVE
        wcs_wave_hdu = hdul["WCS-WAVE"]
        wave_map = compute_wavelength_map(wcs_wave_hdu, image.shape)

        primary_header = hdul[0].header.copy()

    return {
        "image": image,
        "flags": flags,
        "variance": variance,
        "wavelength_map": wave_map,
        "wcs": celestial_wcs,
        "primary_header": primary_header,
        "image_header": image_header,
    }
