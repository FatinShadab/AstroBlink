"""WCS JSON sidecar writer.

JSON structure: {crpix, crval, cd, naxis, ctype}
See PRD §6.1, ROADMAP P1-12.
"""

import json


def write_wcs_sidecar(wcs, output_path: str) -> str:
    """Write WCS metadata as JSON sidecar. Stub."""
    raise NotImplementedError("WCS sidecar writer not yet implemented.")
