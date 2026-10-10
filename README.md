# 🔭 AstroBlink

**A citizen-science blink comparator for NASA's SPHEREx mission — spot the next Pluto.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026-orange)

> **Event:** NASA Space Apps Challenge 2026 · **Track:** "Planet X and SPHEREx"

---

## Repository Map

This is a monorepo with three independently deployable applications:

```
AstroBlink/
├── api/               FastAPI backend: REST endpoints, DB, consensus    (Role 2)
├── worker/            Ingestion worker: S3, Astropy, binning, tiles     (Role 1)
├── client/            Next.js frontend: blink comparator, annotation    (Roles 3, 4)
├── contracts/         Shared API contract (OpenAPI 3.1, language-neutral)
├── infra/             Docker Compose, deploy configs, scripts           (Role 5)
├── docs/              Project documentation (PRD, Architecture, Roadmap)
└── .github/           CI workflows, CODEOWNERS
```

**No cross-folder imports.** The apps communicate only through:
- HTTP (defined in `contracts/openapi.yaml`)
- PostgreSQL (schema owned by `api/`, migrations via Alembic)
- Redis (job queue, caching)
- S3-compatible object storage (MinIO in dev, S3 in prod)

Each folder can be copied out and built standalone: `docker build ./api`, `docker build ./worker`, `docker build ./client`.

---

## Team Roles

| # | Role | Owns |
|---|------|------|
| 1 | Astronomy Data Engineer | `worker/` |
| 2 | Backend & Consensus Dev | `api/` |
| 3 | Frontend Canvas Dev | `client/` |
| 4 | UI/UX & Gamification Lead | `client/` |
| 5 | DevOps & Cloud Engineer | `infra/`, `.github/` |
| 6 | Full-Stack Integrator & Team Lead | `contracts/`, `docs/` |

---

## Run Locally with Docker

### Prerequisites

- Docker 24+ with Docker Compose v2
- `make` (optional, for convenience targets)
- Ports 3000, 8000, 5432, 6379, 9000, 9001 available

### Quick start

```bash
# 1. Clone and configure
git clone https://github.com/<your-org>/AstroBlink.git
cd AstroBlink
cp .env.example .env        # review and adjust if needed

# 2. Start the dev stack (postgres, redis, minio, api, client)
make up
# Or without make:
# docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . up --build -d

# 3. Optionally start the ingestion worker
make up-worker

# 4. Verify everything is healthy
make health
```

### What starts

| Service | URL | Purpose |
|---------|-----|---------|
| **API** | http://localhost:8000 | FastAPI backend |
| **Client** | http://localhost:3000 | Next.js frontend |
| **MinIO** | http://localhost:9000 | S3-compatible tile storage |
| **MinIO Console** | http://localhost:9001 | MinIO admin UI |
| **PostgreSQL** | localhost:5432 | Database (not exposed beyond localhost) |
| **Redis** | localhost:6379 | Cache & job queue (not exposed beyond localhost) |

### Key environment variables

| Variable | Where used | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_API_BASE_URL` | Client (build-time) | Browser-facing API URL. Changing requires rebuild. |
| `API_INTERNAL_URL` | Client (runtime) | Container-network API URL for SSR calls. |
| `TILE_BASE_URL` | Client (runtime) | Browser-facing tile image base URL (MinIO). |
| `DATABASE_URL` | API, Worker | PostgreSQL connection string (container hostname). |
| `REDIS_URL` | API, Worker | Redis connection string. |
| `TILE_S3_ENDPOINT` | API, Worker | S3-compatible endpoint for tile read/write. |
| `CORS_ORIGINS` | API | Allowed CORS origins (client URL). |
| `SECRET_KEY` | API | JWT signing key. **Change in production.** |

See `.env.example` for all variables with descriptions.

### Makefile targets

```
make up              Start dev stack (no worker)
make up-worker       Start dev stack + ingestion worker
make down            Stop everything
make logs            Tail all logs
make migrate         Run Alembic migrations
make test            Run all tests (api, worker, client)
make lint            Run all linters
make health          Curl every health endpoint
make build-standalone  Prove each app builds from its own folder
make clean           Remove containers, volumes, images
```

---

## Deploy Each App Separately

Each application is designed to be deployed independently:

| App | Recommended target | Config location |
|-----|--------------------|-----------------|
| `client/` | Vercel | `infra/deploy/client-vercel/` |
| `api/` | Container host (Render, Fly.io) | `infra/deploy/api-container/` |
| `worker/` | Container host or scheduled job | `infra/deploy/worker-container/` |
| Database | Self-hosted PostgreSQL + pgSphere | `infra/deploy/database/` |

> **Note:** No major managed PostgreSQL provider (RDS, Cloud SQL, Azure, Supabase) supports the pgSphere extension. Production deployment requires a self-managed PostgreSQL instance. See `infra/deploy/database/README.md`.

---

## Project Documentation

| Document | Description |
|----------|-------------|
| [PRD](docs/PRD.md) | Product requirements, personas, functional/non-functional requirements |
| [Architecture](docs/ARCHITECTURE.md) | Component design, DDL, API contracts, consensus pseudocode |
| [Roadmap](docs/ROADMAP.md) | Three-phase plan, task tables, risk register |
| [SPHEREx Overview](docs/spherex_mission_overview.md) | Mission specs, instrument details |
| [IRSA Data Access](docs/irsa_dataset_and_access.md) | Data products, S3 access, FITS structure |
| [Challenge Brief](docs/nasa_challenge_and_zooniverse.md) | NASA Space Apps challenge statement |

---

## Data Attribution

This project uses data from **NASA/IPAC Infrared Science Archive (IRSA)** and **NASA's SPHEREx mission** (PI: Dr. Jamie Bock, Caltech). SPHEREx data is hosted via the **AWS Open Data Program** in S3 bucket `nasa-irsa-spherex`.

> If you use SPHEREx data in publications, please cite per the [IRSA acknowledgement guidelines](https://irsa.ipac.caltech.edu/data/SPHEREx/).

## License

MIT — see [LICENSE](LICENSE).