# AstroBlink Worker

Ingestion worker: fetches SPHEREx data from S3/IRSA, processes FITS files,
renders tiles, and writes subjects to the database.

**Owner:** Role 1 (Astronomy Data Engineer)

## Architecture

- Standalone Python process consuming jobs from Redis (`BRPOP astroblink:ingest_jobs`)
- Writes directly to PostgreSQL (does NOT run migrations — depends on `migrate` service)
- Writes tiles to S3-compatible storage (MinIO in dev)
- SPHEREx S3 access is anonymous (`botocore.UNSIGNED`)
- Health check: background thread writes `/tmp/heartbeat` every loop iteration

See `docs/ARCHITECTURE.md §2.3` for full design.

## Pipeline (stub)

```
Redis job → S3 fetch → FITS parse → WCS-WAVE read → FLAGS mask
         → He airglow mask → wavelength binning → reproject
         → co-add → asinh stretch → tile render → upload to MinIO
         → insert subject in PostgreSQL
```

## Development (standalone)

```bash
cd worker
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env
python -m worker.main
```

## Testing

```bash
python -m pytest tests/ -v
```

## Docker

```bash
docker build -t astroblink-worker .
# Or via compose from repo root
make up-worker
```
