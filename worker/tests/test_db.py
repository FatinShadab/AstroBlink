"""Unit tests for subject database insertion and deduplication logic."""

import math
from unittest.mock import MagicMock, patch

import pytest

from worker.db import ONE_ARCSEC_RAD, find_existing_subject_nearby, insert_subject


def test_one_arcsec_constant():
    # 1 arcsecond in radians
    expected = (1.0 / 3600.0) * (math.pi / 180.0)
    assert math.isclose(ONE_ARCSEC_RAD, expected, rel_tol=1e-9)


def test_insert_subject_skips_when_nearby_exists():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur

    # Mock finding an existing subject
    mock_cur.fetchone.return_value = {
        "id": "existing-uuid-123",
        "ra_deg": 180.0,
        "dec_deg": -2.5,
    }

    subj_id, created = insert_subject(
        conn=mock_conn,
        ra_deg=180.0001,  # within 1 arcsecond
        dec_deg=-2.5,
        size_deg=0.1,
        epochs=[1, 2],
        tile_urls={"1_swir": "test/1_swir.webp"},
    )

    assert subj_id == "existing-uuid-123"
    assert created is False
    # Verified: no INSERT query executed because deduplication triggered
    assert not any("INSERT INTO subjects" in str(c) for c in mock_cur.execute.call_args_list)


def test_insert_subject_inserts_when_none_nearby():
    mock_conn = MagicMock()
    mock_cur = MagicMock()
    mock_conn.cursor.return_value.__enter__.return_value = mock_cur

    # Mock no existing subject found
    mock_cur.fetchone.return_value = None

    subj_id, created = insert_subject(
        conn=mock_conn,
        ra_deg=180.0,
        dec_deg=-2.5,
        size_deg=0.1,
        epochs=[1, 2],
        tile_urls={"1_swir": "test/1_swir.webp"},
        subject_id="new-uuid-456",
    )

    assert subj_id == "new-uuid-456"
    assert created is True
    # Verified: INSERT query executed
    assert any("INSERT INTO subjects" in str(c) for c in mock_cur.execute.call_args_list)
    mock_conn.commit.assert_called_once()
