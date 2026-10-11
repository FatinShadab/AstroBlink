"""Test validating consensus and candidate export responses against OpenAPI schemas in contracts/."""

from pathlib import Path
import yaml
import jsonschema


def test_consensus_run_response_matches_contract_schema():
    """Verify consensus response conforms to ConsensusRunResponse in contracts/schemas/consensus.yaml."""
    schema_path = Path(__file__).resolve().parents[2] / "contracts" / "schemas" / "consensus.yaml"
    assert schema_path.exists(), f"Schema file not found at {schema_path}"

    with open(schema_path, "r", encoding="utf-8") as f:
        schemas = yaml.safe_load(f)

    # Resolve internal $ref: "#/CandidateSummary" and "#/EpochCluster"
    epoch_cluster_schema = schemas["EpochCluster"]
    candidate_summary_schema = dict(schemas["CandidateSummary"])
    candidate_summary_schema["properties"]["epochs"]["items"] = epoch_cluster_schema

    consensus_run_response_schema = dict(schemas["ConsensusRunResponse"])
    consensus_run_response_schema["properties"]["candidates"]["items"] = candidate_summary_schema

    # Sample response as returned by /api/v1/consensus/run
    sample_response = {
        "subject_id": "22222222-2222-2222-2222-222222222222",
        "classifications_processed": 9,
        "candidates_found": 1,
        "candidates": [
            {
                "candidate_id": "96570758-62b6-47cf-97e9-cbafb0eef5fc",
                "category": "asteroid_neo",
                "n_classifications": 12,
                "mean_reliability": 0.8,
                "motion_arcsec_per_epoch": 20.641,
                "motion_pa_deg": 58.45,
                "epochs": [
                    {
                        "epoch": 1,
                        "centroid_ra": 215.5,
                        "centroid_dec": 12.25,
                        "cluster_size": 6,
                        "dispersion_arcsec": 0.8596,
                    },
                    {
                        "epoch": 2,
                        "centroid_ra": 215.505,
                        "centroid_dec": 12.253,
                        "cluster_size": 6,
                        "dispersion_arcsec": 0.8596,
                    },
                ],
            }
        ],
    }

    # Validate against schema
    jsonschema.validate(instance=sample_response, schema=consensus_run_response_schema)


def test_candidate_list_response_matches_contract_schema():
    """Verify candidate list response conforms to CandidateListResponse in contracts/schemas/candidate.yaml."""
    schema_path = Path(__file__).resolve().parents[2] / "contracts" / "schemas" / "candidate.yaml"
    assert schema_path.exists(), f"Schema file not found at {schema_path}"

    with open(schema_path, "r", encoding="utf-8") as f:
        schemas = yaml.safe_load(f)

    candidate_response_schema = schemas["CandidateResponse"]
    candidate_list_schema = dict(schemas["CandidateListResponse"])
    candidate_list_schema["properties"]["candidates"]["items"] = candidate_response_schema

    sample_list_response = {
        "candidates": [
            {
                "id": "96570758-62b6-47cf-97e9-cbafb0eef5fc",
                "subject_id": "22222222-2222-2222-2222-222222222222",
                "category": "asteroid_neo",
                "status": "new",
                "n_classifications": 12,
                "mean_reliability": 0.8,
                "cluster_dispersion_arcsec": 0.8596,
                "motion_arcsec_per_epoch": 20.641,
            }
        ],
        "count": 1,
    }
    jsonschema.validate(instance=sample_list_response, schema=candidate_list_schema)




def test_401_error_response_matches_contract_schema():
    """Verify 401 Unauthorized response body matches ErrorResponse in contracts/schemas/error.yaml."""
    schema_path = Path(__file__).resolve().parents[2] / "contracts" / "schemas" / "error.yaml"
    assert schema_path.exists(), f"Schema file not found at {schema_path}"

    with open(schema_path, "r", encoding="utf-8") as f:
        schemas = yaml.safe_load(f)

    error_response_schema = schemas["ErrorResponse"]

    sample_401_response = {
        "error": {
            "code": "UNAUTHORIZED",
            "message": "Missing Authorization header.",
            "details": [],
        }
    }

    jsonschema.validate(instance=sample_401_response, schema=error_response_schema)

