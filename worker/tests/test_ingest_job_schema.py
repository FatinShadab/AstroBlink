"""Validate the Redis ingest job payload against contracts/schemas/ingest_job.yaml."""

import json
from pathlib import Path

import yaml

SCHEMA_PATHS = [
    Path(__file__).parent.parent.parent / "contracts" / "schemas" / "ingest_job.yaml",
    Path(__file__).parent.parent / "contracts" / "schemas" / "ingest_job.yaml",
]


def _load_schema() -> dict:
    for p in SCHEMA_PATHS:
        if p.exists():
            with open(p) as f:
                return yaml.safe_load(f)["IngestJobPayload"]
    raise FileNotFoundError(f"ingest_job.yaml not found at: {[str(p) for p in SCHEMA_PATHS]}")


def test_schema_required_fields():
    schema = _load_schema()
    required = schema["required"]
    assert "job_id" in required
    assert "ra" in required
    assert "dec" in required
    assert "size_deg" in required


def test_schema_example_is_valid():
    schema = _load_schema()
    example = schema["example"]
    assert isinstance(example["job_id"], str)
    assert 0 <= example["ra"] < 360
    assert -90 <= example["dec"] <= 90
    assert 0 < example["size_deg"] <= 1.0


def test_payload_roundtrip():
    payload = {"job_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "ra": 180.0, "dec": -2.5, "size_deg": 0.1}
    assert json.loads(json.dumps(payload)) == payload
