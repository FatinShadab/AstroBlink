# ==============================================================
# AstroBlink Worker — Multi-stage Dockerfile
# Build context: this folder (worker/)
# See docs/ARCHITECTURE.md §2.3
# ==============================================================

# ── Build stage ───────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS builder

WORKDIR /build

# Install only the dependency manifest first (layer caching).
COPY requirements.txt .
RUN python -m venv /opt/venv \
    && /opt/venv/bin/pip install --no-cache-dir --upgrade pip \
    && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy application source.
COPY worker/ worker/

# ── Dev stage (optional target for docker compose dev) ────────
FROM builder AS dev

COPY requirements-dev.txt .
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements-dev.txt

COPY tests/ tests/
COPY pyproject.toml .

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "\
import os, time, sys; \
path='/tmp/heartbeat'; \
exists=os.path.exists(path); \
fresh=(time.time()-os.path.getmtime(path)<30) if exists else False; \
sys.exit(0 if fresh else 1)"

CMD ["python", "-m", "worker.main"]

# ── Runtime stage (default) ──────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/astroblink/AstroBlink" \
      org.opencontainers.image.title="astroblink-worker" \
      org.opencontainers.image.description="AstroBlink ingestion worker — S3/IRSA, Astropy, binning, tiles"

# Non-root user with fixed UID/GID.
RUN groupadd --gid 10001 astroblink \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /bin/false astroblink

WORKDIR /app

# Copy venv and application from builder.
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/worker ./worker

# Create writable scratch directory for FITS downloads.
# Size expectation: ~500 MB peak (5-10 Level 2 FITS at ~67 MB each).
RUN mkdir -p /tmp/astroblink /tmp \
    && chown -R astroblink:astroblink /app /tmp/astroblink /tmp

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    FITS_SCRATCH_DIR=/tmp/astroblink

# Health check: verify heartbeat file is fresh (< 30s old).
# The worker's background thread writes to /tmp/heartbeat every loop.
# No HTTP port — uses file freshness check only.
HEALTHCHECK --interval=15s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "\
import os, time, sys; \
path='/tmp/heartbeat'; \
exists=os.path.exists(path); \
fresh=(time.time()-os.path.getmtime(path)<30) if exists else False; \
sys.exit(0 if fresh else 1)"

USER 10001

# No EXPOSE — the worker has no HTTP port.

# Exec-form CMD for clean signal handling.
CMD ["python", "-m", "worker.main"]
