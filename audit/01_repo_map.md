# AstroBlink — Repository Map & Architecture Boundaries

**Purpose:** Comprehensive inventory of all folders and key files, role ownership mappings per CODEOWNERS, Docker build contexts, and strict inter-service communication interfaces.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Top-Level Directory Inventory & Ownership

AstroBlink is organized as a flat monorepo where each functional application folder is fully isolated [VERIFIED].

| Directory / File | Owner per CODEOWNERS | Role Title | Purpose & Scope | Docker Build Context |
| :--- | :---: | :--- | :--- | :--- |
| `api/` | Role 2 | Backend & Consensus Dev | FastAPI application, consensus engine, candidate export, Alembic migrations, database models and schemas. | `./api` [VERIFIED: `api/Dockerfile`] |
| `worker/` | Role 1 | Astronomy Data Engineer | Background ingestion worker: S3 ranged reads, FITS parsing, spectral binning, reprojection co-addition, tile rendering, DB insertion. | `./worker` [VERIFIED: `worker/Dockerfile`] |
| `client/` | Roles 3 & 4 | Frontend Canvas Dev & UI/UX Lead | Next.js 14 frontend: web blink comparator, canvas annotation, band switcher, volunteer tutorial, discovery feed. | `./client` [VERIFIED: `client/Dockerfile`] |
| `contracts/` | Role 6 | Full-Stack Integrator & Team Lead | OpenAPI 3.1 specification (`openapi.yaml`) and JSON Schema / YAML definitions. Shared source of truth; no runnable code. | N/A (Specification only) |
| `infra/` | Role 5 | DevOps & Cloud Engineer | Docker Compose configurations, PostgreSQL + pgSphere Dockerfile, initialization scripts, deployment stubs. | `./infra/postgres` |
| `docs/` | Role 6 | Full-Stack Integrator & Team Lead | System documentation: PRD, Architecture, Roadmap, Verified Astronomical Facts, domain research. | N/A (Documentation) |
| `.github/` | Role 5 | DevOps & Cloud Engineer | CI/CD GitHub Actions workflows (`ci-api.yml`, `ci-worker.yml`, `ci-client.yml`) and `CODEOWNERS`. | N/A (CI/CD) |
| `audit/` | Senior Auditor | Senior Engineering Auditor | Full project audit, handoff documentation, operational runbooks, and issue registers. | N/A (Audit) |
| `Makefile` | Role 5 | DevOps & Cloud Engineer | Development lifecycle command runner (`make up`, `make test`, etc. Note: Linux/macOS only; Windows PowerShell requires plain `docker compose`). | N/A |
| `.env.example` | Role 5 | DevOps & Cloud Engineer | Reference template for development environment variables. | N/A |

---

## 2. Inter-Component Communication Boundaries

### The Zero-Shared-Code Rule [VERIFIED]
There is **strictly zero shared Python or TypeScript code** across application folders (`api/`, `worker/`, `client/`).
- `api/` cannot import from `worker/` or `client/`.
- `worker/` cannot import from `api/` or `client/`.
- `client/` cannot import from `api/` or `worker/`.
- Each service builds in Docker with **only its own directory as build context** (e.g., `api/Dockerfile` has `context: ./api`) [VERIFIED: `infra/docker-compose.yml`].

### Inter-Service Communication Matrix [VERIFIED]

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                 COMMUNICATION MATRIX                                   │
├─────────────────┬─────────────────┬───────────────────┬────────────────────────────────┤
│ Source          │ Destination     │ Channel / Protocol│ Payload / Operation            │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Client          │ API             │ HTTP REST (JSON)  │ GET /api/v1/subjects/next      │
│                 │                 │                   │ POST /api/v1/classify          │
│                 │                 │                   │ GET /api/v1/candidates         │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Client          │ MinIO / S3      │ HTTP GET (WebP)   │ Direct tile image downloads    │
│                 │                 │                   │ via URLs in subject.tile_urls  │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ API             │ Redis           │ Redis LPUSH / CMD │ Enqueue ingestion job to queue │
│                 │                 │                   │ 'astroblink:ingest_jobs'       │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Worker          │ Redis           │ Redis BRPOP / SET │ Dequeue jobs; write heartbeat  │
│                 │                 │                   │ to 'astroblink:worker:heartbeat│
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Worker          │ PostgreSQL      │ TCP / psycopg     │ Insert subject rows into table │
│                 │                 │ (pgSphere syntax) │ 'subjects' (1-arcsec dedup)    │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Worker          │ MinIO / S3      │ S3 API (boto3)    │ PutObject: rendered .webp tiles│
│                 │                 │                   │ and .wcs.json sidecar files    │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ API             │ PostgreSQL      │ TCP / asyncpg     │ Read/write subjects, marks,    │
│                 │                 │ (SQLAlchemy async)│ classifications, candidates    │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Worker          │ NASA S3         │ HTTPS Ranged GET  │ Anonymous byte-range reads     │
│                 │ (External)      │ (boto3 UNSIGNED)  │ from s3://nasa-irsa-spherex    │
├─────────────────┼─────────────────┼───────────────────┼────────────────────────────────┤
│ Worker          │ IRSA TAP        │ HTTPS POST/GET    │ TAP spatial query to           │
│                 │ (External)      │                   │ https://irsa.ipac.caltech.edu  │
└─────────────────┴─────────────────┴───────────────────┴────────────────────────────────┘
```

---

## 3. Detailed File-by-File Inventory

### 3.1 `api/` (Backend Service — Owned by Role 2)
- **`api/app/main.py`** [VERIFIED]: FastAPI application entrypoint. Configures CORS, lifecycle events, and registers routers (`health`, `subjects`, `classify`, `cutouts`, `consensus`, `candidates`).
- **`api/app/config.py`** [VERIFIED]: Pydantic `BaseSettings` loading `.env`. Controls ports, database/Redis/S3 URLs, algorithm knobs (`consensus_eps_pixels=1.5`, `retirement_threshold=10`), and `admin_token`.
- **`api/app/db.py`** [VERIFIED]: Async SQLAlchemy engine (`asyncpg`) and session dependency `get_db`.
- **`api/app/auth.py`** [VERIFIED]: Security dependency `require_admin_token` implementing constant-time comparison `secrets.compare_digest`.
- **`api/app/models/tables.py`** [VERIFIED]: SQLAlchemy declarative ORM models: `User`, `Subject`, `Classification`, `Mark`, `Candidate`, `CandidateEpoch`, `Badge`, `UserBadge`, `CandidateReview`. Uses pgSphere `spoint` column type for `subjects.coord`.
- **`api/app/routers/`** [VERIFIED]:
  - `health.py`: Liveness probe (`GET /health`) checking database, Redis, and worker heartbeat timestamp.
  - `subjects.py`: `GET /api/v1/subjects/next` serving next unretired subject (note: currently returns hardcoded empty dict for `wcs_urls`).
  - `classify.py`: `POST /api/v1/classify` validating volunteer marks, storing records, incrementing subject classification count, and triggering retirement at threshold.
  - `cutouts.py`: `POST /api/v1/cutouts/fetch` accepting `(ra, dec, size_deg)` and pushing job to Redis list `astroblink:ingest_jobs`.
  - `consensus.py`: `POST /api/v1/consensus/run` protected admin endpoint executing spatial DBSCAN and candidate creation.
  - `candidates.py`: `GET /api/v1/candidates` (list with filters) and `GET /api/v1/candidates/export` (CSV and IVOA VOTable 1.4).
- **`api/app/services/`** [VERIFIED]:
  - `consensus.py`: Pure mathematical consensus clustering: Haversine distance, pixel-scale metric $\varepsilon = 1.5\text{ px} \times 6.15"$, DBSCAN, volunteer reliability weighting, gold-standard mark scoring.
  - `export.py`: Multi-format serializer for astronomical catalogs (CSV and IVOA-compliant VOTable 1.4 XML).
- **`api/alembic/`** [VERIFIED]: Database schema migration environment.
  - `alembic/versions/001_initial_schema.py`: Initial migration creating pgSphere extension and all tables with spatial indices.
- **`api/tests/`** [VERIFIED]:
  - `test_health.py`: Health endpoint status and degraded worker heartbeat reporting.
  - `test_consensus_core.py`: Pure unit tests for DBSCAN clustering, reliability weighting, and edge cases.
  - `test_reliability.py`: User reliability score recalculation logic.
  - `test_export.py`: CSV and VOTable 1.4 format validation.
  - `test_auth.py`: Admin token authentication and constant-time comparison tests.
  - `test_contract_validation.py`: Pydantic model contract validation against `contracts/openapi.yaml`.

---

### 3.2 `worker/` (Ingestion Worker — Owned by Role 1)
- **`worker/worker/main.py`** [VERIFIED]: Worker process lifecycle manager. Initializes Redis and DB connections, spawns consumer loop, manages `/tmp/heartbeat` file.
- **`worker/worker/config.py`** [VERIFIED]: Ingestion configuration: S3 bucket names, timeouts, scratch budgets (`scratch_budget_mb=2048`), retry counts, detector tolerances, and `FLAGS` masking parameters.
- **`worker/worker/db.py`** [VERIFIED]: PostgreSQL connection and pgSphere subject insertion with 1-arcsec coordinate deduplication:
  `WHERE spoint(radians(s.ra_deg), radians(s.dec_deg)) <-> spoint(radians(:ra), radians(:dec)) < radians(1.0 / 3600.0)`.
- **`worker/worker/queue/consumer.py`** [VERIFIED]: Redis queue consumer reading `astroblink:ingest_jobs` via `BRPOP`, executing pipeline, and updating worker heartbeat key.
- **`worker/worker/sources/`** [VERIFIED]:
  - `irsa.py`: Spatial discovery client querying IRSA TAP service (`https://irsa.ipac.caltech.edu/TAP/sync`) to discover matching Level 2 files for a given coordinate.
  - `s3.py`: Direct S3 ranged read client. Fetches specific byte ranges from `s3://nasa-irsa-spherex` (`us-east-1`, anonymous mode), eliminating full 68 MiB file downloads.
- **`worker/worker/processing/`** [VERIFIED]:
  - `fits_parser.py`: Multi-Extension FITS parser using Astropy. Implements iterative 2880-byte header reading until the `END` card is found, preserving full SIP polynomial terms.
  - `binning.py`: Wavelength extraction engine. Selects narrow slices ($1.0\text{ }\mu\text{m}$, $2.0\text{ }\mu\text{m}$, $4.0\text{ }\mu\text{m}$) using detector-specific tolerance rules $\text{tol} = k \cdot \lambda / R$, and performs epoch binning.
  - `masking.py`: Applies Level 2 defect masks (FLAGS bits 0–2, 4–7, 9–11, 14–15, 17, 19), He airglow exclusion ($1.075\text{--}1.091\text{ }\mu\text{m}$), and computes the per-pixel shared-wavelength intersection mask.
  - `reproject.py`: Tangent-plane (TAN) WCS reprojection and inverse-variance weighted co-addition using `reproject_interp`.
- **`worker/worker/render/`** [VERIFIED]:
  - `tiles.py`: Image renderer. Scales co-added flux via `asinh` stretch, applies visual hatching to masked pixels, outputs WebP tiles (< 250 KB), and uploads to MinIO/S3.
  - `wcs_sidecar.py`: Extracts affine WCS metadata (`CRPIX`, `CRVAL`, `CD` matrix) and exports JSON sidecars (`.wcs.json`).
- **`worker/scripts/`** [VERIFIED]: Verification and benchmarking scripts (`compute_w11b_final_items.py`, `run_w12_e2e_verify.py`, `run_w13_verify.py`).
- **`worker/tests/`** [VERIFIED]: Comprehensive unit tests covering parsing, masking, binning, reprojection, rendering, and database operations.

---

### 3.3 `client/` (Frontend Application — Owned by Roles 3 & 4)
- **`client/src/app/page.tsx`** [VERIFIED]: Landing page hero layout with CTA buttons to `/classify` and `/tutorial`.
- **`client/src/app/classify/page.tsx`** [VERIFIED]: Main classification route. Implements auto-blink timer, subject fetching, mark placement, and classification submission. *(Note: Contains known issues: hardcoded 128px pixel-to-sky conversion and old band names)*.
- **`client/src/components/BlinkCanvas.tsx`** [VERIFIED]: Canvas component rendering subject tiles and drawing volunteer mark circles.
- **`client/src/components/BandSelector.tsx`** [VERIFIED]: Band switching buttons. Currently hardcodes `"swir" | "mwir" | "rgb"` instead of narrow slices.
- **`client/src/components/AnnotationLayer.tsx`** [VERIFIED]: SVG overlay component for displaying placed marks.
- **`client/src/components/ConsensusBadge.tsx`** [VERIFIED]: Visual badge rendering for volunteer achievements.
- **`client/src/lib/api/`** [VERIFIED]: Fetch client wrapper calling FastAPI endpoints.
- **`client/__tests__/BlinkCanvas.test.tsx`** [VERIFIED]: Vitest test verifying Canvas rendering logic.

---

### 3.4 `contracts/` (API Specification — Owned by Role 6)
- **`contracts/openapi.yaml`** [VERIFIED]: OpenAPI 3.1 contract defining all public and administrative HTTP endpoints.
- **`contracts/schemas/`** [VERIFIED]: Modular YAML schemas:
  - `subject.yaml`: Schema for subject objects, tile URLs, and WCS sidecars.
  - `classification.yaml`: Schema for volunteer classification submissions.
  - `candidate.yaml`: Schema for aggregated consensus candidates.
  - `consensus.yaml`: Schema for consensus trigger payloads.
  - `cutout.yaml`: Schema for ingest job requests.
  - `ingest_job.yaml`: Schema for Redis queue job payloads.
  - `error.yaml`: Standard HTTP error response structure.

---

### 3.5 `infra/` (Infrastructure & Deployment — Owned by Role 5)
- **`infra/docker-compose.yml`** [VERIFIED]: Core multi-container definition: `postgres`, `redis`, `minio`, `minio-init`, `migrate`, `api`, `client`, and `worker` (under `--profile worker`).
- **`infra/docker-compose.override.yml`** [VERIFIED]: Development overrides mounting local source directories into containers.
- **`infra/docker-compose.prod.yml`** [VERIFIED]: Production deployment overrides.
- **`infra/postgres/Dockerfile`** [VERIFIED]: PostgreSQL 16 Alpine container building and compiling the `pgSphere` geospatial C extension from source.
- **`infra/scripts/seed_dev.py`** [VERIFIED]: Seed script inserting development subjects, test classifications, and test users.
- **`infra/scripts/wait-for-it.sh`** [VERIFIED]: Shell utility for TCP port readiness synchronization in containerized environments.
- **`infra/deploy/`** [VERIFIED]: Deployment manifests and documentation stubs for Vercel (`client-vercel`) and container hosts (`api-container`, `worker-container`, `database`).

---

### 3.6 `.github/` (CI/CD Workflows — Owned by Role 5)
- **`ci-api.yml`** [VERIFIED]: Linting (Ruff), type checking (mypy), and pytest test execution for the FastAPI backend.
- **`ci-worker.yml`** [VERIFIED]: Linting (Ruff) and pytest execution for the worker pipeline.
- **`ci-client.yml`** [VERIFIED]: ESLint, TypeScript type checking, and Vitest execution for the Next.js client.
- **`CODEOWNERS`** [VERIFIED]: Directory ownership assignment table.
