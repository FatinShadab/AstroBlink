"""Subject schemas — matches contracts/schemas/subject.yaml."""

from uuid import UUID

from pydantic import BaseModel


class SubjectResponse(BaseModel):
    id: UUID
    ra_deg: float
    dec_deg: float
    size_deg: float
    epochs: list[int]
    tile_urls: dict[str, str]  # "{epoch}_{band}" -> URL
    wcs_urls: dict[str, str] | None = None
    classification_count: int | None = None
    retired: bool | None = None
