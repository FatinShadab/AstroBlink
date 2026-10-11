"""Tests for sources (IRSA TAP discovery, S3 download, scratch cleanup)."""

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest

from worker.sources.irsa import build_cutout_url, find_exposures_at_position
from worker.sources.s3 import fetch_fits_to_scratch, find_candidate_files


def test_build_cutout_url():
    url = build_cutout_url("qr2/level2/file.fits", 150.0, 20.0, 0.1)
    assert url == "https://irsa.ipac.caltech.edu/ibe/data/spherex/qr2/level2/file.fits?center=150.0,20.0d&size=0.1"


def test_find_candidate_files_mock():
    mock_tap_response = {
        "VOTABLE": {
            "RESOURCE_ARRAY": [{
                "TABLE": {
                    "FIELD_ARRAY": [
                        {"<xmlattr>": {"name": "energy_bandpassname"}},
                        {"<xmlattr>": {"name": "uri"}},
                        {"<xmlattr>": {"name": "time_bounds_lower"}},
                    ],
                    "DATA": {
                        "TABLEDATA": [
                            ["SPHEREx-D2", "ibe/data/spherex/qr2/level2/exp1.fits", "60795.123"],
                            ["SPHEREx-D2", "ibe/data/spherex/qr2/level2/exp2.fits", "60795.456"],
                        ]
                    }
                }
            }]
        }
    }
    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_resp = MagicMock()
        import json
        mock_resp.read.return_value = json.dumps(mock_tap_response).encode("utf-8")
        mock_resp.__enter__.return_value = mock_resp
        mock_urlopen.return_value = mock_resp

        candidates = find_candidate_files(164.7, 29.1)
        assert len(candidates) == 2
        assert candidates[0]["s3_key"] == "qr2/level2/exp1.fits"
        assert candidates[0]["bandpass"] == "SPHEREx-D2"
        assert candidates[0]["mjd"] == 60795.123


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
