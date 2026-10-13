"""Unit tests for fits_parser with small synthetic MEF FITS fixture."""

import tempfile
import os

from astropy.io import fits
from astropy.wcs import WCS
import numpy as np
import pytest

from worker.processing.fits_parser import compute_wavelength_map, parse_mef_fits


@pytest.fixture
def synthetic_mef_fits(tmp_path):
    """Build a minimal synthetic SPHEREx MEF FITS file with all required extensions."""
    fits_path = str(tmp_path / "synthetic_spherex_l2.fits")

    # HDU 0: PRIMARY
    prim_hdr = fits.Header()
    prim_hdr["TELESCOP"] = "SPHEREx"
    prim_hdr["ORIGIN"] = "AstroBlink Test"
    prim_hdu = fits.PrimaryHDU(header=prim_hdr)

    # HDU 1: IMAGE (10x10)
    img_data = np.arange(100, dtype=np.float32).reshape((10, 10))
    img_hdr = fits.Header()
    img_hdr["EXTNAME"] = "IMAGE"
    img_hdr["BUNIT"] = "MJy / sr"
    # Simple TAN WCS
    img_hdr["CRPIX1"] = 5.5
    img_hdr["CRPIX2"] = 5.5
    img_hdr["CRVAL1"] = 150.0
    img_hdr["CRVAL2"] = 2.0
    img_hdr["CDELT1"] = -0.0017
    img_hdr["CDELT2"] = 0.0017
    img_hdr["CTYPE1"] = "RA---TAN"
    img_hdr["CTYPE2"] = "DEC--TAN"
    image_hdu = fits.ImageHDU(data=img_data, header=img_hdr, name="IMAGE")

    # HDU 2: FLAGS
    flags_data = np.zeros((10, 10), dtype=np.uint32)
    flags_data[2, 3] = 1 << 0  # TRANSIENT
    flags_data[5, 5] = 1 << 6  # NONFUNC
    flags_hdr = fits.Header()
    flags_hdr["EXTNAME"] = "FLAGS"
    flags_hdu = fits.ImageHDU(data=flags_data, header=flags_hdr, name="FLAGS")

    # HDU 3: VARIANCE
    var_data = np.full((10, 10), 0.05, dtype=np.float32)
    var_hdr = fits.Header()
    var_hdr["EXTNAME"] = "VARIANCE"
    var_hdu = fits.ImageHDU(data=var_data, header=var_hdr, name="VARIANCE")

    # HDU 6: WCS-WAVE (Binary table lookup with 2x2 grid)
    # X in [1, 10], Y in [1, 10]
    x_col = fits.Column(name="X", format="2J", dim="(2)", array=np.array([[1, 10]], dtype=np.int32))
    y_col = fits.Column(name="Y", format="2J", dim="(2)", array=np.array([[1, 10]], dtype=np.int32))
    # VALUES shape (1, 2, 2, 2): y_idx, x_idx, (wave, bw)
    # Let wave vary from 1.0 um to 2.0 um along Y
    val_arr = np.zeros((1, 2, 2, 2), dtype=np.float32)
    val_arr[0, 0, :, 0] = 1.0  # y=1 -> 1.0 um
    val_arr[0, 1, :, 0] = 2.0  # y=10 -> 2.0 um
    val_arr[0, :, :, 1] = 0.05  # bandwidth
    val_col = fits.Column(name="VALUES", format="8E", dim="(2,2,2)", array=val_arr)

    cols = fits.ColDefs([x_col, y_col, val_col])
    wave_hdu = fits.BinTableHDU.from_columns(cols, name="WCS-WAVE")

    hdul = fits.HDUList([prim_hdu, image_hdu, flags_hdu, var_hdu, wave_hdu])
    hdul.writeto(fits_path, overwrite=True)

    return fits_path


def test_parse_mef_fits(synthetic_mef_fits):
    parsed = parse_mef_fits(synthetic_mef_fits)

    assert "image" in parsed
    assert "flags" in parsed
    assert "variance" in parsed
    assert "wavelength_map" in parsed
    assert "wcs" in parsed

    # Validate image array
    assert parsed["image"].dtype == np.float32
    assert parsed["image"].shape == (10, 10)
    assert parsed["image"][0, 0] == 0.0
    assert parsed["image"][9, 9] == 99.0

    # Validate flags array
    assert parsed["flags"].dtype == np.uint32
    assert parsed["flags"][2, 3] == 1
    assert parsed["flags"][5, 5] == (1 << 6)
    assert parsed["flags"][0, 0] == 0

    # Validate variance array
    assert parsed["variance"].dtype == np.float32
    assert np.allclose(parsed["variance"], 0.05)

    # Validate wavelength map
    wave_map = parsed["wavelength_map"]
    assert wave_map.dtype == np.float32
    assert wave_map.shape == (10, 10)
    # y=0 corresponds to y_FITS=1 -> wave=1.0
    assert np.isclose(wave_map[0, 0], 1.0)
    # y=9 corresponds to y_FITS=10 -> wave=2.0
    assert np.isclose(wave_map[9, 9], 2.0)
    # middle row y=4 or 5
    assert 1.0 < wave_map[5, 5] < 2.0

    # Validate celestial WCS
    assert isinstance(parsed["wcs"], WCS)
    ra, dec = parsed["wcs"].pixel_to_world_values(4.5, 4.5)
    assert np.isclose(ra, 150.0)
    assert np.isclose(dec, 2.0)
