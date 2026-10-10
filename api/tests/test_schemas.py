"""Contract-shape tests — verify Pydantic schemas match OpenAPI contract."""

import pytest
from pydantic import ValidationError

from app.schemas.classification import ClassificationRequest, Mark
from app.schemas.consensus import ConsensusRunRequest
from app.schemas.cutout import CutoutFetchRequest


def test_cutout_request_valid():
    req = CutoutFetchRequest(ra=180.0, dec=-2.5, size_deg=0.1)
    assert req.ra == 180.0
    assert req.dec == -2.5
    assert req.size_deg == 0.1


def test_cutout_request_ra_out_of_range():
    with pytest.raises(ValidationError):
        CutoutFetchRequest(ra=360.0, dec=0.0)


def test_cutout_request_dec_out_of_range():
    with pytest.raises(ValidationError):
        CutoutFetchRequest(ra=0.0, dec=91.0)


def test_classification_request_with_marks():
    req = ClassificationRequest(
        subject_id="f47ac10b-58cc-4372-a567-0e02b2c3d479",
        category="asteroid_neo",
        marks=[
            Mark(epoch=1, pixel_x=100.0, pixel_y=200.0, ra=180.1, dec=0.5),
            Mark(epoch=2, pixel_x=102.0, pixel_y=201.0, ra=180.12, dec=0.51),
        ],
        load_time_ms=5000,
    )
    assert len(req.marks) == 2
    assert req.category == "asteroid_neo"


def test_classification_request_nothing_empty_marks():
    req = ClassificationRequest(
        subject_id="f47ac10b-58cc-4372-a567-0e02b2c3d479",
        category="nothing",
        marks=[],
    )
    assert req.marks == []


def test_consensus_defaults():
    req = ConsensusRunRequest()
    assert req.epsilon_arcsec == 9.2
    assert req.min_pts == 3
    assert req.max_displacement_arcsec == 30.0
    assert req.batch is False


def test_consensus_epsilon_bounds():
    with pytest.raises(ValidationError):
        ConsensusRunRequest(epsilon_arcsec=2.0)  # below 3.0 min
