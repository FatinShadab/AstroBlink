"""Unit tests for wavelength binning and masking modules."""

import numpy as np
import pytest

from worker.processing.binning import BAND_RANGES, get_band_pixels, select_pixels_by_band
from worker.processing.masking import (
    DEFAULT_DEFECT_BITMASK,
    HE_AIRGLOW_DEFAULT_RANGE,
    VERIFIED_FLAG_BITS,
    apply_airglow_mask,
    apply_flags_mask,
    combine_masks,
)


def test_flags_mask_known_defect_bits():
    # Shape 4x4
    flags = np.zeros((4, 4), dtype=np.uint32)
    flags[0, 0] = 1 << 0   # Transient
    flags[0, 1] = 1 << 1   # Overflow
    flags[1, 0] = 1 << 6   # Non-functional
    flags[1, 1] = 1 << 10  # Hot pixel
    flags[2, 2] = 1 << 12  # Fullsample (informational, not defect)
    flags[2, 3] = 1 << 21  # Source (informational, not defect)

    mask = apply_flags_mask(flags)

    assert mask[0, 0] is np.True_
    assert mask[0, 1] is np.True_
    assert mask[1, 0] is np.True_
    assert mask[1, 1] is np.True_
    # Informational bits must NOT be flagged as defects
    assert mask[2, 2] is np.False_
    assert mask[2, 3] is np.False_
    assert mask[3, 3] is np.False_


def test_airglow_mask_exclusion():
    # Wavelength grid from 1.0 to 1.2 um
    waves = np.array([1.000, 1.070, 1.075, 1.083, 1.091, 1.095, 1.100], dtype=np.float32)
    airglow_mask = apply_airglow_mask(waves)

    # 1.000 and 1.070 are outside [1.075, 1.091]
    assert airglow_mask[0] is np.False_
    assert airglow_mask[1] is np.False_
    # 1.075, 1.083, 1.091 are within airglow window
    assert airglow_mask[2] is np.True_
    assert airglow_mask[3] is np.True_
    assert airglow_mask[4] is np.True_
    # 1.095 and 1.100 are outside
    assert airglow_mask[5] is np.False_
    assert airglow_mask[6] is np.False_


def test_select_pixels_by_band():
    waves = np.array([0.5, 0.8, 1.0, 2.0, 2.4, 3.0, 4.0, 4.5, 5.2], dtype=np.float32)

    # SWIR: 0.75 - 2.42 um
    swir_sel = select_pixels_by_band(waves, "swir")
    expected_swir = [False, True, True, True, True, False, False, False, False]
    np.testing.assert_array_equal(swir_sel, expected_swir)

    # MWIR: 3.80 - 5.00 um
    mwir_sel = select_pixels_by_band(waves, "mwir")
    expected_mwir = [False, False, False, False, False, False, True, True, False]
    np.testing.assert_array_equal(mwir_sel, expected_mwir)

    # RGB_B: 0.95 - 1.05 um
    b_sel = select_pixels_by_band(waves, "rgb_b")
    assert b_sel[2] is np.True_  # 1.0 um
    assert b_sel[1] is np.False_ # 0.8 um


def test_get_band_pixels_excludes_flagged_and_airglow():
    image = np.ones((4, 4), dtype=np.float32) * 10.0
    var = np.ones((4, 4), dtype=np.float32) * 2.0
    # Wavelength: row 0 is 1.0 um, row 1 is 1.083 um (airglow), row 2 is 2.0 um, row 3 is 4.0 um
    waves = np.zeros((4, 4), dtype=np.float32)
    waves[0, :] = 1.000
    waves[1, :] = 1.083  # airglow
    waves[2, :] = 2.000
    waves[3, :] = 4.000

    flags = np.zeros((4, 4), dtype=np.uint32)
    flags[0, 0] = 1 << 0  # transient bad pixel

    flags_m = apply_flags_mask(flags)
    airglow_m = apply_airglow_mask(waves)
    bad_mask = combine_masks(flags_m, airglow_m)

    filtered_img, weights, valid = get_band_pixels(image, var, waves, "swir", bad_pixel_mask=bad_mask)

    # SWIR includes rows 0, 1, 2 (1.0, 1.083, 2.0 um)
    # But [0, 0] is flagged -> invalid
    assert not valid[0, 0]
    assert np.isnan(filtered_img[0, 0])
    assert weights[0, 0] == 0.0

    # [0, 1] is unflagged 1.0 um -> valid
    assert valid[0, 1]
    assert filtered_img[0, 1] == 10.0
    assert np.isclose(weights[0, 1], 1.0 / 2.0)

    # Row 1 is in airglow range -> all invalid
    assert not np.any(valid[1, :])
    assert np.all(np.isnan(filtered_img[1, :]))

    # Row 2 is 2.0 um (SWIR, unflagged) -> valid
    assert np.all(valid[2, :])
    assert np.allclose(weights[2, :], 0.5)

    # Row 3 is 4.0 um (outside SWIR) -> invalid for SWIR
    assert not np.any(valid[3, :])
