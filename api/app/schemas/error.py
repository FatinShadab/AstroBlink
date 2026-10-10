"""Error response schema — matches contracts/schemas/error.yaml."""

from pydantic import BaseModel


class ErrorDetail(BaseModel):
    field: str | None = None
    issue: str | None = None


class ErrorBody(BaseModel):
    code: str
    message: str
    details: list[ErrorDetail] | None = None


class ErrorResponse(BaseModel):
    error: ErrorBody
