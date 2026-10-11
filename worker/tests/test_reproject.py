"""Unit tests for reprojection, target WCS, and epoch co-addition."""

from astropy.wcs import WCS
import numpy as np
import pytest

from worker.processing.reproject import (
    PIXEL_SCALE_ARCSEC,
    build_target_wcs,
    determine_epoch,
    reproject_and_coadd,
)


def test_build_target_wcs():
    ra_center, dec_center = 180.0, -2.5
    size_deg = 0.1
    wcs, shape_out = build_target_wcs(ra_center, dec_center, size_deg)

    # 0.1 deg / (6.15 / 3600 deg/px) ~ 58.53 -> 59 pixels
    assert shape_out == (59, 59)
    assert wcs.wcs.ctype[0] == "RA---TAN"
    assert wcs.wcs.ctype[1] == "DEC--TAN"

    # Reference pixel world coordinates
    crpix1, crpix2 = wcs.wcs.crpix
    ra_eval, dec_eval = wcs.pixel_to_world_values(crpix1 - 1, crpix2 - 1)
    assert np.isclose(ra_eval, ra_center)
    assert np.isclose(dec_eval, dec_center)


def test_determine_epoch():
    # Survey 1: MJD 60796 - 60979
    assert determine_epoch(mjd=60800.0) == 1
    # Survey 2: MJD 60980 - 61191
    assert determine_epoch(mjd=61000.0) == 2
    # Survey 3: MJD 61192 - 61405
    assert determine_epoch(mjd=61300.0) == 3
    # Survey 4: MJD 61406 - 61586
    assert determine_epoch(mjd=61500.0) == 4
    # Fallback when None
    assert determine_epoch(mjd=None) == 1


def test_reproject_and_coadd_two_exposures():
    # Target grid 10x10 centered at 180.0, 0.0
    w_target = WCS(naxis=2)
    w_target.wcs.crpix = [5.5, 5.5]
    w_target.wcs.crval = [180.0, 0.0]
    w_target.wcs.cdelt = [-0.0017, 0.0017]
    w_target.wcs.ctype = ["RA---TAN", "DEC--TAN"]

    shape_out = (10, 10)

    # Exposure 1: constant image 10.0, variance 1.0 (weight 1.0)
    exp1 = {
        "image": np.full((10, 10), 10.0, dtype=np.float32),
        "variance": np.full((10, 10), 1.0, dtype=np.float32),
        "flags": np.zeros((10, 10), dtype=np.uint32),
        "wavelength_map": np.full((10, 10), 1.5, dtype=np.float32),  # SWIR
        "wcs": w_target,
    }

    # Exposure 2: constant image 20.0, variance 1.0 (weight 1.0)
    exp2 = {
        "image": np.full((10, 10), 20.0, dtype=np.float32),
        "variance": np.full((10, 10), 1.0, dtype=np.float32),
        "flags": np.zeros((10, 10), dtype=np.uint32),
        "wavelength_map": np.full((10, 10), 1.5, dtype=np.float32),  # SWIR
        "wcs": w_target,
    }

    coadd, mask = reproject_and_coadd([exp1, exp2], w_target, shape_out, "swir")

    # Unmasked pixels should average to 15.0
    assert not np.all(mask)
    assert np.allclose(coadd, 15.0, atol=1e-3)
    assert not np.any(mask)


def test_reproject_and_coadd_no_coverage():
    w_target = WCS(naxis=2)
    w_target.wcs.crpix = [5.5, 5.5]
    w_target.wcs.crval = [180.0, 0.0]
    w_target.wcs.cdelt = [-0.0017, 0.0017]
    w_target.wcs.ctype = ["RA---TAN", "DEC--TAN"]

    coadd, mask = reproject_and_coadd([], w_target, (10, 10), "swir")
    assert np.all(mask)
    assert np.all(np.isnan(coadd))
