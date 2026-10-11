"""Tests for authentication and endpoint access control (Phase C8).

Verifies:
- POST /api/v1/consensus/run:
  - Missing Authorization header -> 401 with WWW-Authenticate: Bearer
  - Invalid token -> 401 with WWW-Authenticate: Bearer
  - Valid token -> passes auth (does not 401)
- GET /api/v1/candidates/export:
  - Missing Authorization header -> 401 with WWW-Authenticate: Bearer
  - Invalid token -> 401 with WWW-Authenticate: Bearer
  - Valid token -> passes auth (does not 401)
- Public endpoints:
  - GET /api/v1/subjects/next: does not require auth header (public)
  - POST /api/v1/classify: does not require auth header (public)
"""

import pytest
from httpx import ASGITransport, AsyncClient

from app.config import settings
from app.main import app


from unittest.mock import AsyncMock, MagicMock
from app.db import get_db


@pytest.fixture
async def async_client():
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.mappings.return_value.first.return_value = None
    mock_db.execute.return_value = mock_result
    app.dependency_overrides[get_db] = lambda: mock_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.pop(get_db, None)


@pytest.mark.asyncio
async def test_consensus_run_auth_no_header(async_client: AsyncClient):
    """POST /api/v1/consensus/run without auth returns 401."""
    res = await async_client.post("/api/v1/consensus/run", json={"batch": True})
    assert res.status_code == 401
    assert "Bearer" in res.headers.get("www-authenticate", "")
    data = res.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_consensus_run_auth_wrong_token(async_client: AsyncClient):
    """POST /api/v1/consensus/run with invalid token returns 401."""
    res = await async_client.post(
        "/api/v1/consensus/run",
        json={"batch": True},
        headers={"Authorization": "Bearer totally-wrong-token"},
    )
    assert res.status_code == 401
    assert "Bearer" in res.headers.get("www-authenticate", "")
    data = res.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_consensus_run_auth_valid_token(async_client: AsyncClient):
    """POST /api/v1/consensus/run with valid token passes auth (202 batch response)."""
    res = await async_client.post(
        "/api/v1/consensus/run",
        json={"batch": True},
        headers={"Authorization": f"Bearer {settings.admin_token}"},
    )
    # Batch run with valid token returns 202
    assert res.status_code == 202


@pytest.mark.asyncio
async def test_candidates_export_auth_no_header(async_client: AsyncClient):
    """GET /api/v1/candidates/export without auth returns 401."""
    res = await async_client.get("/api/v1/candidates/export?format=csv")
    assert res.status_code == 401
    assert "Bearer" in res.headers.get("www-authenticate", "")
    data = res.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_candidates_export_auth_wrong_token(async_client: AsyncClient):
    """GET /api/v1/candidates/export with invalid token returns 401."""
    res = await async_client.get(
        "/api/v1/candidates/export?format=csv",
        headers={"Authorization": "Bearer bad-token-123"},
    )
    assert res.status_code == 401
    assert "Bearer" in res.headers.get("www-authenticate", "")
    data = res.json()
    assert data["error"]["code"] == "UNAUTHORIZED"


@pytest.mark.asyncio
async def test_candidates_export_auth_valid_token(async_client: AsyncClient):
    """GET /api/v1/candidates/export with valid token passes auth (404 when no candidates found, not 401)."""
    res = await async_client.get(
        "/api/v1/candidates/export?format=csv",
        headers={"Authorization": f"Bearer {settings.admin_token}"},
    )
    # Passes auth, returns 404 because mock DB returned no candidates
    assert res.status_code == 404
    assert res.status_code != 401


@pytest.mark.asyncio
async def test_public_endpoints_remain_accessible_without_auth(async_client: AsyncClient):
    """Verify classify and subjects/next remain public (no 401 from missing token)."""
    # subjects/next should proceed without auth (returns 204 when queue is empty, not 401)
    res_subj = await async_client.get("/api/v1/subjects/next")
    assert res_subj.status_code == 204
    assert res_subj.status_code != 401

    # classify with invalid payload gives 422 validation error, never 401
    res_cls = await async_client.post("/api/v1/classify", json={})
    assert res_cls.status_code == 422
    assert res_cls.status_code != 401

