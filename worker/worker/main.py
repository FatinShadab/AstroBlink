"""AstroBlink Ingestion Worker entry point.

Consumes jobs from Redis list (BRPOP with 5s timeout).
A background daemon thread writes a heartbeat file at /tmp/heartbeat
for Docker HEALTHCHECK.

Usage:
    python -m worker.main

See ARCHITECTURE.md \u00a72.3 for the full worker design.
"""

import json
import logging
import os
import signal
import sys
import threading
import time

import redis

from worker.config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("worker")

# Graceful shutdown flag.
_shutdown = threading.Event()


def _heartbeat_writer() -> None:
    """Background daemon thread: writes Unix timestamp to heartbeat file."""
    while not _shutdown.is_set():
        try:
            with open(settings.heartbeat_path, "w") as f:
                f.write(str(int(time.time())))
        except OSError:
            pass
        _shutdown.wait(timeout=2)


def _handle_signal(signum: int, _frame: object) -> None:
    logger.info("Received signal %d, shutting down...", signum)
    _shutdown.set()


def process_job(payload: dict) -> None:
    """Process a single ingestion job.

    Pipeline steps (all stubs — see ARCHITECTURE.md \u00a72.3):
    1. Download Level 2 FITS from S3 (sources/s3.py)
    2. Parse MEF FITS: IMAGE, FLAGS, VARIANCE, WCS-WAVE (processing/fits_parser.py)
    3. Apply FLAGS bitmask + He airglow mask (processing/masking.py)
    4. Bin pixels by wavelength into SWIR/MWIR/RGB (processing/binning.py)
    5. Reproject and co-add per (epoch, band) (processing/reproject.py)
    6. Render tiles as WebP < 250 KB (render/tiles.py)
    7. Write WCS JSON sidecar (render/wcs_sidecar.py)
    8. Upload tiles to MinIO (S3-compatible)
    9. Insert subject row into PostgreSQL
    """
    job_id = payload.get("job_id", "unknown")
    ra = payload.get("ra")
    dec = payload.get("dec")
    size_deg = payload.get("size_deg", 0.1)

    logger.info("Processing job %s: (RA=%.4f, Dec=%.4f, size=%.2f)", job_id, ra, dec, size_deg)

    # Stub: each step would be called here.
    # See individual modules in worker/sources/, worker/processing/, worker/render/.

    logger.info("Job %s completed (stub — no real processing yet).", job_id)


def main() -> None:
    """Main loop: BRPOP from Redis, process jobs."""
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    # Ensure scratch directory exists.
    os.makedirs(settings.fits_scratch_dir, exist_ok=True)

    # Start heartbeat thread.
    hb_thread = threading.Thread(target=_heartbeat_writer, daemon=True)
    hb_thread.start()
    logger.info("Heartbeat writer started at %s", settings.heartbeat_path)

    # Connect to Redis.
    r = redis.from_url(settings.redis_url, decode_responses=True)
    logger.info(
        "Worker started. Listening on Redis key '%s' (BRPOP timeout=%ds)",
        settings.redis_queue_key,
        settings.brpop_timeout,
    )

    while not _shutdown.is_set():
        try:
            result = r.brpop(settings.redis_queue_key, timeout=settings.brpop_timeout)
        except redis.ConnectionError:
            logger.error("Redis connection lost. Retrying in 5s...")
            _shutdown.wait(timeout=5)
            continue

        if result is None:
            # Timeout — no jobs. Loop continues, heartbeat keeps updating.
            continue

        _key, raw = result
        try:
            payload = json.loads(raw)
            process_job(payload)
        except (json.JSONDecodeError, KeyError, TypeError) as exc:
            logger.error("Invalid job payload: %s — %s", raw[:200], exc)

    logger.info("Worker shut down cleanly.")
    r.close()
    sys.exit(0)


if __name__ == "__main__":
    main()
