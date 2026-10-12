"""Tests for sources (IRSA TAP discovery, S3 download, scratch cleanup)."""

import os
import tempfile
from unittest.mock import MagicMock, patch

import numpy as np
import pytest

from worker.config import settings
from worker.sources.irsa import build_cutout_url, find_exposures_at_position
from worker.sources.s3 import fetch_fits_to_scratch, find_candidate_files


def _create_mock_wkb_polygon(min_ra, max_ra, min_dec, max_dec):
    import struct, binascii
    pts = [(min_ra, min_dec), (max_ra, min_dec), (max_ra, max_dec), (min_ra, max_dec), (min_ra, min_dec)]
    raw = bytearray([1]) # byte order little endian
    raw.extend(struct.pack("<IIII", 0x20000003, 4326, 1, 5))
    for x, y in pts:
        raw.extend(struct.pack("<dd", float(x), float(y)))
    return binascii.hexlify(raw).decode("ascii")


def test_build_cutout_url():
    url = build_cutout_url("qr2/level2/file.fits", 150.0, 20.0, 0.1)
    base = settings.irsa_cutout_base_url.rstrip("/")
    assert url == f"{base}/qr2/level2/file.fits?center=150.0,20.0d&size=0.1"


def test_find_candidate_files_wavelength_matching():
    # Target at RA 15.0, Dec -20.0
    wkb_full = _create_mock_wkb_polygon(10.0, 20.0, -25.0, -15.0)
    wkb_edge = _create_mock_wkb_polygon(15.02, 20.0, -25.0, -15.0)

    table_data = [
        # Epoch 1 (MJD ~60842):
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d1_off.fits", "SPHEREx-D1", "60842.1", wkb_full, "39.1"],
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d1_match.fits", "SPHEREx-D1", "60842.2", wkb_full, "39.1"],
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d5_match.fits", "SPHEREx-D5", "60842.4", wkb_full, "111.6"],
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d3_no_overlap.fits", "SPHEREx-D3", "60842.7", wkb_full, "40.6"],
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d1_edge.fits", "SPHEREx-D1", "60842.9", wkb_edge, "39.1"],
        # Epoch 2 (MJD ~61022, >30d gap):
        ["ibe/data/spherex/qr2/level2/2025W50_1A/d1_ep2.fits", "SPHEREx-D1", "61022.1", wkb_full, "39.1"],
        ["ibe/data/spherex/qr2/level2/2025W50_1A/d5_ep2.fits", "SPHEREx-D5", "61022.2", wkb_full, "111.6"],
        ["ibe/data/spherex/qr2/level2/2025W50_1A/d3_ep2_no_overlap.fits", "SPHEREx-D3", "61022.3", wkb_full, "40.6"],
    ]

    mock_tap_response = {
        "VOTABLE": {
            "RESOURCE_ARRAY": [{
                "TABLE": {
                    "FIELD_ARRAY": [
                        {"<xmlattr>": {"name": "uri"}},
                        {"<xmlattr>": {"name": "energy_bandpassname"}},
                        {"<xmlattr>": {"name": "time_bounds_lower"}},
                        {"<xmlattr>": {"name": "poly"}},
                        {"<xmlattr>": {"name": "energy_resolvingpower"}},
                    ],
                    "DATA": {"TABLEDATA": table_data}
                }
            }]
        }
    }

    # Mock WCS-WAVE cutout wavelengths:
    # 1.0 um (D1, R=39.1, tol=0.0256): d1_match [0.988, 1.005] and d1_ep2 [0.995, 1.012] -> overlap [0.995, 1.005] -> MATCHED
    # 4.0 um (D5, R=111.6, tol=0.0358): d5_match [3.992, 4.015] and d5_ep2 [3.985, 4.008] -> overlap [3.992, 4.008] -> MATCHED
    # 2.0 um (D3, R=40.6, tol=0.0493): d3_no_overlap [1.960, 1.980] (mid=1.970) and d3_ep2_no_overlap [2.010, 2.030] (mid=2.020)
    #   both within tol=0.0493, but intervals [1.960, 1.980] and [2.010, 2.030] DO NOT OVERLAP -> REJECTED!
    wave_lookup = {
        "qr2/level2/2025W25_1B/d1_off.fits": (0.850, 0.865, 0.8575),
        "qr2/level2/2025W25_1B/d1_match.fits": (0.988, 1.005, 0.9965),
        "qr2/level2/2025W25_1B/d5_match.fits": (3.992, 4.015, 4.0035),
        "qr2/level2/2025W25_1B/d3_no_overlap.fits": (1.960, 1.980, 1.970),
        "qr2/level2/2025W50_1A/d1_ep2.fits": (0.995, 1.012, 1.0035),
        "qr2/level2/2025W50_1A/d5_ep2.fits": (3.985, 4.008, 3.9965),
        "qr2/level2/2025W50_1A/d3_ep2_no_overlap.fits": (2.010, 2.030, 2.020),
    }

    def fake_wave_range(_s3, _bucket, key, _ra, _dec, size_deg=0.1):
        return wave_lookup.get(key)

    with patch("urllib.request.urlopen") as mock_urlopen, patch(
        "worker.sources.irsa.fetch_cutout_wavelength_range", side_effect=fake_wave_range
    ):
        mock_resp = MagicMock()
        import json
        mock_resp.read.return_value = json.dumps(mock_tap_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        candidates_by_epoch = find_candidate_files(15.0, -20.0, wavelength_tol_k=1.0)

        assert 1 in candidates_by_epoch
        assert 2 in candidates_by_epoch

        # Only 1.0 um (D1) and 4.0 um (D5) matched with physical overlap; 2.0 um (D3) had no overlap and was rejected!
        ep1_keys = [f["s3_key"] for f in candidates_by_epoch[1]]
        ep2_keys = [f["s3_key"] for f in candidates_by_epoch[2]]

        assert ep1_keys == [
            "qr2/level2/2025W25_1B/d1_match.fits",
            "qr2/level2/2025W25_1B/d5_match.fits",
        ]
        assert ep2_keys == [
            "qr2/level2/2025W50_1A/d1_ep2.fits",
            "qr2/level2/2025W50_1A/d5_ep2.fits",
        ]
        # Verify shared overlap bounds are recorded
        assert np.isclose(candidates_by_epoch[1][0]["shared_w_min"], 0.995)
        assert np.isclose(candidates_by_epoch[1][0]["shared_w_max"], 1.005)


def test_find_candidate_files_single_epoch_not_blinkable():
    # Only 1 epoch in TAP results -> cannot form a >=2 epoch wavelength group
    wkb_full = _create_mock_wkb_polygon(10.0, 20.0, -25.0, -15.0)
    table_data = [
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d1.fits", "SPHEREx-D1", "60842.1", wkb_full],
        ["ibe/data/spherex/qr2/level2/2025W25_1B/d5.fits", "SPHEREx-D5", "60842.2", wkb_full],
    ]
    mock_tap_response = {
        "VOTABLE": {
            "RESOURCE_ARRAY": [{
                "TABLE": {
                    "FIELD_ARRAY": [
                        {"<xmlattr>": {"name": "uri"}},
                        {"<xmlattr>": {"name": "energy_bandpassname"}},
                        {"<xmlattr>": {"name": "time_bounds_lower"}},
                        {"<xmlattr>": {"name": "poly"}},
                    ],
                    "DATA": {"TABLEDATA": table_data}
                }
            }]
        }
    }
    with patch("urllib.request.urlopen") as mock_urlopen, patch(
        "worker.sources.irsa.fetch_cutout_wavelength_range", return_value=(0.99, 1.01, 1.00)
    ):
        mock_resp = MagicMock()
        import json
        mock_resp.read.return_value = json.dumps(mock_tap_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        candidates_by_epoch = find_candidate_files(15.0, -20.0)
        assert candidates_by_epoch == {}  # Not blinkable -> no wavelength group has >=2 epochs


def test_fetch_fits_to_scratch_cleanup():
    with tempfile.TemporaryDirectory() as scratch:
        dummy_file_content = b"SIMPLE  =                    T" + b" " * 2850
        with patch("worker.sources.s3.download_fits") as mock_dl:
            def fake_dl(key, local_path):
                with open(local_path, "wb") as f:
                    f.write(dummy_file_content)
                return local_path
            mock_dl.side_effect = fake_dl

            target_path = None
            with fetch_fits_to_scratch("qr2/level2/test.fits", scratch_dir=scratch) as p:
                target_path = p
                assert os.path.exists(target_path)
                assert os.path.getsize(target_path) == 2880

            # Verified: after context exit, scratch file and job dir are deleted
            assert not os.path.exists(target_path)


def test_fetch_ranged_cutout_with_retry_and_parallel_threads():
    from astropy.io import fits
    from worker.sources.s3 import fetch_ranged_cutout

    # Build a synthetic MEF byte buffer in memory with Primary, IMAGE, FLAGS, VARIANCE
    hdr = fits.Header()
    hdr["SIMPLE"] = True
    hdr["BITPIX"] = 8
    hdr["NAXIS"] = 0
    prim_bytes = hdr.tostring().encode("ascii")

    img_hdr = fits.Header()
    img_hdr["XTENSION"] = "IMAGE"
    img_hdr["BITPIX"] = -32
    img_hdr["NAXIS"] = 2
    img_hdr["NAXIS1"] = 2040
    img_hdr["NAXIS2"] = 2040
    img_hdr["CRPIX1"] = 1020.0
    img_hdr["CRPIX2"] = 1020.0
    img_hdr["CRVAL1"] = 15.0
    img_hdr["CRVAL2"] = -20.0
    img_hdr["CTYPE1"] = "RA---TAN"
    img_hdr["CTYPE2"] = "DEC--TAN"
    img_hdr["CD1_1"] = -0.00170833
    img_hdr["CD1_2"] = 0.0
    img_hdr["CD2_1"] = 0.0
    img_hdr["CD2_2"] = 0.00170833
    img_hdr_bytes = img_hdr.tostring().encode("ascii")

    # Pad to 32768 for initial header read
    head_buf = prim_bytes + img_hdr_bytes + b" " * (32768 - len(prim_bytes) - len(img_hdr_bytes))

    flg_hdr = fits.Header()
    flg_hdr["XTENSION"] = "IMAGE"
    flg_hdr["BITPIX"] = 32
    flg_hdr["NAXIS"] = 2
    flg_hdr["NAXIS1"] = 2040
    flg_hdr["NAXIS2"] = 2040
    flg_hdr["BZERO"] = 2147483648
    flg_hdr_raw = flg_hdr.tostring().encode("ascii")
    flg_hdr_bytes = flg_hdr_raw + b" " * (14400 - len(flg_hdr_raw))

    call_count = 0

    def fake_get_object(Bucket, Key, Range):
        nonlocal call_count
        call_count += 1
        # Simulate one transient read failure on the 4th request to verify retry + backoff
        if call_count == 4:
            raise TimeoutError("Simulated S3 read_timeout")
        r_str = Range.replace("bytes=", "")
        b0, b1 = [int(x) for x in r_str.split("-")]
        length = b1 - b0 + 1
        if b0 == 0:
            payload = head_buf[:length]
        elif length == 14400:
            payload = flg_hdr_bytes[:length]
        else:
            payload = b"\x00" * length
        body = MagicMock()
        body.read.return_value = payload
        return {"Body": body}

    mock_s3 = MagicMock()
    mock_s3.get_object.side_effect = fake_get_object

    with patch("time.sleep"):
        res = fetch_ranged_cutout(
            "qr2/level2/mock.fits",
            15.0,
            -20.0,
            size_deg=0.1,
            margin=8,
            num_threads=6,
            s3_client=mock_s3,
        )

    assert res["http_gets"] == 9  # 3 header reads + 6 parallel half-strip reads
    assert res["retries_used"] == 1
    assert res["image_cutout"].shape == res["flags_cutout"].shape == res["variance_cutout"].shape


def test_tie_break_orders_by_overlap_then_mjd_not_error():
    """Verify candidates within 0.002 um of min_err are ordered by larger shared overlap, then earlier MJD (not smaller error)."""
    import json

    wkb_full = _create_mock_wkb_polygon(10.0, 20.0, -25.0, -15.0)
    table_data = [
        # Epoch 1 reference exposure: [0.9850, 1.0050], mid = 0.9950, err = 0.0050
        ["ibe/data/spherex/qr2/level2/2025W25_1B/ep1_ref.fits", "SPHEREx-D1", "60842.0", wkb_full, "39.1"],
        # Epoch 2 candidate A: slightly smaller error (mid=1.0010, err=0.0010), smaller overlap with Ep1 ([0.9930, 1.0090] -> ov=0.0120), later MJD
        ["ibe/data/spherex/qr2/level2/2025W50_1A/ep2_smaller_err_less_ov.fits", "SPHEREx-D1", "61040.0", wkb_full, "39.1"],
        # Epoch 2 candidate B: within 0.002 um of min_err (mid=0.9975, err=0.0025, delta_err=0.0015 <= 0.002), larger overlap with Ep1 ([0.9895, 1.0055] -> ov=0.0155), later MJD
        ["ibe/data/spherex/qr2/level2/2025W50_1A/ep2_larger_ov_later_mjd.fits", "SPHEREx-D1", "61038.0", wkb_full, "39.1"],
        # Epoch 2 candidate C: within 0.002 um of min_err (mid=0.9972, err=0.0028, delta_err=0.0018 <= 0.002), SAME overlap with Ep1 ([0.9895, 1.0049] -> ov=0.0155), EARLIER MJD
        ["ibe/data/spherex/qr2/level2/2025W50_1A/ep2_larger_ov_earlier_mjd.fits", "SPHEREx-D1", "61030.0", wkb_full, "39.1"],
    ]
    mock_tap_response = {
        "VOTABLE": {
            "RESOURCE_ARRAY": [{
                "TABLE": {
                    "FIELD_ARRAY": [
                        {"<xmlattr>": {"name": "uri"}},
                        {"<xmlattr>": {"name": "energy_bandpassname"}},
                        {"<xmlattr>": {"name": "time_bounds_lower"}},
                        {"<xmlattr>": {"name": "poly"}},
                        {"<xmlattr>": {"name": "energy_resolvingpower"}},
                    ],
                    "DATA": {"TABLEDATA": table_data},
                }
            }]
        }
    }
    wave_lookup = {
        "qr2/level2/2025W25_1B/ep1_ref.fits": (0.9850, 1.0050, 0.9950),
        "qr2/level2/2025W50_1A/ep2_smaller_err_less_ov.fits": (0.9930, 1.0090, 1.0010),
        "qr2/level2/2025W50_1A/ep2_larger_ov_later_mjd.fits": (0.9895, 1.0055, 0.9975),
        "qr2/level2/2025W50_1A/ep2_larger_ov_earlier_mjd.fits": (0.9895, 1.0061, 0.9978),
    }

    with patch("urllib.request.urlopen") as mock_urlopen, patch(
        "worker.sources.irsa.fetch_cutout_wavelength_range",
        side_effect=lambda _s3, _b, k, _r, _d, size_deg=0.1: wave_lookup.get(k),
    ):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps(mock_tap_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        res = find_candidate_files(15.0, -20.0, target_wavelengths_um=[1.0])
        assert res[2][0]["s3_key"] == "qr2/level2/2025W50_1A/ep2_larger_ov_earlier_mjd.fits"
        assert res[2][0]["tie_broken"] is True


def test_apply_flags_mask_transient_outlier_config():
    from worker.processing.masking import apply_flags_mask

    # Pixel 0: clean (0), Pixel 1: Bit 0 MP_TRANSIENT (1), Pixel 2: Bit 19 MP_OUTLIER (524288), Pixel 3: Bit 10 MP_HOT (1024)
    flags = np.array([[0, 1, 1 << 19, 1 << 10]], dtype=np.uint32)
    mask_default = apply_flags_mask(flags, mask_transient_and_outlier=True)
    assert mask_default.tolist() == [[False, True, True, True]]

    mask_unmasked = apply_flags_mask(flags, mask_transient_and_outlier=False)
    assert mask_unmasked.tolist() == [[False, False, False, True]]


def test_shared_wavelength_mask_and_flagged_visible_overlay():
    from worker.processing.masking import (
        apply_shared_wavelength_mask,
        extract_transient_outlier_overlay,
    )
    from worker.render.tiles import render_tile_image

    wmap = np.array([[0.980, 0.990, 0.995, 1.005]], dtype=np.float64)
    sh_mask = apply_shared_wavelength_mask(wmap, 0.985, 0.998)
    assert sh_mask.tolist() == [[True, False, False, True]]

    flags = np.array([[0, 1, 1 << 19, (1 << 0) | (1 << 19)]], dtype=np.uint32)
    ov = extract_transient_outlier_overlay(flags)
    assert ov["bit0_mask"].tolist() == [[False, True, False, True]]
    assert ov["bit19_mask"].tolist() == [[False, False, True, True]]
    assert ov["overlay_mask"].tolist() == [[False, True, True, True]]

    img = np.ones((8, 8), dtype=np.float32) * 5.0
    defect_mask = np.zeros((8, 8), dtype=bool)
    vis_mask = np.zeros((8, 8), dtype=bool)
    vis_mask[2:4, 2:4] = True
    webp_bytes = render_tile_image(img, defect_mask, fmt="webp", flagged_visible_mask=vis_mask)
    assert webp_bytes.startswith(b"RIFF")
    assert len(webp_bytes) > 0


