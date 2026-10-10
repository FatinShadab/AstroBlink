"""Shared test fixtures for the API test suite."""

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.fixture
async def client():
    """Async HTTP client for testing FastAPI endpoints.

    Note: This does NOT connect to a real database or Redis.
    Integration tests requiring DB/Redis will need separate fixtures.
    """
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
