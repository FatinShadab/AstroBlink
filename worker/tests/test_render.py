"""Unit tests for tile rendering and WCS sidecar generation."""

import json
from unittest.mock import MagicMock, patch

from astropy.wcs import WCS
import numpy as np
from PIL import Image
import pytest

from worker.render.tiles import MAX_TILE_BYTES, asinh_stretch, render_tile_image, upload_tile
from worker.render.wcs_sidecar import build_wcs_sidecar_dict, write_wcs_sidecar


def test_asinh_stretch():
    data = np.array([0.0, 10.0, 100.0, 1000.0], dtype=np.float32)
    stretched = asinh_stretch(data)
    assert stretched.dtype == np.uint8
    assert stretched[0] == 0
    assert stretched[-1] == 255
    assert stretched[1] < stretched[2] < stretched[3]


def test_render_tile_image_webp_under_budget():
    # 60x60 image
    image = np.random.uniform(0.0, 50.0, size=(60, 60)).astype(np.float32)
    mask = np.zeros((60, 60), dtype=bool)
    mask[10:20, 10:20] = True  # Add masked region with hatching

    tile_bytes = render_tile_image(image, mask, fmt="webp", quality=85)
    assert isinstance(tile_bytes, bytes)
    assert len(tile_bytes) <= MAX_TILE_BYTES
    assert len(tile_bytes) > 0

    # Ensure valid WebP image
    import io
    img = Image.open(io.BytesIO(tile_bytes))
    assert img.size == (60, 60)


def test_render_tile_image_rgb():
    rgb = np.random.uniform(0.0, 100.0, size=(3, 60, 60)).astype(np.float32)
    mask = np.zeros((60, 60), dtype=bool)

    tile_bytes = render_tile_image(rgb, mask, fmt="webp")
    assert len(tile_bytes) <= MAX_TILE_BYTES


def test_build_wcs_sidecar_dict():
    w = WCS(naxis=2)
    w.wcs.crpix = [30.0, 30.0]
    w.wcs.crval = [180.0, -2.5]
    w.wcs.cdelt = [-0.0017, 0.0017]
    w.wcs.ctype = ["RA---TAN", "DEC--TAN"]

    sidecar = build_wcs_sidecar_dict(w, (60, 60))
    assert sidecar["crpix"] == [30.0, 30.0]
    assert sidecar["crval"] == [180.0, -2.5]
    assert sidecar["naxis"] == [60, 60]
    assert sidecar["ctype"] == ["RA---TAN", "DEC--TAN"]
    assert "cd" in sidecar
    assert len(sidecar["cd"]) == 2


def test_upload_tile_mock():
    with patch("worker.render.tiles.get_tile_s3_client") as mock_client_factory:
        mock_s3 = MagicMock()
        mock_client_factory.return_value = mock_s3

        res = upload_tile(b"test_tile_data", "subj123/1_swir.webp")
        assert res == "subj123/1_swir.webp"
        mock_s3.put_object.assert_called_once_with(
            Bucket="astroblink-tiles",
            Key="subj123/1_swir.webp",
            Body=b"test_tile_data",
            ContentType="image/webp",
        )
