"""Cutout schemas — matches contracts/schemas/cutout.yaml."""

from uuid import UUID

from pydantic import BaseModel, Field


class CutoutFetchRequest(BaseModel):
    ra: float = Field(..., ge=0, lt=360, description="Right ascension in degrees")
    dec: float = Field(..., ge=-90, le=90, description="Declination in degrees")
    size_deg: float = Field(0.1, gt=0, le=1.0, description="Cutout angular size in degrees")


class CutoutFetchResponse(BaseModel):
    job_id: UUID
    status: str  # "queued"
    ra: float
    dec: float
    size_deg: float
    message: str | None = None
