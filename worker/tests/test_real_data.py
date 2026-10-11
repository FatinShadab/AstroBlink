"""Integration tests using real SPHEREx data from S3.

Excluded from default CI via:
    @pytest.mark.real_data
and addopts = "-m 'not real_data'" in pyproject.toml.

To run:
    pytest -m real_data tests/test_real_data.py
"""

import time
import pytest

from worker.main import process_job
from worker.sources.s3 import find_candidate_files

REAL_TARGETS = [
    {"name": "Target 1 (2025W17_4B / 1D1)", "ra": 160.61529, "dec": 30.66915},
    {"name": "Target 2 (2025W18_1B / 1D1)", "ra": 276.26139, "dec": 64.82577},
    {"name": "Target 3 (2025W18_2B / 1D1)", "ra": 349.78099, "dec": -56.49399},
    {"name": "Target 4 (2025W19_1B / 1D1)", "ra": 207.74854, "dec": 64.95670},
    {"name": "Target 5 (2025W20_1C / 1D1)", "ra": 158.73328, "dec": 45.46230},
]


@pytest.mark.real_data
def test_real_target_candidate_discovery():
    """Verify that IRSA TAP finds real candidate exposures for verified targets."""
    for target in REAL_TARGETS:
        candidates = find_candidate_files(target["ra"], target["dec"], limit=3)
        assert len(candidates) > 0, f"No candidates found for {target['name']}"
        assert candidates[0]["s3_key"].startswith("qr2/level2/")
        assert candidates[0]["s3_key"].endswith(".fits")
