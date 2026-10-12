"""Unit tests for worker/main.py process_job pipeline (W12 Steps 2 & 3)."""

import json
from unittest.mock import MagicMock, patch

from astropy.io import fits
import numpy as np

from worker.main import process_job


def _make_mock_img_header(ra=15.0, dec=-20.0):
    hdr = fits.Header()
    hdr["XTENSION"] = "IMAGE"
    hdr["BITPIX"] = -32
    hdr["NAXIS"] = 2
    hdr["NAXIS1"] = 2040
    hdr["NAXIS2"] = 2040
    hdr["CRPIX1"] = 1020.0
    hdr["CRPIX2"] = 1020.0
    hdr["CRVAL1"] = ra
    hdr["CRVAL2"] = dec
    hdr["CTYPE1"] = "RA---TAN"
    hdr["CTYPE2"] = "DEC--TAN"
    hdr["CD1_1"] = -0.00170833
    hdr["CD1_2"] = 0.0
    hdr["CD2_1"] = 0.0
    hdr["CD2_2"] = 0.00170833
    return hdr


def test_process_job_fewer_than_two_epochs_inserts_nothing():
    """Verify a job yielding fewer than 2 matched epochs inserts NO subject and returns reason."""
    mock_conn = MagicMock()
    with patch("worker.main.get_db_connection", return_value=mock_conn), patch(
        "worker.main.find_existing_subject_nearby", return_value=None
    ), patch("worker.main.find_candidate_files", return_value={1: [{"s3_key": "ep1_only.fits"}]}), patch(
        "worker.main.insert_subject"
    ) as mock_insert, patch(
        "worker.main.update_job_status"
    ) as mock_update_status:
        res = process_job({"job_id": "11111111-2222-3333-4444-555555555555", "ra": 15.0, "dec": -20.0, "size_deg": 0.5})

        assert res["status"] == "rejected"
        assert res["subject_id"] is None
        assert "fewer_than_2_matched_epochs" in res["reason"]
        assert res["blinkable"] is False
        mock_insert.assert_not_called()
        mock_update_status.assert_called()


def test_process_job_narrow_slice_tiles_and_sidecar_fields():
    """Verify narrow-slice tile keys, conditional RGB generation, and sidecar provenance fields."""
    mock_conn = MagicMock()
    hdr = _make_mock_img_header(15.0, -20.0)

    def _rec(ep, tw, det, fname, mjd):
        return {
            "s3_key": f"qr2/level2/{fname}",
            "epoch": ep,
            "target_wavelength_um": tw,
            "wavelength_min_um": tw - 0.02,
            "wavelength_max_um": tw + 0.02,
            "shared_w_min": tw - 0.015,
            "shared_w_max": tw + 0.015,
            "shared_overlap_um": 0.03,
            "observation_mjd": mjd,
            "observation_date_utc": "2025-06-24T00:00:00Z" if ep == 1 else "2025-12-26T00:00:00Z",
            "exposure_filename": fname,
            "detector": det,
            "match_quality": "good",
            "marginal": False,
        }

    candidates_by_epoch = {
        1: [
            _rec(1, 1.0, "D1", "ep1_d1.fits", 60850.1),
            _rec(1, 2.0, "D3", "ep1_d3.fits", 60850.2),
            _rec(1, 4.0, "D5", "ep1_d5.fits", 60850.3),
        ],
        2: [
            _rec(2, 1.0, "D1", "ep2_d1.fits", 61030.1),
            _rec(2, 2.0, "D3", "ep2_d3.fits", 61030.2),
            _rec(2, 4.0, "D5", "ep2_d5.fits", 61030.3),
        ],
    }

    def fake_fetch_ranged_cutout(key, ra, dec, size_deg=0.5, **kwargs):
        tw = 1.0 if "d1" in key else (2.0 if "d3" in key else 4.0)
        ny, nx = 60, 60
        return {
            "image_cutout": np.full((ny, nx), 25.0, dtype=np.float32),
            "flags_cutout": np.zeros((ny, nx), dtype=np.int32),
            "variance_cutout": np.ones((ny, nx), dtype=np.float32),
            "wavelength_cutout": np.full((ny, nx), tw, dtype=np.float32),
            "image_header": hdr,
            "bbox": {"x0": 990, "x1": 1050, "y0": 990, "y1": 1050, "nx": 2040, "ny": 2040},
            "bytes_transferred": 500000,
            "http_gets": 9,
            "retries_used": 0,
        }

    uploaded_objects = {}

    def fake_upload_tile(tile_bytes, obj_key, content_type="image/webp"):
        uploaded_objects[obj_key] = (tile_bytes, content_type)
        return obj_key

    with patch("worker.main.get_db_connection", return_value=mock_conn), patch(
        "worker.main.find_existing_subject_nearby", return_value=None
    ), patch("worker.main.find_candidate_files", return_value=candidates_by_epoch), patch(
        "worker.main.fetch_ranged_cutout", side_effect=fake_fetch_ranged_cutout
    ), patch(
        "worker.main.upload_tile", side_effect=fake_upload_tile
    ), patch(
        "worker.main.insert_subject", side_effect=lambda conn, **kw: (kw["subject_id"], True)
    ) as mock_insert, patch(
        "worker.main.update_job_status"
    ):
        res = process_job({"job_id": "22222222-3333-4444-5555-666666666666", "ra": 15.0, "dec": -20.0, "size_deg": 0.1})

        assert res["status"] == "completed"
        assert res["epochs"] == [1, 2]
        assert res["blinkable"] is True
        expected_keys = {
            "1_1.0um",
            "1_2.0um",
            "1_4.0um",
            "1_rgb",
            "2_1.0um",
            "2_2.0um",
            "2_4.0um",
            "2_rgb",
        }
        assert set(res["tile_urls"].keys()) == expected_keys
        mock_insert.assert_called_once()

        # Check sidecar JSON uploaded next to 1_1.0um.webp
        subj_id = res["subject_id"]
        sidecar_raw, ctype = uploaded_objects[f"{subj_id}/1_1.0um.wcs.json"]
        assert ctype == "application/json"
        sidecar = json.loads(sidecar_raw.decode("utf-8"))
        assert sidecar["epoch"] == 1
        assert sidecar["target_wavelength_um"] == 1.0
        assert "wavelength_min_um" in sidecar
        assert "wavelength_max_um" in sidecar
        assert "shared_wavelength_min_um" in sidecar
        assert "shared_wavelength_max_um" in sidecar
        assert "shared_overlap_um" in sidecar
        assert sidecar["observation_mjd"] == 60850.1
        assert sidecar["exposure_filename"] == "ep1_d1.fits"
        assert sidecar["detector"] == "D1"
        assert sidecar["match_quality"] == "good"
        assert "tiles" in sidecar


def test_process_job_partial_slices_no_rgb_and_dedup():
    """Verify tile_urls has only existing tiles (no RGB if 2.0um missing, no placeholders) and dedup works."""
    mock_conn = MagicMock()
    hdr = _make_mock_img_header(15.0, -20.0)

    def _rec(ep, tw, det, fname, mjd):
        return {
            "s3_key": f"qr2/level2/{fname}",
            "epoch": ep,
            "target_wavelength_um": tw,
            "wavelength_min_um": tw - 0.02,
            "wavelength_max_um": tw + 0.02,
            "shared_w_min": tw - 0.015,
            "shared_w_max": tw + 0.015,
            "shared_overlap_um": 0.03,
            "observation_mjd": mjd,
            "observation_date_utc": "2025-06-24T00:00:00Z",
            "exposure_filename": fname,
            "detector": det,
            "match_quality": "marginal",
            "marginal": True,
        }

    # Only 1.0 um and 4.0 um matched (no 2.0 um) -> should produce 4 tiles (no 1_rgb or 2_rgb)
    candidates_by_epoch = {
        1: [
            _rec(1, 1.0, "D1", "ep1_d1.fits", 60850.1),
            _rec(1, 4.0, "D5", "ep1_d5.fits", 60850.3),
        ],
        2: [
            _rec(2, 1.0, "D1", "ep2_d1.fits", 61030.1),
            _rec(2, 4.0, "D5", "ep2_d5.fits", 61030.3),
        ],
    }

    def fake_fetch_ranged_cutout(key, ra, dec, size_deg=0.5, **kwargs):
        tw = 1.0 if "d1" in key else 4.0
        ny, nx = 60, 60
        return {
            "image_cutout": np.full((ny, nx), 25.0, dtype=np.float32),
            "flags_cutout": np.zeros((ny, nx), dtype=np.int32),
            "variance_cutout": np.ones((ny, nx), dtype=np.float32),
            "wavelength_cutout": np.full((ny, nx), tw, dtype=np.float32),
            "image_header": hdr,
            "bbox": {"x0": 990, "x1": 1050, "y0": 990, "y1": 1050, "nx": 2040, "ny": 2040},
            "bytes_transferred": 250000,
            "http_gets": 9,
            "retries_used": 0,
        }

    with patch("worker.main.get_db_connection", return_value=mock_conn), patch(
        "worker.main.find_existing_subject_nearby", return_value=None
    ), patch("worker.main.find_candidate_files", return_value=candidates_by_epoch), patch(
        "worker.main.fetch_ranged_cutout", side_effect=fake_fetch_ranged_cutout
    ), patch(
        "worker.main.upload_tile", side_effect=lambda b, k, content_type="image/webp": k
    ), patch(
        "worker.main.insert_subject", side_effect=lambda conn, **kw: (kw["subject_id"], True)
    ) as mock_insert, patch(
        "worker.main.update_job_status"
    ):
        res = process_job({"job_id": "33333333-4444-5555-6666-777777777777", "ra": 15.0, "dec": -20.0, "size_deg": 0.5})
        assert res["status"] == "completed"
        assert set(res["tile_urls"].keys()) == {"1_1.0um", "1_4.0um", "2_1.0um", "2_4.0um"}
        assert "1_rgb" not in res["tile_urls"]
        assert "2_rgb" not in res["tile_urls"]
        insert_kwargs = mock_insert.call_args.kwargs
        assert insert_kwargs["size_deg"] == 0.5
        assert insert_kwargs["epochs"] == [1, 2]

    # Verify idempotent re-run deduplication within 1"
    with patch("worker.main.get_db_connection", return_value=mock_conn), patch(
        "worker.main.find_existing_subject_nearby",
        return_value={"id": "existing-uuid", "epochs": [1, 2], "tile_urls": {"1_1.0um": "k"}, "mask_fraction": 0.25},
    ), patch("worker.main.update_job_status"):
        dedup_res = process_job({"job_id": "44444444-5555-6666-7777-888888888888", "ra": 15.0, "dec": -20.0})
        assert dedup_res["status"] == "deduped"
        assert dedup_res["subject_id"] == "existing-uuid"

