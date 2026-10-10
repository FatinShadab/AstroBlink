# AstroBlink — Deployment Overview

Each app is deployed independently. This directory contains per-target
configuration stubs and notes.

## Targets

| App | Target | Directory |
|-----|--------|-----------|
| `client/` | Vercel | `client-vercel/` |
| `api/` | Container host (Render / Fly.io) | `api-container/` |
| `worker/` | Container host or scheduled job | `worker-container/` |
| Database | Self-hosted PostgreSQL + pgSphere | `database/` |

## Environment Variables per Target

### Client (Vercel)
- `NEXT_PUBLIC_API_BASE_URL` — production API URL (build-time)
- `API_INTERNAL_URL` — server-side API URL (runtime, if using SSR)
- `TILE_BASE_URL` — production tile CDN URL (runtime)

### API (Container host)
- `DATABASE_URL` — production PostgreSQL connection string
- `REDIS_URL` — production Redis connection string
- `TILE_S3_ENDPOINT` — S3 endpoint (e.g., `https://s3.amazonaws.com`)
- `TILE_S3_BUCKET` — tile bucket name
- `TILE_S3_ACCESS_KEY` / `TILE_S3_SECRET_KEY` — S3 credentials
- `TILE_BASE_URL` — browser-facing tile URL
- `SECRET_KEY` — JWT signing key (**must be strong in production**)
- `CORS_ORIGINS` — production client URL
- `PORT` — container host injected

### Worker (Container host)
- `DATABASE_URL` — production PostgreSQL connection string
- `REDIS_URL` — production Redis connection string
- `TILE_S3_ENDPOINT` / `TILE_S3_BUCKET` / `TILE_S3_ACCESS_KEY` / `TILE_S3_SECRET_KEY`
- `SPHEREX_S3_BUCKET` / `SPHEREX_S3_REGION`
- `IRSA_CUTOUT_BASE_URL`
- `FITS_SCRATCH_DIR` — writable path with ~1 GB free

### Database
- See `database/README.md` for pgSphere hosting constraints.
