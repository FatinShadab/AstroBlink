"""MEF FITS parser for SPHEREx Level 2 data.

Extracts from Multi-Extension FITS (~67 MB each):
- HDU 1: IMAGE (MJy/sr)
- HDU 2: FLAGS (bitmask)
- HDU 3: VARIANCE
- HDU 6: WCS-WAVE (Binary Table) - per-pixel central wavelength (CWAVE)

See ARCHITECTURE.md §2.3, PRD §6.1, ROADMAP P1-08.
"""


def parse_mef_fits(fits_path: str) -> dict:
    """Parse a Level 2 MEF FITS file. Stub."""
    # from astropy.io import fits
    # hdul = fits.open(fits_path)
    # See ROADMAP P1-08
    raise NotImplementedError("FITS parser not yet implemented.")
