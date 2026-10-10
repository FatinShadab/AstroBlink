"""Classification schemas — matches contracts/schemas/classification.yaml."""

from uuid import UUID

from pydantic import BaseModel, Field


class Mark(BaseModel):
    epoch: int
    pixel_x: float = Field(..., ge=0)
    pixel_y: float = Field(..., ge=0)
    ra: float = Field(..., ge=0, lt=360)
    dec: float = Field(..., ge=-90, le=90)


class ClassificationRequest(BaseModel):
    subject_id: UUID
    category: str  # classification_category enum
    marks: list[Mark] = Field(default_factory=list)
    load_time_ms: int | None = None


class ClassificationResponse(BaseModel):
    classification_id: UUID
    subject_id: UUID
    category: str
    marks_count: int
    subject_classification_count: int
    subject_retired: bool
    badges_earned: list[str] = Field(default_factory=list)
    message: str | None = None
