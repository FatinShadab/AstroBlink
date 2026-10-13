"""FLAGS bitmask and airglow masking for SPHEREx Level 2 data.

Verified FLAGS bit meanings from Level 2 FITS header cards (MP_* keywords, docs/VERIFIED_FACTS.md §4):
- Bit 0: MP_TRANSIENT (Transient detected during SUR)
- Bit 1: MP_OVERFLOW (Overflow detected during SUR)
- Bit 2: MP_SUR_ERROR (Error in onboard processing)
- Bit 4: MP_PHANTOM (Phantom pixel)
- Bit 5: MP_REFERENCE (Reference pixel)
- Bit 6: MP_NONFUNC (Permanently unusable)
- Bit 7: MP_DICHROIC (Low efficiency due to dichroic)
- Bit 9: MP_MISSING_DATA (Onboard data lost)
- Bit 10: MP_HOT (Hot pixel)
- Bit 11: MP_COLD (Anomalously low signal)
- Bit 12: MP_FULLSAMPLE (Pixel full sample history is available - informational)
- Bit 14: MP_PHANMISS (Phantom correction was not applied)
- Bit 15: MP_NONLINEAR (Nonlinearity correction cannot be applied reliably)
- Bit 17: MP_PERSIST (Persistent charge above threshold)
- Bit 19: MP_OUTLIER (Pixel flagged by Detect Outliers)
- Bit 21: MP_SOURCE (Pixel mapped to a known source - informational)

Airglow masking:
- He I 1.083 µm airglow emission line:
  Default range: [1.075, 1.091] µm (central 1.083 µm ± 0.008 µm).
  Configurable via HE_AIRGLOW_RANGE / [VERIFY: OQ-6] optimal airglow mask width.

See ARCHITECTURE.md §2.3, PRD §6.1, docs/VERIFIED_FACTS.md §4.
"""

from __future__ import annotations

import numpy as np

# Verified flag bits from Level 2 FITS headers
VERIFIED_FLAG_BITS = {
    0: "MP_TRANSIENT",
    1: "MP_OVERFLOW",
    2: "MP_SUR_ERROR",
    4: "MP_PHANTOM",
    5: "MP_REFERENCE",
    6: "MP_NONFUNC",
    7: "MP_DICHROIC",
    9: "MP_MISSING_DATA",
    10: "MP_HOT",
    11: "MP_COLD",
    12: "MP_FULLSAMPLE",
    14: "MP_PHANMISS",
    15: "MP_NONLINEAR",
    17: "MP_PERSIST",
    19: "MP_OUTLIER",
    21: "MP_SOURCE",
}

# Alias for backward compatibility with initial scaffold placeholders
KNOWN_FLAG_BITS = {
    **VERIFIED_FLAG_BITS,
    # [VERIFY: OQ-2] Bits 25-29 unconfirmed in Level 2 FLAGS FITS header
    25: "STREAK",
    26: "BLOOM",
    27: "SNOWBALL",
    28: "HALO",
    29: "SATELLITE_HALO",
}

# Bits that indicate defective or corrupted pixel values to mask out.
# Note: Bit 12 (FULLSAMPLE) and Bit 21 (SOURCE) are informational tags, not defects.
DEFECT_MASK_BITS = [
    0,   # Transient
    1,   # Overflow
    2,   # SUR error
    4,   # Phantom
    5,   # Reference pixel
    6,   # Non-functional
    7,   # Low dichroic efficiency
    9,   # Missing data
    10,  # Hot pixel
    11,  # Cold pixel
    14,  # Phantom correction missing
    15,  # Nonlinearity uncorrectable
    17,  # Persistence
    19,  # Outlier
]

from worker.config import settings

# Bits set on moving objects / single-exposure transients by SPHEREx Level 2 pipeline
TRANSIENT_OUTLIER_BITS = [0, 19]  # Bit 0: MP_TRANSIENT, Bit 19: MP_OUTLIER

# Bitmask combining all verified defect bits (including Bits 0 and 19)
DEFAULT_DEFECT_BITMASK: int = sum(1 << b for b in DEFECT_MASK_BITS)

# Bitmask excluding Bit 0 (MP_TRANSIENT) and Bit 19 (MP_OUTLIER)
DEFECT_BITMASK_WITHOUT_TRANSIENT_OUTLIER: int = sum(
    1 << b for b in DEFECT_MASK_BITS if b not in TRANSIENT_OUTLIER_BITS
)

# [VERIFY: OQ-6] Optimal airglow mask width around He I 1.083 um line
HE_AIRGLOW_DEFAULT_RANGE: tuple[float, float] = (1.075, 1.091)


def get_defect_bitmask(mask_transient_and_outlier: bool | None = None) -> int:
    """Return the active FLAGS defect bitmask based on configuration.

    Args:
        mask_transient_and_outlier: If True (default), include Bit 0 (MP_TRANSIENT) and
            Bit 19 (MP_OUTLIER). If False, exclude Bits 0 and 19. If None, uses
            `settings.mask_transient_and_outlier_flags`.
    """
    use_transient_outlier = (
        settings.mask_transient_and_outlier_flags
        if mask_transient_and_outlier is None
        else mask_transient_and_outlier
    )
    return DEFAULT_DEFECT_BITMASK if use_transient_outlier else DEFECT_BITMASK_WITHOUT_TRANSIENT_OUTLIER


def apply_flags_mask(
    flags: np.ndarray,
    defect_bitmask: int | None = None,
    mask_transient_and_outlier: bool | None = None,
) -> np.ndarray:
    """Create boolean bad-pixel mask from FLAGS array.

    Args:
        flags: 2D uint32 ndarray of FLAGS values.
        defect_bitmask: Explicit bitmask of flags to treat as defects. If None, derived via
            `get_defect_bitmask(mask_transient_and_outlier)`.
        mask_transient_and_outlier: Optional override for masking Bits 0 and 19 when
            `defect_bitmask` is not explicitly provided.

    Returns:
        Boolean ndarray where True means pixel is flagged/bad.
    """
    active_bitmask = (
        get_defect_bitmask(mask_transient_and_outlier)
        if defect_bitmask is None
        else defect_bitmask
    )
    flags_arr = np.asarray(flags, dtype=np.uint32)
    return (flags_arr & np.uint32(active_bitmask)) != 0


def apply_airglow_mask(
    wavelength_map: np.ndarray,
    airglow_range: tuple[float, float] = HE_AIRGLOW_DEFAULT_RANGE,
) -> np.ndarray:
    """Create boolean mask for pixels within the He I airglow wavelength window.

    Args:
        wavelength_map: 2D float32 ndarray of wavelengths in microns.
        airglow_range: (min_wave_um, max_wave_um) to mask.

    Returns:
        Boolean ndarray where True means pixel is within airglow window.
    """
    w_min, w_max = airglow_range
    return (wavelength_map >= w_min) & (wavelength_map <= w_max)


def combine_masks(
    flags_mask: np.ndarray,
    airglow_mask: np.ndarray,
) -> np.ndarray:
    """Combine defect and airglow masks into a unified mask.

    Returns:
        Boolean ndarray where True indicates a masked (excluded) pixel.
    """
    return flags_mask | airglow_mask


def apply_shared_wavelength_mask(
    wavelength_map: np.ndarray,
    shared_w_min: float,
    shared_w_max: float,
) -> np.ndarray:
    """Create boolean mask for pixels whose wavelength falls outside [shared_w_min, shared_w_max].

    Args:
        wavelength_map: 2D float ndarray of per-pixel wavelengths in microns.
        shared_w_min: Lower bound of shared wavelength interval (um).
        shared_w_max: Upper bound of shared wavelength interval (um).

    Returns:
        Boolean ndarray where True means pixel is outside the shared wavelength interval (masked).
    """
    w = np.asarray(wavelength_map, dtype=np.float64)
    return (~np.isfinite(w)) | (w < shared_w_min) | (w > shared_w_max)


def extract_transient_outlier_overlay(flags: np.ndarray) -> dict[str, np.ndarray]:
    """Extract 'flagged but visible' overlay masks for Bit 0 (MP_TRANSIENT) and Bit 19 (MP_OUTLIER).

    When used alongside `apply_flags_mask(flags, mask_transient_and_outlier=False)`, the underlying
    science flux is preserved while these masks identify pixels for a distinct visual overlay.
    """
    flags_arr = np.asarray(flags, dtype=np.uint32)
    bit0 = (flags_arr & np.uint32(1 << 0)) != 0
    bit19 = (flags_arr & np.uint32(1 << 19)) != 0
    return {
        "bit0_mask": bit0,
        "bit19_mask": bit19,
        "overlay_mask": bit0 | bit19,
    }

