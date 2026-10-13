# AstroBlink — Architecture As-Built

**Purpose:** Technical specification of the system architecture as currently implemented, documenting the end-to-end data flow, database tables, Redis job shapes, object storage keys, API router implementations, and authentication mechanics.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. System Context Diagram (As-Built)

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              EXTERNAL ASTRONOMICAL SERVICES                            │
│                                                                                        │
│   ┌─────────────────────────────────────────┐   ┌───────────────────────────────────┐  │
│   │ S3: s3://nasa-irsa-spherex (us-east-1)  │   │ IRSA TAP Service                  │  │
│   │ Anonymous ranged HTTP byte-slice reads  │   │ https://irsa.ipac.caltech.edu/TAP │  │
│   └────────────────────┬────────────────────┘   └─────────────────┬─────────────────┘  │
└────────────────────────┼──────────────────────────────────────────┼────────────────────┘
                         │ Ranged GET (boto3)                       │ ADQL Sync (HTTPS)
                         ▼                                          ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ INGESTION WORKER (`worker/`)                                                 [Role 1]  │
│                                                                                        │
│  1. BRPOP job ←── 'astroblink:ingest_jobs' (Redis)                                     │
│  2. Spatial Discovery via IRSA TAP (`spherex.artifact` JOIN `spherex.plane`)          │
│  3. Data-driven epoch clustering (30d gap / 182.5d CVZ rule)                           │
│  4. Ranged read of FITS headers (through END card) & WCS-WAVE lookup tables            │
│  5. Narrow-slice wavelength matching (1.0, 2.0, 4.0 µm) with tol = k * λ / R           │
│  6. Target TAN grid reprojection (293×293 px at 6.15"/px)                              │
│  7. Shared-wavelength mask & Level 2 defect masking (FLAGS bits)                       │
│  8. WebP render (< 250 KB) with hatching + WCS JSON sidecar generation                 │
│  9. Upload tiles & sidecars to MinIO/S3 bucket 'astroblink-tiles'                      │
│ 10. Direct PostgreSQL insert with pgSphere 1″ deduplication                            │
│ 11. Heartbeat write to '/tmp/heartbeat' and Redis key 'astroblink:worker:heartbeat'    │
└────────────────┬──────────────────────────────────┬────────────────────────────────────┘
                 │ S3 API PutObject                 │ SQL INSERT (psycopg2)
                 ▼                                  ▼
┌─────────────────────────────────┐   ┌──────────────────────────────────────────────────┐
│ OBJECT STORE (MinIO / AWS S3)   │   │ POSTGRESQL 16 + pgSphere EXTENSION      [Role 5] │
│ Bucket: 'astroblink-tiles'      │   │                                                  │
│                                 │   │ Tables:                                          │
│ Keys:                           │   │  • users (volunteers, reliability score)         │
│  {subj_id}/{epoch}_{band}.webp  │   │  • subjects (spoint position, tile_urls)         │
│  {subj_id}/{epoch}_{band}.wcs.  │   │  • classifications (user-subject submissions)    │
│    json                         │   │  • marks (spoint sky coords, pixel coordinates)  │
│                                 │   │  • candidates (DBSCAN clusters, motion vectors)  │
│ Bands: 1.0um, 2.0um, 4.0um, rgb │   │  • candidate_epochs (per-epoch cluster centroids)│
└────────────────┬────────────────┘   │  • ingest_jobs (job status tracker)              │
                 │                    │  • badges, user_badges, candidate_reviews        │
                 │ Direct Image GET   └───────────────┬──────────────────────────────────┘
                 │ (WebP)                             │
                 │                                    │ asyncpg SQL Queries
                 │                                    ▼
                 │                    ┌──────────────────────────────────────────────────┐
                 │                    │ FASTAPI BACKEND (`api/`)                [Role 2] │
                 │                    │                                                  │
                 │                    │ Routers:                                         │
                 │                    │  • GET  /health (DB, Redis, Worker heartbeat)    │
                 │                    │  • GET  /api/v1/subjects/next (Public)           │
                 │                    │  • POST /api/v1/classify (Public, auto-guest)    │
                 │                    │  • POST /api/v1/consensus/run (Admin Bearer)     │
                 │                    │  • GET  /api/v1/candidates (Public filtered list)│
                 │                    │  • GET  /api/v1/candidates/export (Admin Bearer) │
                 │                    │  • POST /api/v1/cutouts/fetch (STUB)             │
                 │                    │  • PATCH /api/v1/candidates/{id} (STUB)          │
                 │                    └───────────────▲──────────────────────────────────┘
                 │                                    │
                 │                                    │ HTTP REST
                 │                                    ▼
                 │                    ┌──────────────────────────────────────────────────┐
                 │                    │ NEXT.JS 14 FRONTEND (`client/`)        [Role 3,4]│
                 │                    │                                                  │
                 └────────────────────┼─► Blink Canvas (manual/auto toggle)              │
                                      │   *Known Issue: Hardcoded to old swir/mwir bands │
                                      │   and linear 128px deprojection.                 │
                                      └──────────────────────────────────────────────────┘
```

---

## 2. End-to-End Data Flow

### Step 1: Ingestion & Tile Generation [VERIFIED]
1. An ingestion job payload is placed on the Redis queue `astroblink:ingest_jobs`.
2. The worker `worker/worker/queue/consumer.py` pops the job via `BRPOP` (5s timeout).
3. The worker executes `process_job()` in `worker/worker/main.py`:
   - Checks `subjects` table via pgSphere spherical distance operator `<->` for existing subject within 1 arcsecond (`find_existing_subject_nearby()`). If found, marks job completed (deduped).
   - Queries IRSA TAP for candidate Level 2 FITS files overlapping the target box ($0.5^\circ \times 0.5^\circ$).
   - Groups observations into survey epochs using data-driven clustering (30-day temporal gap or 182.5-day CVZ span).
   - Discovers narrow-slice exposures matching target wavelengths ($1.0, 2.0, 4.0\text{ }\mu\text{m}$) using detector resolving power $R$ and tolerance $\text{tol} = k \cdot (\lambda / R)$.
   - Performs parallel S3 ranged reads from `s3://nasa-irsa-spherex` to extract image sub-arrays and `WCS-WAVE` tables.
   - Reprojects exposures onto a common tangent-plane (TAN) WCS grid ($293 \times 293\text{ pixels}$ at $6.15"/px$).
   - Evaluates the per-pixel shared-wavelength intersection mask and defect bitmasks (FLAGS bits 0–2, 4–7, 9–11, 14–15, 17, 19 + airglow exclusion $1.075\text{--}1.091\text{ }\mu\text{m}$).
   - Renders WebP tiles (< 250 KB) with semi-transparent hatching over invalid/masked pixels.
   - Generates accompanying JSON WCS sidecars containing `crpix`, `crval`, `cd`, `naxis`, and per-tile exposure metadata.
   - Uploads tiles and sidecars to MinIO/S3 bucket `astroblink-tiles` under keys `{subject_id}/{epoch}_{band}.webp` and `{subject_id}/{epoch}_{band}.wcs.json`.
   - Inserts the new subject record into PostgreSQL `subjects` table.

### Step 2: Subject Serving & Volunteer Classification [VERIFIED]
1. Volunteer client requests `GET /api/v1/subjects/next`.
2. `api/app/routers/subjects.py` queries `subjects` table for unretired subjects (`retired = FALSE`) with $\ge 2$ epochs, ordered by lowest `classification_count` and earliest `created_at`.
3. Returns `SubjectResponse` containing sky coordinates, epoch list, and absolute `tile_urls` (using `settings.tile_base_url`).
   *(Note: `wcs_urls` is hardcoded to `{}` in the current API implementation).*
4. Volunteer blinks images across epochs, selects an astronomical category, clicks candidate moving sources, and submits `POST /api/v1/classify`.
5. `api/app/routers/classify.py`:
   - Validates category against allowed enum.
   - Ensures a valid user exists (defaults to `demo-classifier` or creates a unique `guest-classifier` to avoid conflict with `UNIQUE (user_id, subject_id)`).
   - Inserts a record into `classifications`.
   - Inserts marks into `marks` table with `spoint(radians(ra), radians(dec))`.
   - Increments `subjects.classification_count`.
   - If `classification_count >= settings.retirement_threshold` (10), sets `subjects.retired = TRUE`.

### Step 3: Consensus Aggregation [VERIFIED]
1. Administrator triggers `POST /api/v1/consensus/run` with Bearer token authentication.
2. `api/app/routers/consensus.py`:
   - Resolves target subject; verifies subject is retired (`retired = TRUE` or `classification_count >= 10`).
   - Retrieves all classifications with `load_time_ms >= settings.min_load_time_ms` (3000 ms anti-spam filter).
   - Extracts all marks across all valid classifications.
   - Calls `run_pure_consensus()` in `api/app/services/consensus.py`:
     - Clusters marks per-epoch using DBSCAN with Great-Circle / Haversine distance metric and $\varepsilon = 1.5\text{ px} \times 6.15" = 9.225"$.
     - Computes reliability-weighted centroid positions:
       $$\bar{\mathbf{c}} = \frac{\sum w_i \mathbf{p}_i}{\sum w_i}$$
     - Links clusters across epochs into candidate trajectories (tracklets).
     - Determines category by reliability-weighted majority vote across volunteer classifications.
     - Computes candidate motion vector: proper motion ($\Delta\theta/\Delta t$ in $\text{arcsec/epoch}$) and position angle ($\text{PA}$ in degrees).
   - Idempotently deletes any previous candidates for this subject and inserts new rows into `candidates` and `candidate_epochs`.

### Step 4: Candidate Export [VERIFIED]
1. Astronomer calls `GET /api/v1/candidates/export?format=csv` or `format=votable` with Bearer token.
2. `api/app/routers/candidates.py` filters candidates by status, category, minimum reliability, and minimum classification count.
3. Joins centroids across epochs 1 through 4 from `candidate_epochs`.
4. Serializes records via `api/app/services/export.py`:
   - `format=csv`: Standard comma-separated values with RFC 4180 headers.
   - `format=votable`: IVOA-compliant VOTable 1.4 XML with standard UCDs (`pos.eq.ra;meta.main`, `pos.eq.dec;meta.main`), coordinate system declarations (`<COOSYS ID="J2000" equinox="J2000." system="ICRS"/>`), and candidate attributes.

---

## 3. Database Schema (PostgreSQL 16 + pgSphere)

Managed via Alembic migration `api/alembic/versions/001_initial_schema.py` [VERIFIED].

### Tables and Constraints

| Table Name | Primary Key | Key Columns & Spatial Types | Foreign Keys & Indices |
| :--- | :--- | :--- | :--- |
| `users` | `id` (UUID) | `display_name` (VARCHAR 100), `role` (user_role enum), `reliability` (FLOAT [0, 1]), `gold_total` (INT), `gold_correct` (INT), `classification_count` (INT) | UNIQUE on `(oauth_provider, oauth_sub)` WHERE NOT NULL. |
| `subjects` | `id` (UUID) | `position` (**spoint** pgSphere), `ra_deg` (FLOAT), `dec_deg` (FLOAT), `size_deg` (FLOAT), `epochs` (INT[]), `tile_urls` (JSONB), `is_gold_standard` (BOOL), `mask_fraction` (FLOAT), `retired` (BOOL), `classification_count` (INT) | GIST index on `position`. Index on `(is_gold_standard, created_at)` WHERE retired = FALSE. |
| `classifications` | `id` (UUID) | `category` (classification_category enum), `load_time_ms` (INT), `user_reliability_at_submission` (FLOAT), `submitted_at` (TIMESTAMPTZ) | FK `user_id` -> `users(id)`, FK `subject_id` -> `subjects(id)`. **UNIQUE (`user_id`, `subject_id`)**. |
| `marks` | `id` (UUID) | `epoch` (INT), `pixel_x` (FLOAT), `pixel_y` (FLOAT), `ra_deg` (FLOAT), `dec_deg` (FLOAT), `position` (**spoint** pgSphere) | FK `classification_id` -> `classifications(id)` ON DELETE CASCADE. Indices on `classification_id` and `(classification_id, epoch)`. |
| `candidates` | `id` (UUID) | `category` (classification_category enum), `status` (candidate_status enum: 'new', 'under_review', 'confirmed', 'rejected'), `n_classifications` (INT), `mean_reliability` (FLOAT), `cluster_dispersion_arcsec` (FLOAT), `motion_arcsec_per_epoch` (FLOAT), `motion_pa_deg` (FLOAT) | FK `subject_id` -> `subjects(id)`. Indices on `status` and `subject_id`. |
| `candidate_epochs` | `id` (UUID) | `epoch` (INT), `centroid_ra_deg` (FLOAT), `centroid_dec_deg` (FLOAT), `centroid_position` (**spoint** pgSphere), `cluster_size` (INT), `dispersion_arcsec` (FLOAT) | FK `candidate_id` -> `candidates(id)` ON DELETE CASCADE. **UNIQUE (`candidate_id`, `epoch`)**. |
| `candidate_reviews` | `id` (UUID) | `old_status` (candidate_status), `new_status` (candidate_status), `rationale` (TEXT), `reviewed_at` (TIMESTAMPTZ) | FK `candidate_id` -> `candidates(id)`, FK `reviewer_id` -> `users(id)`. |
| `badges` | `id` (VARCHAR 50) | `display_name` (VARCHAR 100), `description` (TEXT), `threshold` (INT) | Seeded with 7 default badges (`first_classify`, `classify_10`, `gold_hit`, etc.). |
| `user_badges` | `(user_id, badge_id)` | `earned_at` (TIMESTAMPTZ) | Composite PK referencing `users` and `badges`. |
| `ingest_jobs` | `id` (UUID) | `ra_deg` (FLOAT), `dec_deg` (FLOAT), `size_deg` (FLOAT), `status` (ingest_job_status enum: 'queued', 'running', 'completed', 'failed'), `error_message` (TEXT), `retries` (INT) | FK `subject_id` -> `subjects(id)`. Index on `status` WHERE queued or running. |

---

## 4. Redis Queue & Key Layout

- **Ingestion Job Queue Key:** `"astroblink:ingest_jobs"` [VERIFIED: `worker/worker/config.py` L41]
  - Structure: Redis List (`LPUSH` / `BRPOP`).
  - Consumed by: `worker/worker/queue/consumer.py`.
- **Ingestion Job Payload Schema:** [VERIFIED: `contracts/schemas/ingest_job.yaml`]
  ```json
  {
    "job_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "ra": 180.0,
    "dec": -2.5,
    "size_deg": 0.5
  }
  ```
- **Worker Heartbeat Redis Key:** `"astroblink:worker:heartbeat"` [VERIFIED: `worker/worker/main.py`]
  - Structure: String containing Unix timestamp updated every ~2–5 seconds. Checked by `GET /health` in `api/app/routers/health.py`.
- **Worker Local Heartbeat File:** `"/tmp/heartbeat"` [VERIFIED: `worker/worker/config.py` L47]
  - Written by worker background thread for Docker container `HEALTHCHECK`.

---

## 5. Object Storage (MinIO / S3) Key Layout

- **Bucket Name:** `astroblink-tiles` (env `TILE_S3_BUCKET`) [VERIFIED: `worker/worker/config.py` L20].
- **Key Hierarchy:**
  ```text
  astroblink-tiles/
  └── {subject_id}/
      ├── {epoch}_{band}.webp       # Rendered 293x293 WebP tile (< 250 KB)
      └── {epoch}_{band}.wcs.json   # JSON WCS sidecar file
  ```
- **As-Built Bands:**
  - `1_1.0um.webp` & `1_1.0um.wcs.json`
  - `1_2.0um.webp` & `1_2.0um.wcs.json`
  - `1_4.0um.webp` & `1_4.0um.wcs.json`
  - `1_rgb.webp`   & `1_rgb.wcs.json`
  - `2_1.0um.webp` & `2_1.0um.wcs.json`
  - `2_2.0um.webp` & `2_2.0um.wcs.json`
  - `2_4.0um.webp` & `2_4.0um.wcs.json`
  - `2_rgb.webp`   & `2_rgb.wcs.json`
- **WCS Sidecar Content:** [VERIFIED: `worker/worker/render/wcs_sidecar.py`]
  ```json
  {
    "crpix": [146.5, 146.5],
    "crval": [15.0, -20.0],
    "cd": [[-0.001708, 0.0], [0.0, 0.001708]],
    "naxis": [293, 293],
    "ctype": ["RA---TAN", "DEC--TAN"],
    "tile_key": "1_1.0um",
    "epoch": 1,
    "target_wavelength_um": 1.0,
    "shared_wavelength_min_um": 0.985,
    "shared_wavelength_max_um": 1.015,
    "mask_fraction": 0.8409,
    "valid_fraction": 0.1591,
    "tiles": { ... }
  }
  ```

---

## 6. API Endpoints Implementation vs. Contracts

Comparison between `contracts/openapi.yaml` and implemented routers in `api/app/routers/` [VERIFIED]:

| Method | Endpoint Path | Implementation Module | Contract Status | Completeness & Implementation Notes |
| :--- | :--- | :--- | :---: | :--- |
| `GET` | `/health` | `api/app/routers/health.py` | MATCH | **DONE**. Checks PostgreSQL connection, Redis connection, and worker heartbeat age (<30s). Returns `healthy`, `degraded`, or `unhealthy`. |
| `POST` | `/api/v1/cutouts/fetch` | `api/app/routers/cutouts.py` | MATCH | **STUB**. Returns static `202 Accepted` with hardcoded `job_id="00000000-..."`. Does not insert `ingest_jobs` or push to Redis queue. |
| `GET` | `/api/v1/subjects/next` | `api/app/routers/subjects.py` | DIVERGES | **PARTIAL**. Queries DB for next unretired subject. Returns `200` or `204`. **Known bug:** Hardcodes `"wcs_urls": {}` instead of returning sidecar URLs. |
| `POST` | `/api/v1/classify` | `api/app/routers/classify.py` | MATCH | **DONE**. Validates category, checks subject existence, auto-creates guest user on collision, persists classification + marks in DB, increments count, and retires at 10. |
| `POST` | `/api/v1/consensus/run` | `api/app/routers/consensus.py` | MATCH | **DONE**. Protected by admin token. Validates retirement, executes DBSCAN clustering, reliability weighting, and tracklet linking; persists candidates idempotently. |
| `GET` | `/api/v1/candidates` | `api/app/routers/candidates.py` | MATCH | **DONE**. Filters by `status`, `category`, `min_reliability`, `min_classifications`. Returns JSON candidate list and count. |
| `GET` | `/api/v1/candidates/export` | `api/app/routers/candidates.py` | MATCH | **DONE**. Protected by admin token. Serializes candidates with multi-epoch centroids into CSV or IVOA VOTable 1.4 XML. |
| `PATCH`| `/api/v1/candidates/{id}` | `api/app/routers/candidates.py` | MATCH | **STUB**. Returns static `200 OK` with `"message": "Stub: candidate status update not yet implemented."`. |

---

## 7. Authentication & Authorization Mechanics

As-built authentication mechanism [VERIFIED: `api/app/auth.py`]:
1. **Model:** Static Bearer token verification against `settings.admin_token`.
2. **Implementation:**
   - Dependency function: `require_admin_token()`.
   - Compares incoming `Authorization: Bearer <token>` against `settings.admin_token` using constant-time `hmac.compare_digest()` to eliminate timing attack vectors.
   - Never logs token values.
   - Missing or invalid tokens return `HTTP 401 Unauthorized` with `WWW-Authenticate: Bearer` header.
3. **Protected Endpoints:**
   - `POST /api/v1/consensus/run`
   - `GET /api/v1/candidates/export`
4. **Public Endpoints (Unprotected):**
   - `GET /health`
   - `POST /api/v1/cutouts/fetch`
   - `GET /api/v1/subjects/next`
   - `POST /api/v1/classify`
   - `GET /api/v1/candidates`
5. **Architectural Deviation:** The original plan envisioned full JWT OAuth2 with volunteer/astronomer/admin role claims. The as-built system simplified this to a single constant-time `ADMIN_TOKEN` for the Phase 1 backend MVP.
