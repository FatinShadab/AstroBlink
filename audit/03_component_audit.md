# AstroBlink — Component Audit

**Purpose:** Comprehensive audit of every application folder (`api/`, `worker/`, `client/`, `infra/`, `contracts/`), detailing module responsibilities, configuration parameters, test counts, runtime procedures, and honest feature completeness ratings.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Component Overview & Completeness Summary

| Component | Owner Role | Language / Runtime | Test Count | Build Isolation | Overall Completeness |
| :--- | :---: | :--- | :---: | :---: | :---: |
| **`api/`** | Role 2 | Python 3.12 / FastAPI / asyncpg | 34 [VERIFIED] | `./api` context | **PARTIAL / SOLID** (Consensus & exports done; `cutouts/fetch` & `patch candidate` stubbed; `wcs_urls` empty) |
| **`worker/`** | Role 1 | Python 3.12 / Astropy / boto3 | 38 [VERIFIED] | `./worker` context | **DONE / SOLID** (Full S3 ranged pipeline, reprojection, masking, WebP tiles, pgSphere insert tested on 5 targets) |
| **`client/`** | Role 3, 4 | Next.js 14 / React 19 / TypeScript | 2 [VERIFIED] | `./client` context | **STUB / INCOMPLETE** (Scaffold only; outdated band keys; lacks real WCS deprojection, tutorial, gamification) |
| **`infra/`** | Role 5 | Docker Compose / Bash / Python | N/A | `./infra/postgres` | **DONE** (pgSphere compiled; Compose profiles, dev overrides, seed script functional) |
| **`contracts/`**| Role 6 | OpenAPI 3.1 / JSON Schema YAML | N/A | Specification | **PARTIAL** (OpenAPI present, but diverges from worker narrow-slice tile keys and extra sidecar fields) |

---

## 2. API Component Audit (`api/`)

### 2.1 Purpose & Entry Points
- **Purpose:** Serve public citizen-science classification endpoints, validate and ingest user marks, execute DBSCAN consensus clustering, and generate astronomical candidate exports.
- **Entry Points:**
  - Production runtime: `CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]` [VERIFIED: `api/Dockerfile` L79].
  - Dev mode: `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.

### 2.2 Key Modules
- **`app/main.py`** [VERIFIED]: Sets up CORS middleware, exception handlers, and mounts routers (`health`, `cutouts`, `subjects`, `classify`, `consensus`, `candidates`).
- **`app/config.py`** [VERIFIED]: Pydantic `BaseSettings` reading environment variables.
- **`app/db.py`** [VERIFIED]: Creates async SQLAlchemy engine (`create_async_engine`) and yields `AsyncSession`.
- **`app/auth.py`** [VERIFIED]: Fast Bearer token dependency using `hmac.compare_digest` against `settings.admin_token`.
- **`app/routers/health.py`** [VERIFIED]: Queries `SELECT 1` on Postgres, pings Redis, and checks worker heartbeat key freshness (< 30s).
- **`app/routers/subjects.py`** [VERIFIED]: Queries next unretired subject. *(Known issue: hardcodes `"wcs_urls": {}"`).*
- **`app/routers/classify.py`** [VERIFIED]: Records volunteer classification and marks; handles guest user auto-provisioning; retires subject at 10 classifications.
- **`app/routers/consensus.py`** [VERIFIED]: Admin-gated endpoint running DBSCAN clustering, reliability weighting, and tracklet linking on retired subjects.
- **`app/routers/candidates.py`** [VERIFIED]: Public filtering and admin-gated CSV / VOTable 1.4 exports.
- **`app/services/consensus.py`** [VERIFIED]: Pure mathematical DBSCAN clustering implementation using spherical Haversine metric.
- **`app/services/export.py`** [VERIFIED]: Serializes candidate records into CSV and IVOA-compliant VOTable 1.4 XML.

### 2.3 Configuration Parameters (`api/app/config.py`)

| Environment Variable | Setting Attribute | Default Value | Description | Where Read |
| :--- | :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `database_url` | `postgresql+asyncpg://astroblink:astroblink_dev@localhost:5432/astroblink` | PostgreSQL async connection string. | `api/app/db.py` |
| `REDIS_URL` | `redis_url` | `redis://localhost:6379/0` | Redis connection URL. | `api/app/main.py` |
| `TILE_S3_ENDPOINT` | `tile_s3_endpoint` | `http://localhost:9000` | MinIO/S3 tile endpoint. | `api/app/config.py` |
| `TILE_S3_BUCKET` | `tile_s3_bucket` | `astroblink-tiles` | Tile S3 bucket name. | `api/app/config.py` |
| `TILE_S3_ACCESS_KEY`| `tile_s3_access_key`| `minioadmin` | S3 access key. | `api/app/config.py` |
| `TILE_S3_SECRET_KEY`| `tile_s3_secret_key`| `minioadmin` | S3 secret key. | `api/app/config.py` |
| `TILE_BASE_URL` | `tile_base_url` | `http://localhost:9000/astroblink-tiles` | Host-accessible base URL for tile images. | `api/app/routers/subjects.py` |
| `SECRET_KEY` | `secret_key` | `dev-secret-change-in-production` | Secret key placeholder for future JWT. | `api/app/config.py` |
| `CORS_ORIGINS` | `cors_origins` | `http://localhost:3000` | Comma-separated allowed CORS origins. | `api/app/main.py` |
| `CONSENSUS_EPS_PIXELS`| `consensus_eps_pixels`| `1.5` | Clustering radius in detector pixels. | `api/app/routers/consensus.py` |
| `PIXEL_SCALE_ARCSEC`| `pixel_scale_arcsec`| `6.15` | Native detector pixel scale in arcseconds. | `api/app/routers/consensus.py` |
| `MIN_LOAD_TIME_MS` | `min_load_time_ms` | `3000` | Minimum inspection time (anti-spam filter).| `api/app/routers/consensus.py` |
| `RETIREMENT_THRESHOLD`| `retirement_threshold`| `10` | Classifications needed to retire a subject. | `api/app/routers/classify.py`, `consensus.py` |
| `PORT` | `port` | `8000` | Listening HTTP port. | `api/Dockerfile` |
| `ADMIN_TOKEN` | `admin_token` | `dev-admin-token-change-in-production` | Static Bearer token for admin endpoints. | `api/app/auth.py` |

### 2.4 Tests & Execution
- **Test Count:** 34 tests across 7 test modules [VERIFIED].
  - `test_auth.py`: 7 tests
  - `test_consensus_core.py`: 9 tests
  - `test_contract_validation.py`: 3 tests
  - `test_export.py`: 2 tests
  - `test_health.py`: 2 tests
  - `test_reliability.py`: 4 tests
  - `test_schemas.py`: 7 tests
- **How to Run:**
  ```powershell
  # Inside api container:
  docker compose -p <project> exec api python -m pytest tests/ -v
  # On host runner (from api/ directory):
  cd api; pytest tests/ -v
  ```

### 2.5 Feature Completeness Ratings

| Feature | Rating | Evidence & Implementation Notes |
| :--- | :---: | :--- |
| Health Check (`GET /health`) | **DONE** | Fully tests DB, Redis, and worker heartbeat age [VERIFIED: `app/routers/health.py`]. |
| Cutout Enqueue (`POST /cutouts/fetch`)| **STUB** | Returns fake `202 Accepted` with hardcoded ID `00000000-...`; does not enqueue to Redis [VERIFIED: `app/routers/cutouts.py`]. |
| Next Subject (`GET /subjects/next`) | **PARTIAL**| Serves unretired subjects correctly, but hardcodes `wcs_urls={}` [VERIFIED: `app/routers/subjects.py`]. |
| Classify (`POST /classify`) | **DONE** | Full validation, mark persistence in pgSphere, auto-guest fallback, retirement trigger [VERIFIED: `app/routers/classify.py`]. |
| Consensus Engine (`POST /consensus/run`)| **DONE** | Pure DBSCAN, reliability weighting, tracklet linking, idempotent candidate creation [VERIFIED: `app/services/consensus.py`]. |
| Candidate List (`GET /candidates`) | **DONE** | Filtering by status, category, reliability, count [VERIFIED: `app/routers/candidates.py`]. |
| Candidate Export (`GET /candidates/export`)| **DONE**| Exports full multi-epoch centroids to CSV and IVOA VOTable 1.4 XML [VERIFIED: `app/services/export.py`]. |
| Update Candidate (`PATCH /candidates/{id}`)| **STUB**| Returns static string; database update not yet implemented [VERIFIED: `app/routers/candidates.py`]. |

---

## 3. Worker Component Audit (`worker/`)

### 3.1 Purpose & Entry Points
- **Purpose:** Background worker consuming spatial coordinates from Redis, querying IRSA TAP, executing parallel S3 ranged reads on SPHEREx Level 2 FITS files, matching narrow spectral slices across epochs, reprojecting onto a common tangent plane, masking artifacts, rendering WebP tiles, writing WCS JSON sidecars, uploading to S3, and inserting subject records into PostgreSQL.
- **Entry Points:**
  - Production runtime: `CMD ["python", "-m", "worker.main"]` [VERIFIED: `worker/Dockerfile` L42].

### 3.2 Key Modules
- **`worker/worker/main.py`** [VERIFIED]: Process lifecycle, signal trapping, heartbeat thread (`_heartbeat_writer`), queue consumer loop, and orchestration function `process_job()`.
- **`worker/worker/config.py`** [VERIFIED]: Pydantic `BaseSettings` defining all astronomical, networking, and memory thresholds.
- **`worker/worker/db.py`** [VERIFIED]: Direct psycopg2 connection, pgSphere spherical deduplication check (`find_existing_subject_nearby()`), and subject row insertion (`insert_subject()`).
- **`worker/worker/queue/consumer.py`** [VERIFIED]: Redis queue operations (`pop_job()` via `BRPOP` and `push_job()`).
- **`worker/worker/sources/irsa.py`** [VERIFIED]: IRSA TAP spatial queries, WKB polygon parsing, footprint coverage calculation, data-driven epoch clustering, and narrow-slice candidate exposure selection.
- **`worker/worker/sources/s3.py`** [VERIFIED]: Anonymous S3 client configuration, parallel HTTP byte-range fetching (`fetch_ranged_cutout()`), and scratch space quota enforcement (`enforce_scratch_budget()`).
- **`worker/worker/processing/fits_parser.py`** [VERIFIED]: Multi-Extension FITS header parser with full-`END` card iteration.
- **`worker/worker/processing/binning.py`** [VERIFIED]: Wavelength band definition and pixel selection logic.
- **`worker/worker/processing/masking.py`** [VERIFIED]: Defect bitmasking (`FLAGS` bits) and per-pixel shared-wavelength mask intersection.
- **`worker/worker/processing/reproject.py`** [VERIFIED]: Common target WCS grid generation (`build_target_wcs()`) and tangent-plane reprojection via `reproject_interp`.
- **`worker/worker/render/tiles.py`** [VERIFIED]: Lupton arcsinh stretch, visual hatched mask overlay, WebP encoding (< 250 KB budget), and S3 upload.
- **`worker/worker/render/wcs_sidecar.py`** [VERIFIED]: WCS JSON sidecar serialization including affine parameters and per-tile exposure metadata.

### 3.3 Worker Pipeline Step-by-Step & Numeric Facts

```
   [1. Queue Pop] ──► [2. 1″ pgSphere Dedup] ──► [3. IRSA TAP Discovery] ──► [4. Epoch Clustering]
          │                                                                           │
   [8. DB Insert] ◄── [7. Render & Upload]   ◄── [6. Reproject & Mask]    ◄── [5. S3 Ranged Read]
```

1. **Job Pop & Validation:** Pops payload (`job_id`, `ra`, `dec`, optional `size_deg`) from `astroblink:ingest_jobs` (`BRPOP` timeout = `5s`).
2. **1-Arcsecond Deduplication:** Queries `subjects` using pgSphere distance:
   $$\text{position} <-> \text{spoint}(\text{radians}(ra), \text{radians}(dec)) < 4.8481368 \times 10^{-6}\text{ rad}$$
   If a record exists within $1"$, marks job completed without downloading data.
3. **Spatial Discovery & Coverage:** Queries IRSA TAP (`https://irsa.ipac.caltech.edu/TAP/sync`) for candidate exposures covering $(RA, Dec)$. Filters for $\ge 95\%$ footprint overlap (`min_cutout_coverage = 0.95`).
4. **Data-Driven Epoch Clustering:** Groups exposures by observation date (`mjd`):
   - **Standard Sky:** A time gap $\Delta t > 30.0\text{ days}$ (`survey_epoch_gap_days = 30.0`, `[VERIFY]`) demarcates a new survey epoch.
   - **Continuous Viewing Zone (CVZ):** Continuous polar observations with no 30-day gap are split when total span exceeds $182.5\text{ days}$ (`cvz_epoch_span_days = 182.5`, `[VERIFY]`).
   - Default: Only epochs 1 and 2 are processed (`include_epoch_3 = False`).
5. **Wavelength-Matched Selection:**
   - Evaluates target wavelengths: $\lambda_{\text{target}} \in [1.0, 2.0, 4.0]\text{ }\mu\text{m}$.
   - Evaluates tolerance rule:
     $$\text{tol} = k \cdot \frac{\lambda_{\text{target}}}{R}$$
     where $k = 1.0$ (`wavelength_tol_k = 1.0`) and $R$ is resolving power from TAP (`energy_resolvingpower`, typically $R \approx 40$). Tolerance is $\sim 0.025\text{ }\mu\text{m}$ at $1.0\text{ }\mu\text{m}$ and $\sim 0.100\text{ }\mu\text{m}$ at $4.0\text{ }\mu\text{m}$.
   - Samples up to 30 candidates per detector per epoch (`max_candidates_per_det_epoch = 30`).
   - Applies tie-breaking within $0.002\text{ }\mu\text{m}$ (`tie_break_tol_um = 0.002`).
   - Rejects pairs without physical wavelength overlap (`min(w_max) <= max(w_min)`).
6. **Parallel S3 Ranged Reads:**
   - Fetches byte-range strips directly from `s3://nasa-irsa-spherex` (`s3_connect_timeout = 10s`, `s3_read_timeout = 30s`, `s3_max_retries = 4`, `s3_parallel_threads = 6`).
   - Reads FITS headers in 2880-byte blocks until the `END` card is detected, ensuring SIP distortion coefficients are not truncated.
   - Enforces scratch directory cap of 500 MiB (`max_scratch_bytes = 524288000`).
   - Enforces per-job runtime cap of 10 minutes (`job_timeout_sec = 600.0s`).
7. **Reprojection & Masking:**
   - Reprojects cutouts onto tangent plane centered at $(RA, Dec)$ at native $6.15"/px$ ($293 \times 293\text{ pixels}$ for $0.5^\circ$).
   - Masks Level 2 defect bits (FLAGS bits 0–2, 4–7, 9–11, 14–15, 17, 19) when `mask_transient_and_outlier_flags = True`.
   - Masks He airglow band ($1.075\text{--}1.091\text{ }\mu\text{m}$).
   - Evaluates per-pixel shared-wavelength intersection mask across epochs.
8. **Rendering & Sidecars:**
   - Lupton arcsinh stretch scaling flux to uint8 [0, 255].
   - Overlays semi-transparent red hatching over masked pixels.
   - Encodes WebP image strictly under 250 KB (`MAX_TILE_BYTES = 256000`).
   - Builds `.wcs.json` sidecar.
   - Uploads to MinIO/S3 bucket `astroblink-tiles`.
9. **Database Insertion:**
   - Inserts row into `subjects` table with `spoint` coordinates, `tile_urls`, and `mask_fraction`.
   - Updates `ingest_jobs` status to `completed`.

### 3.4 Configuration Parameters (`worker/worker/config.py`)

| Environment Variable | Setting Attribute | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | `database_url` | `postgresql://astroblink:astroblink_dev@localhost:5432/astroblink` | PostgreSQL sync connection string. |
| `REDIS_URL` | `redis_url` | `redis://localhost:6379/0` | Redis connection URL. |
| `TILE_S3_ENDPOINT` | `tile_s3_endpoint` | `http://localhost:9000` | S3 endpoint for tile uploads. |
| `TILE_S3_BUCKET` | `tile_s3_bucket` | `astroblink-tiles` | S3 bucket name for tiles. |
| `TILE_S3_ACCESS_KEY`| `tile_s3_access_key`| `minioadmin` | Tile store access key. |
| `TILE_S3_SECRET_KEY`| `tile_s3_secret_key`| `minioadmin` | Tile store secret key. |
| `SPHEREX_S3_BUCKET`| `spherex_s3_bucket`| `nasa-irsa-spherex` | Anonymous SPHEREx data bucket. |
| `SPHEREX_S3_REGION`| `spherex_s3_region`| `us-east-1` | SPHEREx S3 AWS region. |
| `IRSA_CUTOUT_BASE_URL`| `irsa_cutout_base_url`| `https://irsa.ipac.caltech.edu/ibe/data/spherex` | Verified IRSA IBE base URL. |
| `FITS_SCRATCH_DIR` | `fits_scratch_dir` | `/tmp/astroblink` | Local scratch storage directory. |
| `REDIS_QUEUE_KEY` | `redis_queue_key` | `astroblink:ingest_jobs` | Redis list queue key. |
| `BRPOP_TIMEOUT` | `brpop_timeout` | `5` | BRPOP blocking timeout (seconds). |
| `HEARTBEAT_PATH` | `heartbeat_path` | `/tmp/heartbeat` | Health check heartbeat file path. |
| `SURVEY_EPOCH_GAP_DAYS`| `survey_epoch_gap_days`| `30.0` | Gap threshold for epoch clustering [VERIFY]. |
| `CVZ_EPOCH_SPAN_DAYS`| `cvz_epoch_span_days`| `182.5` | CVZ 6-month epoch sweep span [VERIFY]. |
| `WAVELENGTH_TOL_K` | `wavelength_tol_k` | `1.0` | Tolerance multiplier $k$ for $\text{tol} = k \cdot (\lambda/R)$. |
| `INCLUDE_EPOCH_3` | `include_epoch_3` | `False` | Whether to include incomplete Epoch 3. |
| `DEFAULT_SIZE_DEG` | `default_size_deg` | `0.5` | Default cutout angular dimension in degrees. |
| `MASK_FLAGS` | `mask_transient_and_outlier_flags`| `True` | Whether to mask Bit 0 and Bit 19 by default. |
| `JOB_TIMEOUT_SEC` | `job_timeout_sec` | `600.0` | Maximum runtime cap per ingestion job. |

### 3.5 Tests & Execution
- **Test Count:** 38 tests across 10 test modules [VERIFIED].
  - `test_binning_masking.py`: 4 tests
  - `test_db.py`: 3 tests
  - `test_fits_parser.py`: 1 test
  - `test_ingest_job_schema.py`: 3 tests
  - `test_main_pipeline.py`: 6 tests
  - `test_placeholder.py`: 3 tests
  - `test_real_data.py`: 1 test
  - `test_render.py`: 5 tests
  - `test_reproject.py`: 4 tests
  - `test_sources.py`: 8 tests
- **How to Run:**
  ```powershell
  # Inside worker container (Note: Requires /contracts mounted to pass test_ingest_job_schema):
  docker compose -p <project> exec worker python -m pytest tests/ -v
  # On host runner (from worker/ directory):
  cd worker; pytest tests/ -v
  ```

### 3.6 Feature Completeness Ratings

| Feature | Rating | Evidence & Implementation Notes |
| :--- | :---: | :--- |
| IRSA TAP Spatial Discovery | **DONE** | Validated against real sky coordinates [VERIFIED: `worker/worker/sources/irsa.py`]. |
| Anonymous S3 Ranged Fetch | **DONE** | Byte-range reads with retry, streaming directly from `s3://nasa-irsa-spherex` [VERIFIED: `worker/worker/sources/s3.py`]. |
| FITS Header Parsing | **DONE** | Iterates 2880B blocks through `END` card; extracts full SIP polynomial [VERIFIED: `worker/worker/processing/fits_parser.py`]. |
| Narrow-Slice Wavelength Matching | **DONE** | Extracts 1.0, 2.0, 4.0 µm slices using $\text{tol} = k \cdot (\lambda/R)$ [VERIFIED: `worker/worker/processing/binning.py`]. |
| 0.5° Tangent Reprojection | **DONE** | Reprojects onto native $6.15"/px$ $293 \times 293$ grid [VERIFIED: `worker/worker/processing/reproject.py`]. |
| Masking (FLAGS + Airglow + Shared λ)| **DONE** | Defect bitmasks, He airglow, and cross-epoch shared λ intersection applied [VERIFIED: `worker/worker/processing/masking.py`]. |
| Tile Rendering (< 250 KB WebP) | **DONE** | Asinh stretch, visual hatched overlay, WebP compression under 250 KB [VERIFIED: `worker/worker/render/tiles.py`]. |
| WCS JSON Sidecar Generation | **DONE** | Serializes `crpix`, `crval`, `cd`, `naxis`, and per-tile exposure metadata [VERIFIED: `worker/worker/render/wcs_sidecar.py`]. |
| S3 Tile Upload | **DONE** | Uploads tiles and sidecars to `astroblink-tiles` [VERIFIED: `worker/worker/render/tiles.py`]. |
| PostgreSQL pgSphere Subject Insert | **DONE** | Inserts subject with 1″ coordinate deduplication [VERIFIED: `worker/worker/db.py`]. |
| Redis Queue Worker Loop & Heartbeat | **DONE** | Consumes `astroblink:ingest_jobs` and writes healthy heartbeat [VERIFIED: `worker/worker/main.py`]. |

---

## 4. Client Component Audit (`client/`)

### 4.1 Purpose & Entry Points
- **Purpose:** Public-facing web application for citizen-science volunteers to blink-compare infrared sky tiles, mark potential moving objects, submit classifications, and explore discoveries.
- **Entry Points:**
  - Production runtime: `CMD ["node", "server.js"]` [VERIFIED: `client/Dockerfile`].
  - Dev mode: `npm run dev` (listening on port 3000).

### 4.2 Key Modules
- **`src/app/page.tsx`** [VERIFIED]: Landing page placeholder with links to `/classify`, `/tutorial`, and `/discoveries`.
- **`src/app/classify/page.tsx`** [VERIFIED]: Main classification page with auto-blink loop and click-to-mark handler.
- **`src/components/BlinkCanvas.tsx`** [VERIFIED]: Canvas component rendering subject tiles and mark circles.
- **`src/components/BandSelector.tsx`** [VERIFIED]: Band toggle component.
- **`src/components/AnnotationLayer.tsx`** [VERIFIED]: SVG overlay component for marks.
- **`src/components/ConsensusBadge.tsx`** [VERIFIED]: Visual badge presentation.
- **`src/lib/api/client.ts`** [VERIFIED]: API client wrapper for `/subjects/next` and `/classify`.

### 4.3 Configuration Parameters (`client/.env.example`)

| Environment Variable | Default Value | Description | Where Read |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:8000` | Browser-reachable API URL (baked into build). | `client/src/lib/api/` |
| `API_INTERNAL_URL` | `http://api:8000` | Server-side API URL for SSR calls inside Docker network. | `client/next.config.ts` |
| `TILE_BASE_URL` | `http://localhost:9000/astroblink-tiles` | Base URL for tile image `<img src>`. | `client/src/` |
| `PORT` | `3000` | Web server listening port. | `client/Dockerfile` |

### 4.4 Tests & Execution
- **Test Count:** 2 tests in `__tests__/BlinkCanvas.test.tsx` [VERIFIED].
- **How to Run:**
  ```powershell
  # Inside client container:
  docker compose -p <project> exec client npm run test
  # On host runner:
  cd client; npm run test
  ```

### 4.5 Feature Completeness Ratings

| Feature | Rating | Evidence & Implementation Notes |
| :--- | :---: | :--- |
| Basic Canvas Blink Animation | **PARTIAL** | Loops epochs, but lacks pan/zoom and OpenSeadragon integration [VERIFIED: `BlinkCanvas.tsx`]. |
| Band Selection | **INCOMPLETE**| Hardcodes obsolete `"swir" \| "mwir" \| "rgb"` keys; does not support narrow slices (`1.0um`, `2.0um`, `4.0um`) [VERIFIED: `BandSelector.tsx`]. |
| WCS Coordinate Deprojection | **INCOMPLETE**| Hardcodes crude linear $128 \times 128$ box formula; does not parse JSON WCS sidecar [VERIFIED: `classify/page.tsx` L91-96]. |
| Mark Submission & Feedback | **PARTIAL** | Submits single mark to `/classify`; lacks multiple mark tracking [VERIFIED: `classify/page.tsx`]. |
| Onboarding Tutorial | **STUB** | Simple placeholder page `/tutorial`; lacks interactive walkthrough [VERIFIED: `src/app/tutorial/page.tsx`]. |
| Discovery Feed & Profile | **STUB** | Placeholder page `/discoveries`; lacks real candidate querying [VERIFIED: `src/app/discoveries/page.tsx`]. |

---

## 5. Infrastructure Component Audit (`infra/`)

### 5.1 Purpose & Key Files
- **Purpose:** Multi-container orchestration, PostgreSQL + pgSphere build, service networking, and development data seeding.
- **Key Files:**
  - **`infra/docker-compose.yml`** [VERIFIED]: Base Compose manifest defining 8 services (`postgres`, `redis`, `minio`, `minio-init`, `migrate`, `api`, `client`, `worker`).
  - **`infra/docker-compose.override.yml`** [VERIFIED]: Mounts local source directories for hot-reloading.
  - **`infra/postgres/Dockerfile`** [VERIFIED]: Multi-stage Dockerfile compiling `pgSphere` C extension from source on Alpine Linux.
  - **`infra/scripts/seed_dev.py`** [VERIFIED]: Database seeder populating test users, subjects, and classifications.

### 5.2 Feature Completeness Ratings

| Feature | Rating | Evidence & Implementation Notes |
| :--- | :---: | :--- |
| PostgreSQL + pgSphere Image | **DONE** | Custom build installs and verifies `pg_sphere` extension successfully [VERIFIED: `infra/postgres/Dockerfile`]. |
| Docker Compose Multi-Stack Support| **DONE** | Configurable via `COMPOSE_PROJECT_NAME` and port environment variables [VERIFIED: `infra/docker-compose.yml`]. |
| MinIO Initialization | **DONE** | Automatic bucket creation and anonymous download policy via `mc` [VERIFIED: `infra/docker-compose.yml` L54-70]. |
| Database Migration Automation | **DONE** | `migrate` one-shot container executes `alembic upgrade head` before API starts [VERIFIED: `infra/docker-compose.yml` L72-84]. |
| Production Deployment Manifests | **STUB** | Manifests in `infra/deploy/` are markdown guides and stubs [VERIFIED: `infra/deploy/`]. |

---

## 6. Contracts Component Audit (`contracts/`)

### 6.1 Purpose & Key Files
- **Purpose:** API specification and schema definitions acting as the authoritative single source of truth for REST endpoints and message queues.
- **Key Files:**
  - **`contracts/openapi.yaml`** [VERIFIED]: OpenAPI 3.1 specification.
  - **`contracts/schemas/`** [VERIFIED]: Modular YAML schemas: `subject.yaml`, `classification.yaml`, `candidate.yaml`, `consensus.yaml`, `cutout.yaml`, `ingest_job.yaml`, `error.yaml`.

### 6.2 Feature Completeness Ratings & Discrepancies

| Feature / Schema | Rating | Evidence & Implementation Notes |
| :--- | :---: | :--- |
| OpenAPI Specification | **DONE** | Covers all 8 core API endpoints with error response models [VERIFIED: `contracts/openapi.yaml`]. |
| Ingest Job Schema (`ingest_job.yaml`) | **DONE** | Matches Redis queue payloads between API and worker [VERIFIED: `worker/tests/test_ingest_job_schema.py`]. |
| Subject Tile Keys Pattern | **DIVERGES** | Schema specifies `^[1-4]_[a-z0-9_]+$`, which rejects narrow-slice keys like `1_1.0um` containing periods [VERIFIED: `contracts/schemas/subject.yaml`]. |
| WCS Sidecar Schema | **DIVERGES** | Schema specifies `additionalProperties: false`, but worker includes extra provenance metadata (`tiles`, `mask_fraction`, `job_runtime_s`) [VERIFIED: `worker/worker/render/wcs_sidecar.py`]. |
