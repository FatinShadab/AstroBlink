"""WCS JSON sidecar writer.

Schema per PRD §6.1, ARCHITECTURE.md §2.3:
{
  "crpix": [cx, cy],
  "crval": [ra_center, dec_center],
  "cd": [[cd1_1, cd1_2], [cd2_1, cd2_2]],
  "naxis": [nx, ny],
  "ctype": ["RA---TAN", "DEC--TAN"]
}

Enables client-side canvas-to-sky (x, y) <-> (RA, Dec) conversion.
"""

from __future__ import annotations

import json
from typing import Any

from astropy.wcs import WCS
import numpy as np


def build_wcs_sidecar_dict(
    wcs: WCS,
    shape: tuple[int, int],
    tiles_metadata: dict[str, dict[str, Any]] | None = None,
    tile_metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the WCS sidecar dictionary structure from an Astropy WCS, image shape, and per-tile metadata.

    Args:
        wcs: astropy.wcs.WCS instance.
        shape: (ny, nx) image shape in pixels.
        tiles_metadata: Optional mapping of tile key (e.g. '1_1.0um') to exposure/wavelength metadata.
        tile_metadata: Optional metadata dict for the specific tile this sidecar accompanies.

    Returns:
        Dictionary matching the contract schema plus per-tile provenance fields.
    """
    ny, nx = shape
    crpix = [float(wcs.wcs.crpix[0]), float(wcs.wcs.crpix[1])]
    crval = [float(wcs.wcs.crval[0]), float(wcs.wcs.crval[1])]

    # Compute CD matrix
    if hasattr(wcs.wcs, "cd") and wcs.wcs.cd is not None and np.any(wcs.wcs.cd):
        cd_matrix = wcs.wcs.cd.tolist()
    else:
        # Reconstruct CD from PC and CDELT
        pc = wcs.wcs.pc if hasattr(wcs.wcs, "pc") and wcs.wcs.pc is not None else np.eye(2)
        cdelt = wcs.wcs.cdelt if hasattr(wcs.wcs, "cdelt") and wcs.wcs.cdelt is not None else np.array([1.0, 1.0])
        cd_arr = pc * cdelt[:, np.newaxis]
        cd_matrix = cd_arr.tolist()

    ctype = [str(wcs.wcs.ctype[0]), str(wcs.wcs.ctype[1])]

    result: dict[str, Any] = {
        "crpix": crpix,
        "crval": crval,
        "cd": cd_matrix,
        "naxis": [int(nx), int(ny)],
        "ctype": ctype,
    }
    if tile_metadata is not None:
        for k, v in tile_metadata.items():
            if k not in result:
                result[k] = v
    if tiles_metadata is not None:
        result["tiles"] = tiles_metadata
    return result


def write_wcs_sidecar(
    wcs: WCS,
    shape: tuple[int, int],
    output_path: str,
    tiles_metadata: dict[str, dict[str, Any]] | None = None,
    tile_metadata: dict[str, Any] | None = None,
) -> str:
    """Serialize WCS metadata as a JSON sidecar file.

    Args:
        wcs: astropy.wcs.WCS instance.
        shape: (ny, nx) image shape.
        output_path: Destination JSON file path.
        tiles_metadata: Optional per-tile wavelength and exposure metadata dictionary.
        tile_metadata: Optional metadata dict for the specific tile this sidecar accompanies.

    Returns:
        output_path written.
    """
    data = build_wcs_sidecar_dict(
        wcs, shape, tiles_metadata=tiles_metadata, tile_metadata=tile_metadata
    )
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return output_path

