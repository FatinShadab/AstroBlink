"""AstroBlink API — FastAPI application entry point.

Middleware stack: CORS -> request logging.
Auth, rate-limiting, and HTTPS redirect are Phase 2.
See ARCHITECTURE.md §2.2 for the full middleware design.
"""

from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routers import candidates, classify, consensus, cutouts, health, subjects


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup: initialize Redis connection pool.
    app.state.redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    yield
    # Shutdown: close Redis.
    await app.state.redis.aclose()


app = FastAPI(
    title="AstroBlink API",
    version="0.1.0",
    description="Citizen-science blink comparator for NASA's SPHEREx mission.",
    lifespan=lifespan,
)

# -- Middleware --
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -- Routers --
app.include_router(health.router)
app.include_router(cutouts.router, prefix="/api/v1", tags=["cutouts"])
app.include_router(subjects.router, prefix="/api/v1", tags=["subjects"])
app.include_router(classify.router, prefix="/api/v1", tags=["classify"])
app.include_router(consensus.router, prefix="/api/v1", tags=["consensus"])
app.include_router(candidates.router, prefix="/api/v1", tags=["candidates"])
