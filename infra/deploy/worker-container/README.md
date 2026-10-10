# Worker → Container Host or Scheduled Job

## Deployment Options

### Option A: Long-running container (recommended for MVP)
Deploy the worker as a background service that continuously polls Redis.
Use the same container host as the API (Render Background Worker, Fly.io Machine).

### Option B: Scheduled job
Run the worker on a cron schedule (e.g., every 15 minutes).
The worker will process all queued jobs and exit.
Requires modifying `worker/worker/main.py` to exit when the queue is empty.

## Required Environment Variables

See `worker/.env.example`. Critical production variables:
- `DATABASE_URL` — same PostgreSQL instance as the API (with pgSphere)
- `REDIS_URL` — same Redis instance as the API
- `TILE_S3_ENDPOINT` / `TILE_S3_BUCKET` / `TILE_S3_ACCESS_KEY` / `TILE_S3_SECRET_KEY`
- `FITS_SCRATCH_DIR` — writable path with ~1 GB free space

## Health Check

The worker writes a heartbeat file to `/tmp/heartbeat`.
Container hosts that support file-based health checks can monitor this.
For hosts that require HTTP health checks, consider adding a minimal
HTTP endpoint as a stretch goal.

## Notes

- The worker does **NOT** run database migrations. Ensure `alembic upgrade head`
  runs before starting the worker (handled by the `migrate` service in compose).
- The worker needs network access to `nasa-irsa-spherex` S3 bucket (anonymous)
  and optionally to the IRSA Cutout Service.
