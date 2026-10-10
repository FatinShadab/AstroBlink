"""Health endpoint tests."""

import pytest


@pytest.mark.asyncio
async def test_health_endpoint_returns_200(client):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert "db" in data
    assert "redis" in data


@pytest.mark.asyncio
async def test_health_v1_alias(client):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
