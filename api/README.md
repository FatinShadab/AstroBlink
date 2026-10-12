# AstroBlink API

FastAPI backend providing REST endpoints for the AstroBlink citizen-science platform.

**Owner:** Role 2 (Backend & Consensus Dev)

## Endpoints

| Method | Path | Purpose |
|--------|------|--------|
| GET | `/health` | Infrastructure health check |
| POST | `/api/v1/cutouts/fetch` | Enqueue ingestion job |
| GET | `/api/v1/subjects/next` | Serve next subject to classifier |
| POST | `/api/v1/classify` | Submit classification with marks |
| POST | `/api/v1/consensus/run` | Run consensus pipeline |
| GET | `/api/v1/candidates` | List candidates |
| GET | `/api/v1/candidates/export` | Export as CSV/VOTable |
| PATCH | `/api/v1/candidates/{id}` | Update candidate status |

See `contracts/openapi.yaml` for full API contract.

### Consensus & Candidate Notes
- **Category:** The `category` on a new consensus candidate reflects volunteer majority vote / suggestions.
- **Status:** Candidates are initialized with status `new`, indicating they are unreviewed until reviewed by an astronomer via `PATCH /api/v1/candidates/{id}`.
- **Contributing Classifiers (`n_classifications`):** Tracks the number of distinct volunteers/users who placed marks contributing to the candidate tracklet.


## Development (standalone)

```bash
cd api
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt -r requirements-dev.txt
cp .env.example .env

# Run migrations (requires PostgreSQL + pgSphere)
alembic upgrade head

# Start dev server
uvicorn app.main:app --reload --port 8000
```

## Testing

```bash
python -m pytest tests/ -v
```

## Docker

```bash
# Standalone build
docker build -t astroblink-api .

# Or via compose from repo root
make up
```

## Database

This app owns the PostgreSQL schema. Migrations are managed with Alembic.
The DDL is defined in `docs/ARCHITECTURE.md §3`.

**The worker does NOT run migrations** — it depends on the `migrate` service.
