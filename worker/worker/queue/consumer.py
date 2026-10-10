"""Redis job queue consumer. BRPOP from 'astroblink:ingest_jobs'.

Payload schema: contracts/schemas/ingest_job.yaml
See ARCHITECTURE.md §2.5.
"""

import json

import redis

from worker.config import settings


def pop_job(r: redis.Redis) -> dict | None:
    """Pop next job from Redis queue. Returns dict or None on timeout."""
    result = r.brpop(settings.redis_queue_key, timeout=settings.brpop_timeout)
    if result is None:
        return None
    _key, raw = result
    return json.loads(raw)


def push_job(r: redis.Redis, payload: dict) -> None:
    """Push a job onto the Redis queue (for tests/batch scripts)."""
    r.lpush(settings.redis_queue_key, json.dumps(payload))
