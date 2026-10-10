"""Wavelength binning for SPHEREx spectral composites.

Composite bands:
  - SWIR:  0.75 - 2.42 µm  (reflected sunlight)
  - MWIR:  3.80 - 5.00 µm  (thermal emission)
  - RGB:   B=1.0µm (0.95-1.05), G=2.0µm (1.90-2.10), R=4.0µm (3.90-4.10)

The 2.42-3.80 µm gap is intentional.
See ARCHITECTURE.md §2.3, ROADMAP P1-09.
[VERIFY: OQ-5] Optimal RGB sub-band wavelength window width.
"""

BAND_RANGES = {
    "swir": (0.75, 2.42),
    "mwir": (3.80, 5.00),
    "rgb_b": (0.95, 1.05),
    "rgb_g": (1.90, 2.10),
    "rgb_r": (3.90, 4.10),
}


def select_pixels_by_band(cwave_map, band: str):
    """Select pixels whose CWAVE falls within the given band range. Stub."""
    raise NotImplementedError("Wavelength binning not yet implemented.")
