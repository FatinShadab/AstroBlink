"""Health check endpoints.

GET /health — infrastructure health (Docker HEALTHCHECK target).
GET /api/v1/health — versioned alias.
"""

from fastapi import APIRouter, Request

from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
@router.get("/api/v1/health", response_model=HealthResponse, include_in_schema=False)
async def health_check(request: Request) -> HealthResponse:
    # Check Redis
    redis_status = "disconnected"
    try:
        pong = await request.app.state.redis.ping()
        if pong:
            redis_status = "connected"
    except Exception:
        pass

    # Check PostgreSQL
    db_status = "disconnected"
    try:
        from sqlalchemy import text

        from app.db import engine

        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
            db_status = "connected"
    except Exception:
        pass

    status = "ok" if db_status == "connected" and redis_status == "connected" else "degraded"
    return HealthResponse(status=status, db=db_status, redis=redis_status)
