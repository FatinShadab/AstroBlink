# AstroBlink — How to Run (Tested Operational Runbook)

**Purpose:** Exact, tested Windows PowerShell instructions for setting up, building, running, seeding, ingesting, calling endpoints, testing inside containers, and cleaning up AstroBlink multi-container environments.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. System Prerequisites

Before running AstroBlink on Windows, ensure the following are configured [VERIFIED]:

1. **Docker Desktop & WSL2:**
   - Docker Desktop with WSL2 backend enabled.
   - Memory Limit: At least 8 GB allocated to WSL2. If Docker crashes or exits with code `137` (OOMKilled), configure `C:\Users\<Username>\.wslconfig`:
     ```ini
     [wsl2]
     memory=8GB
     processors=4
     swap=4GB
     ```
     Apply changes via PowerShell: `wsl --shutdown`.
2. **Git:** Git for Windows with long paths enabled: `git config --system core.longpaths true`.
3. **PowerShell:** Windows PowerShell 5.1 or PowerShell Core 7+.
   > [!IMPORTANT]
   > `make` is **not installed** by default on Windows. All operations must use plain `docker compose` commands with `-f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p <project>`.

---

## 2. Port Allocation & Parallel Stacks Reference

To allow parallel feature development without port collisions, each stack uses a designated project name and non-overlapping port offsets [VERIFIED]:

| Stack / Worktree | Compose Project (`-p`) | Postgres | Redis | API | Client | MinIO S3 | MinIO Console | Working Directory |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **Main Repository** | `astroblink` | `5432` | `6379` | `8000` | `3000` | `9000` | `9001` | `D:\GITHUB\ME\AstroBlink` |
| **Worker Worktree** | `ab-worker` | `5433` | `6380` | `8001` | `3001` | `9100` | `9101` | `D:\GITHUB\ME\astroblink-worker` |
| **API Worktree** | `ab-api` | `5434` | `6381` | `8002` | `3002` | `9200` | `9201` | `D:\GITHUB\ME\astroblink-api` |
| **Audit Throwaway**| `ab-audit` | `5440` | `6390` | `8010` | `3010` | `9300` | `9301` | Any directory (test stack) |

### How to Add Another Safe Worktree Stack [VERIFIED]
1. Choose an unused project name (e.g. `ab-client`) and port offsets (e.g. Postgres `5435`, Redis `6382`, API `8003`, Client `3003`, MinIO `9400/9401`).
2. Verify ports are free:
   ```powershell
   Get-NetTCPConnection -LocalPort 5435, 6382, 8003, 3003, 9400, 9401 -ErrorAction SilentlyContinue
   ```
3. Copy `.env.example` to `.env` in the new worktree and set the chosen ports, `COMPOSE_PROJECT_NAME`, and matching `TILE_BASE_URL=http://localhost:9400/astroblink-tiles` and `NEXT_PUBLIC_API_BASE_URL=http://localhost:8003`.

---

## 3. First-Time Setup & Starting the Stack

All commands must be run from the root of the repository (`D:\GITHUB\ME\AstroBlink`) [VERIFIED].

### Step 3.1: Configure Environment Variables
Copy the template and verify encoding [VERIFIED]:
```powershell
Copy-Item .env.example .env
```
Ensure `COMPOSE_PROJECT_NAME=astroblink` and dev passwords/tokens are intact.

### Step 3.2: Build and Start Core Services
Start the database, queue, object store, API, and client [VERIFIED]:
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink up -d
```
> [!NOTE]
> Including `-f infra/docker-compose.override.yml` is mandatory on Windows to mount local source directories and bind dev scripts at `/build/scripts`.
> The `migrate` container automatically runs `alembic upgrade head` and creates the `pg_sphere` extension before the API service starts.

### Step 3.3: Start the Ingestion Worker
The worker is defined under the `worker` Docker Compose profile to conserve memory. Start it with [VERIFIED]:
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink --profile worker up -d worker
```

### Step 3.4: Verify Running Services
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink --profile worker ps
```
All services (`postgres`, `redis`, `minio`, `api`, `client`, `worker`) should report status `Up (healthy)`.

---

## 4. Database Migrations & Seeding Dev Data

### Manual Migration Check (Idempotent) [VERIFIED]
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink run --rm migrate
```

### Seed Development Subjects and Demo User [VERIFIED]
Seed the database and MinIO tile store with 2 test subjects (12 multi-band tiles) and demo user:
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec api python /build/scripts/seed_dev.py
```
Expected output:
```text
Seeded subject 11111111-1111-1111-1111-111111111111 with 6 tiles in s3://astroblink-tiles/...
Seeded subject 22222222-2222-2222-2222-222222222222 with 6 tiles in s3://astroblink-tiles/...
Seed complete.
```

---

## 5. Ingesting Real SPHEREx Data via Redis

Because Windows PowerShell strips double quotes from nested CLI strings, enqueue the JSON payload using a python one-liner inside the `api` container to ensure valid JSON serialization [VERIFIED]:

### Step 5.1: Enqueue an Ingestion Job
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec api python -c "import redis, json; r=redis.from_url('redis://redis:6379/0'); r.lpush('astroblink:ingest_jobs', json.dumps({'job_id': '00000000-0000-0000-0000-000000000099', 'ra': 160.61529, 'dec': 30.66915, 'size_deg': 0.5}))"
```

### Job JSON Schema [VERIFIED: `contracts/schemas/ingest_job.yaml`]
```json
{
  "job_id": "00000000-0000-0000-0000-000000000099",
  "ra": 160.61529,
  "dec": 30.66915,
  "size_deg": 0.5
}
```

### Step 5.2: Monitor Ingestion Worker Logs
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink logs -f worker
```
The worker will:
1. Pop the job from Redis.
2. Query IRSA TAP for Level 2 FITS files.
3. Stream ranged byte slices from `s3://nasa-irsa-spherex`.
4. Reproject onto the $293 \times 293$ grid at $6.15"/px$.
5. Render WebP tiles and upload them to MinIO bucket `astroblink-tiles`.
6. Insert the subject into PostgreSQL with 1″ pgSphere deduplication.

> [!NOTE]
> On slower network connections (<100 KB/s to AWS `us-east-1`), a 0.5° job may approach the 600-second job cap (`settings.job_timeout_sec=600`). Set `JOB_TIMEOUT_SEC=1200` in `.env` if timeouts occur.

---

## 6. Calling Endpoints & Verifying Output

Use `curl.exe` or `Invoke-RestMethod` from PowerShell [VERIFIED]:

### 6.1 Health Check (Public)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/health" -Method Get | ConvertTo-Json
```
Response: `{"status": "ok", "db": "connected", "redis": "connected"}`

### 6.2 Fetch Next Subject (Public)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/subjects/next" -Method Get | ConvertTo-Json
```
Response: Returns subject `11111111-1111-1111-1111-111111111111` with tile URLs.

### 6.3 Verify Tile Image Direct Download from MinIO
```powershell
curl.exe -I "http://localhost:9000/astroblink-tiles/11111111-1111-1111-1111-111111111111/1_swir.png"
```
Response: `HTTP/1.1 200 OK`, `Content-Type: image/png`, `Content-Length: 917`.

### 6.4 Submit Classification (Public)
```powershell
$body = @{
    subject_id = "11111111-1111-1111-1111-111111111111"
    category = "asteroid_neo"
    marks = @(
        @{ epoch = 1; pixel_x = 48.0; pixel_y = 56.0; ra = 180.0; dec = -2.5 }
    )
    load_time_ms = 4500
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri "http://localhost:8000/api/v1/classify" -Method Post -Body $body -ContentType "application/json" | ConvertTo-Json
```
Response: `{"classification_id": "...", "subject_retired": false, "badges_earned": ["first_classify"], "message": "Classification recorded."}`

### 6.5 Run Consensus (Admin Bearer Token Required)
Unretired subjects return `404 Not Found` per contract. Retire a subject first or pass a retired subject ID:
```powershell
curl.exe -X POST "http://localhost:8000/api/v1/consensus/run" `
  -H "Authorization: Bearer dev-admin-token-change-in-production" `
  -H "Content-Type: application/json" `
  -d '{\"subject_id\":\"11111111-1111-1111-1111-111111111111\"}'
```

### 6.6 List Candidates (Public)
```powershell
Invoke-RestMethod -Uri "http://localhost:8000/api/v1/candidates" -Method Get | ConvertTo-Json
```

### 6.7 Export Candidates as CSV (Admin Bearer Token Required)
```powershell
curl.exe -s "http://localhost:8000/api/v1/candidates/export?format=csv" `
  -H "Authorization: Bearer dev-admin-token-change-in-production"
```

### 6.8 Export Candidates as IVOA VOTable 1.4 XML (Admin Bearer Token Required)
```powershell
curl.exe -s "http://localhost:8000/api/v1/candidates/export?format=votable" `
  -H "Authorization: Bearer dev-admin-token-change-in-production"
```

---

## 7. Inspecting MinIO Object Storage Console

1. Open your browser to `http://localhost:9001` (or your stack's console port, e.g. `9101` for `ab-worker`).
2. Log in with credentials from `.env`:
   - **Username:** `minioadmin` (placeholder)
   - **Password:** `minioadmin` (placeholder)
3. Navigate to **Buckets** → `astroblink-tiles` → click any `{subject_id}` folder to browse and preview rendered `.webp` tiles and `.wcs.json` sidecars.

---

## 8. Running Automated Tests Inside Containers

Run test suites directly inside the isolated Docker containers [VERIFIED]:

### 8.1 API Tests (FastAPI Backend)
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec api python -m pytest tests/ --ignore=tests/test_contract_validation.py -v
```
*(Result: 31 passed. Note: `test_contract_validation.py` requires `jsonschema`, which is currently missing from `requirements-dev.txt` — see `audit/05_known_issues.md` issue #5).*

### 8.2 Worker Tests (Ingestion Pipeline)
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec worker python -m pytest tests/ -v
```
*(Result: 37 passed, 1 deselected. Passes because `infra/docker-compose.override.yml` mounts `/contracts` at `/contracts:ro`).*

### 8.3 Client Tests (Next.js Vitest)
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink exec client npx vitest run
```
*(Result: 2 passed in `BlinkCanvas.test.tsx`).*

---

## 9. Stopping & Cleaning Up

### Stop the Stack (Preserve Database & Tile Data) [VERIFIED]
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink --profile worker stop
```

### Tear Down Stack (Delete Containers and Networks, Preserve Data) [VERIFIED]
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p astroblink --profile worker down
```

### Complete Reset (Throwaway Stacks Only — Deletes Volumes) [VERIFIED]
> [!CAUTION]
> Never run `down -v` on `main` or active worktrees. Only run this on throwaway projects (e.g. `ab-audit`):
```powershell
docker compose -f infra/docker-compose.yml -f infra/docker-compose.override.yml --project-directory . -p ab-audit --profile worker down -v
```
