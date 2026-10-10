"""Candidate schemas — matches contracts/schemas/candidate.yaml."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class CandidateResponse(BaseModel):
    id: UUID
    subject_id: UUID
    category: str
    status: str  # candidate_status enum
    n_classifications: int
    mean_reliability: float
    cluster_dispersion_arcsec: float | None = None
    motion_arcsec_per_epoch: float | None = None
    motion_pa_deg: float | None = None
    created_at: datetime
    updated_at: datetime


class CandidateListResponse(BaseModel):
    candidates: list[CandidateResponse]
    count: int


class CandidateStatusUpdateRequest(BaseModel):
    status: str  # "confirmed" | "rejected"
    rationale: str | None = None
