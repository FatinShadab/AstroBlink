"""Reprojection and co-addition.

Pixel scale: 6.15 arcsec/pixel. Default cutout: 0.1 deg x 0.1 deg.
See ARCHITECTURE.md §2.3, ROADMAP P1-11.
"""


def build_target_wcs(ra_center: float, dec_center: float, size_deg: float = 0.1):
    """Build a target TAN WCS for the cutout. Stub."""
    raise NotImplementedError("Target WCS builder not yet implemented.")


def reproject_and_coadd(exposures: list, target_wcs, band: str):
    """Reproject and co-add with inverse-variance weighting. Stub."""
    raise NotImplementedError("Reproject and co-add not yet implemented.")
