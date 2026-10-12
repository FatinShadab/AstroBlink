# AstroBlink Worker

Ingestion worker: discovers SPHEREx Level 2 exposures via IRSA TAP, performs wavelength-matched multi-epoch exposure selection, fetches spatial row-strip cutouts from `s3://nasa-irsa-spherex` via parallel HTTP `Range` requests, applies per-pixel `FLAGS` and shared-wavelength masking, reprojects onto a common `6.15"/px` TAN WCS grid, renders narrow-slice and false-color RGB WebP tiles with WCS/provenance JSON sidecars to S3-compatible storage (MinIO in dev), and inserts blinkable subjects into PostgreSQL.

**Owner:** Role 1 (Astronomy Data Engineer)

## Architecture

- Standalone Python process consuming jobs from Redis (`BRPOP astroblink:ingest_jobs` with `5s` timeout)
- Writes directly to PostgreSQL (does NOT run migrations — depends on `migrate` service)
- Writes WebP tiles (`{epoch}_{wavelength}um.webp`, `{epoch}_rgb.webp`) and sidecar metadata (`{tile_key}.wcs.json`) to S3-compatible storage (`astroblink-tiles` bucket in MinIO/S3)
- SPHEREx Level 2 archive access is anonymous (`botocore.UNSIGNED`) against `s3://nasa-irsa-spherex` (`us-east-1`)
- Health check: background daemon thread writes a Unix timestamp to `/tmp/heartbeat` every `2s`

See `docs/ARCHITECTURE.md §2.3` and `docs/VERIFIED_FACTS.md` for full design and verified empirical metrics.

## Pipeline (W12 Wavelength-Matched Inter-Epoch Blink)

```text
Redis job (BRPOP astroblink:ingest_jobs)
  → Runtime guards (500 MiB scratch budget + per-job timeout cap)
  → pgSphere 1″ idempotency & deduplication check (find_existing_subject_nearby)
  → IRSA TAP spatial query + data-driven epoch clustering (Epochs 1 & 2 default)
  → Wavelength-matched exposure selection at 1.0 µm (D1), 2.0 µm (D3), 4.0 µm (D5)
      (deterministic tie-break within 0.002 µm: larger shared overlap → earlier MJD)
  → Minimum 2-epoch guard (jobs with <2 matched epochs insert NO subject and return reason)
  → Parallel S3 HTTP Range row-strip cutouts (IMAGE, FLAGS, VARIANCE, WCS-WAVE)
  → FLAGS bitmask filtering (Bits 0 & 19 masked by default via config flag)
  → Reprojection onto common native 6.15"/px TAN WCS grid (293×293 px at size_deg=0.5)
  → Per-pixel shared-wavelength intersection mask across epochs
  → Asinh stretch + bad-pixel hatching WebP render (< 250 KB/subject)
      Tile keys: "{epoch}_1.0um", "{epoch}_2.0um", "{epoch}_4.0um", and "{epoch}_rgb"
      ("{epoch}_rgb" is rendered ONLY if all three narrow slices exist in that epoch)
  → Upload WebP tiles + per-tile ".wcs.json" sidecars to MinIO/S3
  → Insert subject row into PostgreSQL & mark ingest_jobs row "completed"
```

## Configuration Variables

All settings in `worker/config.py` (`pydantic-settings`) can be configured via environment variables or `.env`:

| Environment Variable | Default | Description |
| :--- | :--- | :--- |
| `DATABASE_URL` | `postgresql://astroblink:astroblink_dev@localhost:5432/astroblink` | PostgreSQL connection URL (direct DB access) |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL |
| `REDIS_QUEUE_KEY` | `astroblink:ingest_jobs` | Redis list key consumed via `BRPOP` |
| `BRPOP_TIMEOUT` | `5` | `BRPOP` blocking timeout in seconds ($\le 5$) |
| `HEARTBEAT_PATH` | `/tmp/heartbeat` | Liveness timestamp file checked by Docker `HEALTHCHECK` |
| `TILE_S3_ENDPOINT` | `http://localhost:9000` | MinIO / S3 endpoint for storing output tiles and sidecars |
| `TILE_S3_BUCKET` | `astroblink-tiles` | Target bucket for rendered WebP tiles and `.wcs.json` sidecars |
| `TILE_S3_ACCESS_KEY` | `minioadmin` | S3 access key for tile storage |
| `TILE_S3_SECRET_KEY` | `minioadmin` | S3 secret key for tile storage |
| `SPHEREX_S3_BUCKET` | `nasa-irsa-spherex` | Public AWS S3 bucket hosting SPHEREx Level 2 MEF files |
| `SPHEREX_S3_REGION` | `us-east-1` | AWS region for `nasa-irsa-spherex` |
| `SPHEREX_LEVEL2_PREFIX` | `qr2/level2/` | S3 prefix for SPHEREx Quick Release 2 Level 2 FITS |
| `IRSA_CUTOUT_BASE_URL` | `https://irsa.ipac.caltech.edu/ibe/data/spherex` | IRSA IBE cutout base URL |
| `DEFAULT_SIZE_DEG` | `0.5` | Default angular cutout size in degrees (`293×293 px` at `6.15"/px`) |
| `TARGET_WAVELENGTHS_UM` | `[1.0, 2.0, 4.0]` | Narrow-slice target wavelengths in microns (`D1`, `D3`, `D5`) |
| `WAVELENGTH_TOL_K` | `1.0` | Tolerance multiplier $k$ in $\text{tol}(\lambda) = k \cdot (\lambda / R)$ |
| `INCLUDE_EPOCH_3` | `false` | Restrict inter-epoch blinking to Epochs 1 and 2 by default |
| `SURVEY_EPOCH_GAP_DAYS` | `30.0` | Time gap threshold (days) separating 6-month survey passes |
| `CVZ_EPOCH_SPAN_DAYS` | `182.5` | Half-year epoch clustering span (days) for CVZ fields |
| `MAX_CANDIDATES_PER_DET_EPOCH` | `30` | Max evenly-spaced exposures inspected per `(detector, epoch)` |
| `MIN_CUTOUT_COVERAGE` | `0.95` | Minimum valid spatial coverage fraction on core target footprint |
| `TIE_BREAK_TOL_UM` | `0.002` | Tie-break error window ($\mu\text{m}$); orders by larger overlap, then earlier MJD |
| `MARGINAL_ERR_FRACTION` | `0.60` | Error threshold fraction of tolerance above which a match is marked `"marginal"` |
| `MARGINAL_MIN_OVERLAP_UM` | `0.01` | Minimum shared overlap ($\mu\text{m}$) below which a match is marked `"marginal"` |
| `MASK_TRANSIENT_AND_OUTLIER_FLAGS` | `true` | Mask `FLAGS` Bit 0 (`MP_TRANSIENT`) and Bit 19 (`MP_OUTLIER`) by default |
| `S3_CONNECT_TIMEOUT` | `10` | S3 HTTP connect timeout in seconds |
| `S3_READ_TIMEOUT` | `30` | S3 HTTP read timeout in seconds |
| `S3_MAX_RETRIES` | `4` | Max retry attempts with exponential backoff for S3 ranged reads |
| `S3_PARALLEL_THREADS` | `6` | Parallel threads per exposure for S3 HTTP `Range` row-strip reads |
| `TAP_TIMEOUT_SEC` | `30.0` | IRSA TAP HTTP request timeout in seconds |
| `TAP_MAX_RETRIES` | `3` | Max retry attempts with backoff for IRSA TAP queries |
| `FITS_SCRATCH_DIR` | `/tmp/astroblink` | Scratch directory for any temporary FITS files |
| `MAX_SCRATCH_BYTES` | `524288000` | Total scratch directory budget (`500 MiB`) |
| `JOB_TIMEOUT_SEC` | `600.0` | Per-job execution time cap in seconds |

## Running the Worker

### 1. Docker Compose (`ab-worker` stack)

From the repository root:

```bash
# Start Postgres, Redis, MinIO, run migrations, and launch the worker daemon
docker compose -p ab-worker -f infra/docker-compose.yml --project-directory . --profile worker up -d --build

# Check worker container health and logs
docker ps --filter "name=ab-worker"
docker logs -f ab-worker-worker-1
```

### 2. Enqueuing an End-to-End Verification Job

```bash
docker compose -p ab-worker -f infra/docker-compose.yml run --rm --no-deps --user root \
  -e PYTHONPATH=/build \
  -v $(pwd)/worker:/build \
  worker python -u /build/scripts/run_w12_e2e_verify.py
```

### 3. Standalone Local Development

```bash
cd worker
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp ../.env.example .env
python -m worker.main
```

## Testing

```bash
# Run unit test suite inside the dev container (with contracts mounted)
docker run --rm -e PYTHONPATH=/build \
  -v $(pwd)/worker:/build \
  -v $(pwd)/contracts:/contracts:ro \
  ab-worker:dev pytest -v -m "not live and not real_data"
```
