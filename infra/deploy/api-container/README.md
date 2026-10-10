# API → Container Host (Render / Fly.io)

## Render

1. Create a new **Web Service** from the GitHub repository.
2. Set **Root Directory** to `api`.
3. Set **Dockerfile Path** to `./Dockerfile`.
4. Set **Docker Build Context** to `./` (api/ folder).
5. Add environment variables (see `infra/deploy/README.md`).
6. Set health check path: `/health`.

## Fly.io

```bash
cd api
fly launch --dockerfile Dockerfile --internal-port 8000
fly secrets set DATABASE_URL="..." REDIS_URL="..." SECRET_KEY="..."
```

## Required Environment Variables

See `api/.env.example` for the full list. Critical production variables:
- `DATABASE_URL` — must point to PostgreSQL with pgSphere extension
- `REDIS_URL` — managed Redis (e.g., Upstash, Redis Cloud)
- `SECRET_KEY` — **generate a strong random key** (`openssl rand -hex 32`)
- `CORS_ORIGINS` — production client URL only
- `PORT` — usually injected by the container host

## Health Check

The API exposes `GET /health` which checks PostgreSQL and Redis connectivity.
Configure the container host to use this as the readiness probe.
