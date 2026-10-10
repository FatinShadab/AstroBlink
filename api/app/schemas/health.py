"""Health check response schema."""

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str  # "ok" | "degraded"
    db: str  # "connected" | "disconnected"
    redis: str  # "connected" | "disconnected"
