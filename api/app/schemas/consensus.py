"""Consensus schemas — matches contracts/schemas/consensus.yaml."""

from uuid import UUID

from pydantic import BaseModel, Field


class ConsensusRunRequest(BaseModel):
    subject_id: UUID | None = None
    batch: bool = False
    epsilon_arcsec: float = Field(9.2, ge=3.0, le=60.0)
    min_pts: int = Field(3, ge=2, le=8)
    max_displacement_arcsec: float = Field(30.0, ge=5.0, le=300.0)


class EpochCluster(BaseModel):
    epoch: int
    centroid_ra: float
    centroid_dec: float
    cluster_size: int
    dispersion_arcsec: float


class CandidateSummary(BaseModel):
    candidate_id: UUID
    category: str
    n_classifications: int
    mean_reliability: float
    motion_arcsec_per_epoch: float | None = None
    motion_pa_deg: float | None = None
    epochs: list[EpochCluster] = Field(default_factory=list)


class ConsensusRunResponse(BaseModel):
    subject_id: UUID
    classifications_processed: int
    candidates_found: int
    candidates: list[CandidateSummary] = Field(default_factory=list)


class ConsensusBatchResponse(BaseModel):
    batch_job_id: UUID
    subjects_queued: int
    message: str | None = None
