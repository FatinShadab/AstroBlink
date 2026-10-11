# ==============================================================
# AstroBlink API — Multi-stage Dockerfile
# Build context: this folder (api/)
# See docs/ARCHITECTURE.md §2.2
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
COPY app/ app/
COPY alembic/ alembic/
COPY alembic.ini .

# ── Dev stage (optional target for docker compose dev) ────────
FROM builder AS dev

COPY requirements-dev.txt .
RUN /opt/venv/bin/pip install --no-cache-dir -r requirements-dev.txt

COPY tests/ tests/
COPY pyproject.toml .

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

EXPOSE 8000
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health')"

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── Runtime stage (default) ──────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/astroblink/AstroBlink" \
      org.opencontainers.image.title="astroblink-api" \
      org.opencontainers.image.description="AstroBlink FastAPI backend"

# Non-root user with fixed UID/GID.
RUN groupadd --gid 10001 astroblink \
    && useradd --uid 10001 --gid 10001 --no-create-home --shell /bin/false astroblink

WORKDIR /app

# Copy venv and application from builder.
COPY --from=builder /opt/venv /opt/venv
COPY --from=builder /build/app ./app
COPY --from=builder /build/alembic ./alembic
COPY --from=builder /build/alembic.ini .

# Ensure the non-root user owns the workdir.
RUN chown -R astroblink:astroblink /app

ENV PATH="/opt/venv/bin:$PATH" \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Health check using only stdlib (no curl in slim image).
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:${PORT:-8000}/health')"

USER 10001

EXPOSE 8000

# Exec-form CMD for clean signal handling.
# PORT env var lets container hosts inject their own port.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
