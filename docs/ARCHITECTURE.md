# AstroBlink — Architecture Document

> **Project:** AstroBlink · NASA Space Apps Challenge 2026 · "Planet X and SPHEREx" track
> **Version:** 1.0 · **Date:** 2026-10-10
> **Companion docs:** [README.md](../README.md) · [PRD.md](PRD.md) · [ROADMAP.md](ROADMAP.md)

---

## Table of Contents

1. [Component Diagram](#1-component-diagram)
2. [Component Descriptions](#2-component-descriptions)
3. [PostgreSQL Schema (DDL)](#3-postgresql-schema-ddl)
4. [API Contracts](#4-api-contracts)
5. [Consensus Algorithm Pseudocode](#5-consensus-algorithm-pseudocode)
6. [Caching Design](#6-caching-design)
7. [Rate-Limiting Design](#7-rate-limiting-design)
8. [Security Design](#8-security-design)
9. [Open Questions](#9-open-questions)

---

## 1. Component Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                   EXTERNAL DATA SOURCES                             │
│                                                                                     │
│  ┌────────────────────┐   ┌────────────────────┐   ┌─────────────────────────────┐  │
│  │  S3: nasa-irsa-    │   │  IRSA Cutout       │   │  MPC / JPL Horizons         │  │
│  │  spherex           │   │  Service            │   │  (gold-standard ephemeris)  │  │
│  │  (us-east-1,       │   │  [VERIFY: OQ-1]    │   │                             │  │
│  │   anonymous)       │   │                     │   │                             │  │
│  └────────┬───────────┘   └────────┬────────────┘   └──────────┬──────────────────┘  │
│           │                        │                            │                    │
└───────────┼────────────────────────┼────────────────────────────┼────────────────────┘
            │                        │                            │
            ▼                        ▼                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                              INGESTION WORKER (Python)                     Role 1   │
│                                                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐ │
│  │ S3/IRSA  │→ │ MEF FITS │→ │ WCS-WAVE │→ │ FLAGS    │→ │ Reproject│→ │ Tile   │ │
│  │ Fetch    │  │ Parse    │  │ λ-Select │  │ + Airglow│  │ & Co-add │  │ Render │ │
│  │          │  │ (astropy)│  │ per-band │  │ Mask     │  │ (reproject)│ │ PNG/   │ │
│  │          │  │          │  │          │  │          │  │          │  │ WebP   │ │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └──────────┘  └───┬────┘ │
│                                                                              │      │
│  Job queue: Redis List (BRPOP) or PostgreSQL SKIP LOCKED                     │      │
└──────────────────────────────────────────────────────────────────────────────┼──────┘
                                                                               │
                     ┌─────────────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                 STORAGE LAYER                                       │
│                                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────┐  ┌───────────────────────┐  │
│  │  PostgreSQL 16           │  │  Object Store         │  │  Redis 7              │  │
│  │  + pgSphere extension    │  │  (local fs / S3)      │  │                       │  │
│  │                          │  │                       │  │  • Session store       │  │
│  │  Tables:                 │  │  /tiles/              │  │  • Rate-limit windows  │  │
│  │   • users                │  │    {subject_id}/      │  │  • Leaderboard (ZSET)  │  │
│  │   • subjects             │  │      {epoch}_{band}.  │  │  • Subject queue cache │  │
│  │   • classifications      │  │        webp           │  │  • Ingestion job queue │  │
│  │   • marks                │  │      {epoch}_{band}.  │  │                       │  │
│  │   • candidates           │  │        wcs.json       │  │                       │  │
│  │   • candidate_epochs     │  │                       │  │                       │  │
│  │   • badges               │  │                       │  │                       │  │
│  │   • user_badges          │  │                       │  │                       │  │
│  │   • candidate_reviews    │  │                       │  │                       │  │
│  └──────────────────────────┘  └───────────────────────┘  └───────────────────────┘  │
│                                                                                     │
└──────────────┬──────────────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY  (FastAPI)                          Role 2, 6 │
│                                                                                     │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌────────────────────────────┐   │
│  │ Auth Middleware      │  │ Rate-Limit Middle-  │  │ Request Validation         │   │
│  │ (JWT verify,        │  │ ware (Redis sliding  │  │ (Pydantic models)          │   │
│  │  role check)        │  │  window)             │  │                            │   │
│  └─────────┬───────────┘  └─────────┬───────────┘  └─────────┬──────────────────┘   │
│            └────────────────────────┼────────────────────────┘                       │
│                                     ▼                                               │
│  ┌──────────────────────────────────────────────────────────────────────────────┐    │
│  │ Endpoints                                                                    │    │
│  │                                                                              │    │
│  │  POST /api/v1/cutouts/fetch     → enqueue ingestion job                      │    │
│  │  GET  /api/v1/subjects/next     → serve next unretired subject               │    │
│  │  POST /api/v1/classify          → record classification + marks              │    │
│  │  POST /api/v1/consensus/run     → trigger DBSCAN + tracklet linking          │    │
│  │  GET  /api/v1/candidates        → list candidates (filtered)                 │    │
│  │  GET  /api/v1/candidates/export → download CSV / VOTable                     │    │
│  │  PATCH /api/v1/candidates/{id}  → update candidate status (astronomer)       │    │
│  │  GET  /api/v1/health            → health check                               │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
└──────────────────────────────────────────┬──────────────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT  (Next.js 14 + Canvas)                    Role 3, 4 │
│                                                                                     │
│  ┌──────────────────────────────────────────────────────────────────────────────┐    │
│  │  Blink Comparator (OpenSeadragon / HTML5 Canvas)                             │    │
│  │                                                                              │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐                         │    │
│  │  │ Epoch 1 │  │ Epoch 2 │  │ Epoch 3 │  │ Epoch 4 │  ← same band, same WCS │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘                         │    │
│  │                                                                              │    │
│  │  [ ▶ Play/Pause ] [ Speed ◀━━●━━▶ ] [ Band: SWIR | MWIR | RGB ]            │    │
│  │  [ Mark ✚ ] [ Category ▼ ] [ Submit ✓ ] [ Nothing Here ∅ ]                  │    │
│  │                                                                              │    │
│  │  Annotation overlay (SVG) — marks rendered with epoch-colored circles        │    │
│  │  WCS readout bar: RA = 12h 34m 56.7s  Dec = +01° 23′ 45.6″                 │    │
│  └──────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌─────────────────────┐  │
│  │ Onboarding    │  │ Dashboard     │  │ Discovery     │  │ Professional        │  │
│  │ Tutorial      │  │ & Profile     │  │ Feed          │  │ Review Panel        │  │
│  │ (interactive) │  │ (badges,      │  │ (confirmed    │  │ (candidate list,    │  │
│  │               │  │  stats,       │  │  candidates)  │  │  status, export)    │  │
│  │               │  │  leaderboard) │  │               │  │                     │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  └─────────────────────┘  │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Component Descriptions

### 2.1 Client (Next.js 14) — Role 3, Role 4

| Sub-component | Technology | Responsibility |
|---------------|-----------|----------------|
| **Blink Comparator** | OpenSeadragon (tile viewer) + HTML5 Canvas overlay | Loads pre-rendered PNG/WebP tiles, animates across epochs for the selected band, supports pan/zoom. |
| **Annotation Layer** | SVG overlay aligned via WCS JSON sidecar | Renders epoch-colored mark circles; converts pixel (x,y) → (RA, Dec) client-side using the affine WCS transform from the JSON sidecar. |
| **WCS Readout** | TypeScript utility | Parses the JSON WCS sidecar (`crpix`, `crval`, `cd` matrix) and implements the TAN deprojection to compute (RA, Dec) from cursor pixel position. |
| **Onboarding Tutorial** | React component (step-by-step modal) | Walks new users through artifact recognition and mark placement using annotated gold-standard examples. |
| **Dashboard / Profile** | React pages | Displays classification count, badges, streak, leaderboard (from Redis via API). |
| **Discovery Feed** | React page | Lists recent confirmed candidates with thumbnails fetched from the object store. |
| **Professional Review Panel** | React page (role-gated) | Candidate table with filters, detail view with per-epoch overlays, status update form, export buttons. |

### 2.2 API Gateway (FastAPI) — Role 2, Role 6

- **Framework:** FastAPI (Python 3.12, async with `uvicorn`).
- **Middleware stack:** CORS → HTTPS redirect → JWT auth → rate-limit → request logging.
- **Serialization:** Pydantic v2 models for all request/response schemas.
- **Background tasks:** FastAPI `BackgroundTasks` for lightweight post-response work (badge checks, reliability updates). Long-running consensus uses the job queue.

### 2.3 Ingestion Worker — Role 1

- **Runtime:** Standalone Python process consuming jobs from Redis list (`BRPOP astroblink:ingest_jobs`).
- **Libraries:** `boto3` (S3, `botocore.UNSIGNED`), `astropy.io.fits`, `astropy.wcs`, `reproject`, `Pillow`, `numpy`.
- **Concurrency:** Single-threaded per worker; scale by running multiple worker processes.
- **Idempotency:** Before inserting a subject, checks for existing subjects within 1″ (pgSphere `spoint <-> spoint < 1.0/3600.0 * pi()/180.0`).

### 2.4 PostgreSQL 16 + pgSphere — Role 2

**Why pgSphere over q3c:**

| Criterion | pgSphere | q3c |
|-----------|----------|-----|
| **Data types** | Native `spoint`, `scircle`, `sbox`, `spath` types stored as columns. | Index-only; stores RA/Dec as two `float8` columns. |
| **RA wraparound** | Handled natively by spherical operators (`<->` distance, `@` containment). | Handled by the `q3c_join` function but not by column operators. |
| **Query expressiveness** | `WHERE position <-> spoint(ra, dec) < radius` — readable, composable with other predicates. | `WHERE q3c_radial_query(ra, dec, cra, cdec, radius)` — function-based, harder to compose. |
| **Index type** | GiST index on `spoint` columns. | Custom q3c index. |
| **Maintenance** | Actively maintained; packaged in most Linux distros. | Less frequently updated. |

**Decision:** Use pgSphere. It provides the cleanest API for our spatial queries (nearest-subject deduplication, sky-region filtering, candidate sky-area queries) and handles RA wraparound and cos(Dec) scaling at the storage layer.

### 2.5 Redis 7 — Role 5

Four logical databases (or key prefixes):

| Prefix | Purpose | Data structure |
|--------|---------|---------------|
| `astroblink:session:` | JWT refresh token store | STRING (TTL 7 days) |
| `astroblink:ratelimit:` | Sliding-window counters | SORTED SET (score = timestamp) |
| `astroblink:leaderboard:` | Classification counts | SORTED SET (`alltime`, `weekly:{iso_week}`) |
| `astroblink:ingest_jobs` | Ingestion job queue | LIST (BRPOP by workers) |
| `astroblink:subject_queue:` | Pre-fetched next-subject IDs per user | LIST (small buffer per user, refilled lazily) |

### 2.6 Object Store — Role 1, Role 5

- **Dev:** Local filesystem at `./data/tiles/`.
- **Prod:** S3-compatible (self-hosted MinIO or cloud S3).
- **Path convention:** `tiles/{subject_id}/{epoch}_{band}.webp` and `tiles/{subject_id}/{epoch}_{band}.wcs.json`.
- **Served to client:** via CDN or Nginx reverse proxy with `Cache-Control: public, max-age=86400`.

---

## 3. PostgreSQL Schema (DDL)

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_sphere;   -- spherical geometry types
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- uuid_generate_v4()

-- ============================================================
-- ENUM TYPES
-- ============================================================
CREATE TYPE user_role AS ENUM ('volunteer', 'astronomer', 'admin');

CREATE TYPE classification_category AS ENUM (
    'asteroid_neo',
    'comet',
    'brown_dwarf',
    'planet_x_candidate',
    'artifact',
    'nothing'
);

CREATE TYPE candidate_status AS ENUM (
    'new',
    'under_review',
    'confirmed',
    'rejected'
);

CREATE TYPE ingest_job_status AS ENUM (
    'queued',
    'running',
    'completed',
    'failed'
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    display_name    VARCHAR(100) NOT NULL,
    email           VARCHAR(255) UNIQUE,           -- NULL for anonymous guests
    oauth_provider  VARCHAR(20),                   -- 'google', 'github', NULL
    oauth_sub       VARCHAR(255),                  -- provider subject ID
    role            user_role NOT NULL DEFAULT 'volunteer',
    reliability     FLOAT NOT NULL DEFAULT 0.5     -- [0.0, 1.0]
        CHECK (reliability >= 0.0 AND reliability <= 1.0),
    gold_total      INT NOT NULL DEFAULT 0,        -- total gold-standard subjects seen
    gold_correct    INT NOT NULL DEFAULT 0,        -- correctly classified gold subjects
    classification_count INT NOT NULL DEFAULT 0,
    tutorial_completed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_users_oauth
    ON users (oauth_provider, oauth_sub)
    WHERE oauth_provider IS NOT NULL;

-- ============================================================
-- SUBJECTS
-- ============================================================
CREATE TABLE subjects (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    position        spoint NOT NULL,               -- pgSphere sky position (RA, Dec in radians)
    ra_deg          FLOAT NOT NULL,                -- denormalized for export convenience
    dec_deg         FLOAT NOT NULL,
    size_deg        FLOAT NOT NULL DEFAULT 0.1,    -- cutout angular size (degrees)
    epochs          INT[] NOT NULL,                -- available epoch indices, e.g., {1,2,3}
    tile_urls       JSONB NOT NULL,                -- {"1_swir": "tiles/abc/1_swir.webp", ...}
    is_gold_standard BOOLEAN NOT NULL DEFAULT FALSE,
    gold_expected   JSONB,                         -- expected marks for gold subjects
                                                   -- e.g., [{"epoch":1,"ra":180.1,"dec":0.5}]
    mask_fraction   FLOAT,                         -- fraction of pixels masked (0.0–1.0)
    retired         BOOLEAN NOT NULL DEFAULT FALSE,
    classification_count INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Spatial index for deduplication and sky-region queries
CREATE INDEX idx_subjects_position
    ON subjects USING GIST (position);

-- Queue queries: unretired, ordered by creation, filtered by gold
CREATE INDEX idx_subjects_queue
    ON subjects (is_gold_standard, created_at)
    WHERE retired = FALSE;

-- ============================================================
-- CLASSIFICATIONS
-- ============================================================
CREATE TABLE classifications (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(id),
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    category        classification_category NOT NULL,
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    load_time_ms    INT,                           -- time from subject load to submit (anti-spam)
    user_reliability_at_submission FLOAT NOT NULL,  -- snapshot for audit

    UNIQUE (user_id, subject_id)                   -- same user cannot classify same subject twice
);

CREATE INDEX idx_classifications_subject
    ON classifications (subject_id);

CREATE INDEX idx_classifications_user
    ON classifications (user_id);

-- ============================================================
-- MARKS (child of classifications)
-- ============================================================
CREATE TABLE marks (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    classification_id UUID NOT NULL REFERENCES classifications(id) ON DELETE CASCADE,
    epoch           INT NOT NULL,                  -- epoch index (1-based)
    pixel_x         FLOAT NOT NULL,
    pixel_y         FLOAT NOT NULL,
    ra_deg          FLOAT NOT NULL,                -- converted via WCS sidecar
    dec_deg         FLOAT NOT NULL,
    position        spoint NOT NULL,               -- pgSphere (RA, Dec in radians)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_marks_classification
    ON marks (classification_id);

-- For consensus queries: all marks for a subject, grouped by epoch
CREATE INDEX idx_marks_subject_epoch
    ON marks (classification_id, epoch);

-- ============================================================
-- CANDIDATES
-- ============================================================
CREATE TABLE candidates (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subject_id      UUID NOT NULL REFERENCES subjects(id),
    category        classification_category NOT NULL,
    status          candidate_status NOT NULL DEFAULT 'new',
    n_classifications INT NOT NULL,                -- contributing classifications
    mean_reliability FLOAT NOT NULL,               -- mean reliability-weighted score
    cluster_dispersion_arcsec FLOAT,               -- mean per-epoch cluster scatter
    motion_arcsec_per_epoch FLOAT,                 -- magnitude of motion vector
    motion_pa_deg   FLOAT,                         -- position angle of motion (N=0, E=90)
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidates_status
    ON candidates (status);

CREATE INDEX idx_candidates_subject
    ON candidates (subject_id);

-- ============================================================
-- CANDIDATE_EPOCHS (per-epoch cluster centroids for each candidate)
-- ============================================================
CREATE TABLE candidate_epochs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id    UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
    epoch           INT NOT NULL,
    centroid_ra_deg FLOAT NOT NULL,
    centroid_dec_deg FLOAT NOT NULL,
    centroid_position spoint NOT NULL,             -- pgSphere
    cluster_size    INT NOT NULL,                  -- number of marks in this cluster
    dispersion_arcsec FLOAT NOT NULL,              -- angular scatter of marks in cluster

    UNIQUE (candidate_id, epoch)
);

CREATE INDEX idx_candidate_epochs_candidate
    ON candidate_epochs (candidate_id);

-- ============================================================
-- CANDIDATE_REVIEWS (audit log for professional review)
-- ============================================================
CREATE TABLE candidate_reviews (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_id    UUID NOT NULL REFERENCES candidates(id),
    reviewer_id     UUID NOT NULL REFERENCES users(id),
    old_status      candidate_status NOT NULL,
    new_status      candidate_status NOT NULL,
    rationale       TEXT,
    reviewed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_candidate_reviews_candidate
    ON candidate_reviews (candidate_id);

-- ============================================================
-- BADGES
-- ============================================================
CREATE TABLE badges (
    id              VARCHAR(50) PRIMARY KEY,       -- e.g., 'first_classification'
    display_name    VARCHAR(100) NOT NULL,
    description     TEXT NOT NULL,
    icon_url        VARCHAR(500),
    threshold       INT                            -- e.g., 10 for "10 classifications"
);

-- Seed badge definitions
INSERT INTO badges (id, display_name, description, threshold) VALUES
    ('first_classify',    'First Light',        'Submit your first classification.',                    1),
    ('classify_10',       'Sharp Eyes',         'Submit 10 classifications.',                           10),
    ('classify_50',       'Asteroid Hunter',    'Submit 50 classifications.',                           50),
    ('classify_100',      'Comet Chaser',       'Submit 100 classifications.',                          100),
    ('classify_500',      'Deep Sky Surveyor',  'Submit 500 classifications.',                          500),
    ('gold_hit',          'Bullseye',           'Correctly identify a gold-standard object.',            NULL),
    ('streak_7',          'Week Warrior',       'Classify on 7 consecutive days.',                      7);

-- ============================================================
-- USER_BADGES (many-to-many)
-- ============================================================
CREATE TABLE user_badges (
    user_id         UUID NOT NULL REFERENCES users(id),
    badge_id        VARCHAR(50) NOT NULL REFERENCES badges(id),
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

    PRIMARY KEY (user_id, badge_id)
);

-- ============================================================
-- INGEST_JOBS (tracking ingestion work)
-- ============================================================
CREATE TABLE ingest_jobs (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ra_deg          FLOAT NOT NULL,
    dec_deg         FLOAT NOT NULL,
    size_deg        FLOAT NOT NULL DEFAULT 0.1,
    status          ingest_job_status NOT NULL DEFAULT 'queued',
    subject_id      UUID REFERENCES subjects(id),  -- populated on completion
    error_message   TEXT,
    retries         INT NOT NULL DEFAULT 0,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ingest_jobs_status
    ON ingest_jobs (status)
    WHERE status IN ('queued', 'running');
```

### 3.1 Schema Notes

- **`spoint` storage:** pgSphere `spoint` stores (longitude, latitude) in **radians**. Conversion: `spoint(radians(ra_deg), radians(dec_deg))`. The `ra_deg`/`dec_deg` float columns are denormalized for export convenience and human-readable queries.
- **`tile_urls` JSONB:** Flexible key-value mapping `"{epoch}_{band}" → URL`. Example: `{"1_swir": "tiles/abc/1_swir.webp", "1_mwir": "tiles/abc/1_mwir.webp", "1_rgb": "tiles/abc/1_rgb.webp", "2_swir": "tiles/abc/2_swir.webp", ...}`.
- **`classifications` uniqueness:** `UNIQUE (user_id, subject_id)` enforces FR-2.6 (same subject never classified twice by same user).
- **`marks` are a child table:** One classification has 0–N marks (0 for "nothing" category). Marks are cascade-deleted if a classification is removed (admin action only).
- **`candidate_epochs` denormalization:** Storing per-epoch centroids as separate rows (rather than a JSONB array) enables efficient spatial queries and joins for VOTable export.

---

## 4. API Contracts

### Common Error Shape

All error responses use this envelope:

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Human-readable description of what went wrong.",
        "details": [
            {"field": "ra", "issue": "Must be in range [0, 360)."}
        ]
    }
}
```

Standard error codes: `VALIDATION_ERROR` (422), `NOT_FOUND` (404), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `RATE_LIMITED` (429), `CONFLICT` (409), `INTERNAL_ERROR` (500), `SERVICE_UNAVAILABLE` (503).

---

### 4.1 `POST /api/v1/cutouts/fetch`

**Purpose:** Enqueue an ingestion job to fetch, bin, and render tiles for a sky region.
**Auth:** `admin` role required.
**Owner:** Role 1, Role 2.

**Request:**

```json
POST /api/v1/cutouts/fetch
Content-Type: application/json
Authorization: Bearer <jwt>

{
    "ra": 180.0,
    "dec": -2.5,
    "size_deg": 0.1
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `ra` | float | yes | [0, 360) degrees |
| `dec` | float | yes | [−90, +90] degrees |
| `size_deg` | float | no | default 0.1; range (0, 1.0] degrees |

**Responses:**

**202 Accepted** — Job enqueued.

```json
{
    "job_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "status": "queued",
    "ra": 180.0,
    "dec": -2.5,
    "size_deg": 0.1,
    "message": "Ingestion job enqueued. Poll GET /api/v1/cutouts/fetch/{job_id} for status."
}
```

**409 Conflict** — A subject already exists within 1″ of the requested position with the same epoch coverage.

```json
{
    "error": {
        "code": "CONFLICT",
        "message": "A subject already exists at this position.",
        "details": [
            {"existing_subject_id": "a1b2c3d4-..."}
        ]
    }
}
```

**422 Unprocessable Entity** — Validation failure.

```json
{
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request parameters.",
        "details": [
            {"field": "ra", "issue": "Must be in range [0, 360)."}
        ]
    }
}
```

**429 Too Many Requests** — Rate-limited.

---

### 4.2 `POST /api/v1/classify`

**Purpose:** Submit a classification (marks + category) for a subject.
**Auth:** `volunteer`, `astronomer`, or `admin` role. Unauthenticated requests rejected.
**Owner:** Role 2, Role 3.

**Request:**

```json
POST /api/v1/classify
Content-Type: application/json
Authorization: Bearer <jwt>

{
    "subject_id": "a1b2c3d4-5678-9abc-def0-123456789abc",
    "category": "asteroid_neo",
    "marks": [
        {
            "epoch": 1,
            "pixel_x": 128.4,
            "pixel_y": 95.7,
            "ra": 180.00234,
            "dec": -2.49876
        },
        {
            "epoch": 2,
            "pixel_x": 131.2,
            "pixel_y": 96.1,
            "ra": 180.00301,
            "dec": -2.49852
        }
    ],
    "load_time_ms": 18200
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `subject_id` | UUID | yes | Must reference an existing, non-retired subject. |
| `category` | enum | yes | One of: `asteroid_neo`, `comet`, `brown_dwarf`, `planet_x_candidate`, `artifact`, `nothing`. |
| `marks` | array | yes | Empty array `[]` if category is `nothing`. Otherwise ≥ 1 mark. |
| `marks[].epoch` | int | yes | Must be in subject's `epochs` array. |
| `marks[].pixel_x` | float | yes | ≥ 0, < tile NAXIS1. |
| `marks[].pixel_y` | float | yes | ≥ 0, < tile NAXIS2. |
| `marks[].ra` | float | yes | [0, 360) degrees. |
| `marks[].dec` | float | yes | [−90, +90] degrees. |
| `load_time_ms` | int | no | Milliseconds between subject load and submit. Used for anti-spam heuristic. |

**Responses:**

**201 Created** — Classification recorded.

```json
{
    "classification_id": "c1a2b3c4-...",
    "subject_id": "a1b2c3d4-...",
    "category": "asteroid_neo",
    "marks_count": 2,
    "subject_classification_count": 7,
    "subject_retired": false,
    "badges_earned": ["classify_10"],
    "message": "Classification recorded. 3 more needed before retirement."
}
```

**409 Conflict** — User already classified this subject.

```json
{
    "error": {
        "code": "CONFLICT",
        "message": "You have already classified this subject.",
        "details": [
            {"existing_classification_id": "prev-uuid-..."}
        ]
    }
}
```

**422 Unprocessable Entity** — Validation failure (e.g., epoch not in subject, marks empty for non-nothing category).

**429 Too Many Requests** — Rate-limited (> 60 classifications/hour).

**Side effects on 201:**
1. `subjects.classification_count` incremented.
2. If `classification_count` reaches 10, `subjects.retired` set to `true`.
3. If the subject is gold-standard, `users.gold_total` incremented; if the classification matches `gold_expected`, `users.gold_correct` incremented and `users.reliability` recalculated as `gold_correct / gold_total` (clamped to [0.05, 1.0]).
4. `users.classification_count` incremented; badge check triggered as a background task.
5. Redis leaderboard ZINCRBY.
6. If `load_time_ms < 3000`, classification is flagged `suspicious` (stored but excluded from consensus).

---

### 4.3 `POST /api/v1/consensus/run`

**Purpose:** Run the consensus pipeline on a single retired subject or all retired subjects pending consensus.
**Auth:** `astronomer` or `admin` role.
**Owner:** Role 2.

**Request (single subject):**

```json
POST /api/v1/consensus/run
Content-Type: application/json
Authorization: Bearer <jwt>

{
    "subject_id": "a1b2c3d4-5678-9abc-def0-123456789abc",
    "epsilon_arcsec": 9.2,
    "min_pts": 3,
    "max_displacement_arcsec": 30.0
}
```

**Request (batch — all pending):**

```json
POST /api/v1/consensus/run
Content-Type: application/json
Authorization: Bearer <jwt>

{
    "batch": true,
    "epsilon_arcsec": 9.2,
    "min_pts": 3,
    "max_displacement_arcsec": 30.0
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `subject_id` | UUID | no | If omitted and `batch=true`, runs on all retired subjects not yet processed. |
| `batch` | bool | no | Default false. If true, `subject_id` is ignored. |
| `epsilon_arcsec` | float | no | DBSCAN ε. Default 9.2 (1.5 × 6.15″). Range: [3.0, 60.0]. |
| `min_pts` | int | no | DBSCAN minPts. Default 3. Range: [2, 8]. |
| `max_displacement_arcsec` | float | no | Max inter-epoch cluster displacement for tracklet linking. Default 30.0. Range: [5.0, 300.0]. |

**Responses:**

**200 OK** — Consensus completed (single subject).

```json
{
    "subject_id": "a1b2c3d4-...",
    "classifications_processed": 10,
    "candidates_found": 1,
    "candidates": [
        {
            "candidate_id": "e5f6a7b8-...",
            "category": "asteroid_neo",
            "n_classifications": 7,
            "mean_reliability": 0.72,
            "motion_arcsec_per_epoch": 12.4,
            "motion_pa_deg": 265.3,
            "epochs": [
                {
                    "epoch": 1,
                    "centroid_ra": 180.00245,
                    "centroid_dec": -2.49870,
                    "cluster_size": 7,
                    "dispersion_arcsec": 4.1
                },
                {
                    "epoch": 2,
                    "centroid_ra": 180.00312,
                    "centroid_dec": -2.49848,
                    "cluster_size": 6,
                    "dispersion_arcsec": 3.8
                }
            ]
        }
    ]
}
```

**202 Accepted** — Batch run enqueued (async).

```json
{
    "batch_job_id": "b1c2d3e4-...",
    "subjects_queued": 42,
    "message": "Batch consensus job started. Results will be written to the candidates table."
}
```

**404 Not Found** — `subject_id` does not exist or is not retired.

**422 Unprocessable Entity** — Parameter out of range.

---

### 4.4 `GET /api/v1/candidates/export`

**Purpose:** Export validated candidates as CSV or VOTable.
**Auth:** `astronomer` or `admin` role.
**Owner:** Role 2.

**Request:**

```
GET /api/v1/candidates/export?format=votable&status=confirmed&min_reliability=0.5
Authorization: Bearer <jwt>
```

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `format` | string | yes | `csv` or `votable`. |
| `status` | string | no | Filter by candidate status. One of: `new`, `under_review`, `confirmed`, `rejected`. Multiple values comma-separated. Default: all. |
| `min_reliability` | float | no | Minimum `mean_reliability`. Default 0.0. |
| `min_classifications` | int | no | Minimum `n_classifications`. Default 0. |
| `category` | string | no | Filter by `classification_category`. |
| `ra_min`, `ra_max`, `dec_min`, `dec_max` | float | no | Sky-region bounding box (degrees). |

**Response (200 OK, format=csv):**

```
Content-Type: text/csv
Content-Disposition: attachment; filename="astroblink_candidates_20261010.csv"

candidate_id,subject_id,category,status,n_classifications,mean_reliability,motion_arcsec_per_epoch,motion_pa_deg,cluster_dispersion_arcsec,epoch_1_ra,epoch_1_dec,epoch_2_ra,epoch_2_dec,epoch_3_ra,epoch_3_dec,epoch_4_ra,epoch_4_dec
e5f6a7b8-...,a1b2c3d4-...,asteroid_neo,confirmed,7,0.72,12.4,265.3,4.1,180.00245,-2.49870,180.00312,-2.49848,,,
```

**Response (200 OK, format=votable):**

```xml
Content-Type: application/x-votable+xml
Content-Disposition: attachment; filename="astroblink_candidates_20261010.xml"

<?xml version="1.0" encoding="UTF-8"?>
<VOTABLE version="1.4" xmlns="http://www.ivoa.net/xml/VOTable/v1.3">
  <RESOURCE name="AstroBlink Candidates">
    <DESCRIPTION>Citizen-science candidates from AstroBlink (SPHEREx blink comparator)</DESCRIPTION>
    <TABLE name="candidates">
      <FIELD name="candidate_id"            datatype="char"   arraysize="*"  ucd="meta.id;meta.main"/>
      <FIELD name="subject_id"              datatype="char"   arraysize="*"  ucd="meta.id"/>
      <FIELD name="category"                datatype="char"   arraysize="*"  ucd="src.class"/>
      <FIELD name="status"                  datatype="char"   arraysize="*"  ucd="meta.code.status"/>
      <FIELD name="n_classifications"       datatype="int"                   ucd="meta.number"/>
      <FIELD name="mean_reliability"        datatype="float"                 ucd="stat.likelihood"/>
      <FIELD name="motion_arcsec_per_epoch" datatype="float"  unit="arcsec"  ucd="pos.pm"/>
      <FIELD name="motion_pa_deg"           datatype="float"  unit="deg"     ucd="pos.posAng"/>
      <FIELD name="epoch_1_ra"              datatype="double" unit="deg"     ucd="pos.eq.ra"/>
      <FIELD name="epoch_1_dec"             datatype="double" unit="deg"     ucd="pos.eq.dec"/>
      <FIELD name="epoch_2_ra"              datatype="double" unit="deg"     ucd="pos.eq.ra"/>
      <FIELD name="epoch_2_dec"             datatype="double" unit="deg"     ucd="pos.eq.dec"/>
      <FIELD name="epoch_3_ra"              datatype="double" unit="deg"     ucd="pos.eq.ra"/>
      <FIELD name="epoch_3_dec"             datatype="double" unit="deg"     ucd="pos.eq.dec"/>
      <FIELD name="epoch_4_ra"              datatype="double" unit="deg"     ucd="pos.eq.ra"/>
      <FIELD name="epoch_4_dec"             datatype="double" unit="deg"     ucd="pos.eq.dec"/>
      <DATA>
        <TABLEDATA>
          <TR>
            <TD>e5f6a7b8-...</TD>
            <TD>a1b2c3d4-...</TD>
            <TD>asteroid_neo</TD>
            <TD>confirmed</TD>
            <TD>7</TD>
            <TD>0.72</TD>
            <TD>12.4</TD>
            <TD>265.3</TD>
            <TD>180.00245</TD>
            <TD>-2.49870</TD>
            <TD>180.00312</TD>
            <TD>-2.49848</TD>
            <TD></TD>
            <TD></TD>
            <TD></TD>
            <TD></TD>
          </TR>
        </TABLEDATA>
      </DATA>
    </TABLE>
  </RESOURCE>
</VOTABLE>
```

**404 Not Found** — No candidates match filters.

**422 Unprocessable Entity** — Invalid `format` or parameter.

---

## 5. Consensus Algorithm Pseudocode

### 5.1 Overview

```
consensus(subject_id, ε, minPts, max_displacement):
    1. Load all non-suspicious classifications for the subject
    2. For each epoch with marks:
       a. Cluster marks using weighted DBSCAN (haversine)
    3. Link per-epoch clusters into tracklets
    4. Create candidate records for valid tracklets
```

### 5.2 Haversine Angular Distance

```python
def haversine(ra1_deg, dec1_deg, ra2_deg, dec2_deg) -> float:
    """
    Angular distance in arcseconds between two sky positions.
    Handles RA wraparound inherently via trigonometric identities.
    """
    ra1, dec1 = radians(ra1_deg), radians(dec1_deg)
    ra2, dec2 = radians(ra2_deg), radians(dec2_deg)

    d_ra  = ra2 - ra1
    d_dec = dec2 - dec1

    a = sin(d_dec / 2)**2 + cos(dec1) * cos(dec2) * sin(d_ra / 2)**2
    c = 2 * asin(sqrt(a))          # central angle in radians

    return degrees(c) * 3600.0      # convert to arcseconds
```

### 5.3 Reliability-Weighted DBSCAN

Standard DBSCAN treats all points equally. We modify the neighborhood density calculation to incorporate per-user reliability weights.

```python
def weighted_dbscan(marks, epsilon_arcsec, min_pts):
    """
    marks: list of {ra, dec, weight}  where weight = user reliability [0.05, 1.0]
    epsilon_arcsec: neighborhood radius
    min_pts: minimum weighted density to form a core point

    Returns: list of clusters, each a list of mark indices.
             Noise points are not included in any cluster.
    """
    N = len(marks)
    labels = [-1] * N          # -1 = unvisited
    cluster_id = 0

    for i in range(N):
        if labels[i] != -1:
            continue                            # already assigned

        # Find neighbors within ε
        neighbors = []
        for j in range(N):
            if haversine(marks[i].ra, marks[i].dec,
                         marks[j].ra, marks[j].dec) <= epsilon_arcsec:
                neighbors.append(j)

        # Check weighted density: sum of weights of neighbors
        weighted_density = sum(marks[j].weight for j in neighbors)

        if weighted_density < min_pts:
            labels[i] = 0                       # noise
            continue

        # Expand cluster
        cluster_id += 1
        labels[i] = cluster_id
        seed_set = set(neighbors) - {i}

        while seed_set:
            q = seed_set.pop()
            if labels[q] == 0:                  # was noise → border point
                labels[q] = cluster_id
            if labels[q] != -1:
                continue                        # already processed
            labels[q] = cluster_id

            q_neighbors = []
            for j in range(N):
                if haversine(marks[q].ra, marks[q].dec,
                             marks[j].ra, marks[j].dec) <= epsilon_arcsec:
                    q_neighbors.append(j)

            q_weighted_density = sum(marks[j].weight for j in q_neighbors)
            if q_weighted_density >= min_pts:
                seed_set |= set(q_neighbors)

    # Group by cluster_id (excluding noise label 0)
    clusters = {}
    for i, label in enumerate(labels):
        if label > 0:
            clusters.setdefault(label, []).append(i)

    return list(clusters.values())
```

### 5.4 Per-Epoch Clustering

```python
def cluster_epoch(subject_id, epoch, epsilon_arcsec, min_pts):
    """
    Cluster all volunteer marks for a single epoch of a single subject.
    Returns list of EpochCluster objects.
    """
    # 1. Load marks for this subject + epoch, joining user reliability
    marks = db.query("""
        SELECT m.ra_deg, m.dec_deg, u.reliability
        FROM marks m
        JOIN classifications c ON m.classification_id = c.id
        JOIN users u ON c.user_id = u.id
        WHERE c.subject_id = :subject_id
          AND m.epoch = :epoch
          AND c.load_time_ms >= 3000     -- exclude suspicious (anti-spam)
    """, subject_id=subject_id, epoch=epoch)

    if len(marks) == 0:
        return []

    # 2. Build weighted mark list
    weighted_marks = [
        WeightedMark(ra=m.ra_deg, dec=m.dec_deg, weight=m.reliability)
        for m in marks
    ]

    # 3. Run weighted DBSCAN
    clusters = weighted_dbscan(weighted_marks, epsilon_arcsec, min_pts)

    # 4. Compute cluster centroids and statistics
    epoch_clusters = []
    for cluster_indices in clusters:
        ras  = [weighted_marks[i].ra  for i in cluster_indices]
        decs = [weighted_marks[i].dec for i in cluster_indices]
        weights = [weighted_marks[i].weight for i in cluster_indices]

        # Weighted mean position (safe for small fields; RA wraparound
        # negligible within a 0.1° cutout, but we still use atan2 for safety)
        mean_ra, mean_dec = weighted_spherical_mean(ras, decs, weights)

        # Dispersion: weighted RMS angular distance from centroid
        dispersions = [haversine(mean_ra, mean_dec, ras[k], decs[k])
                       for k in range(len(ras))]
        dispersion = sqrt(sum(w * d**2 for w, d in zip(weights, dispersions))
                          / sum(weights))

        epoch_clusters.append(EpochCluster(
            epoch=epoch,
            centroid_ra=mean_ra,
            centroid_dec=mean_dec,
            cluster_size=len(cluster_indices),
            dispersion_arcsec=dispersion,
            mean_reliability=sum(weights) / len(weights)
        ))

    return epoch_clusters
```

### 5.5 Tracklet Linking Across Epochs

```python
def link_tracklets(epoch_clusters_by_epoch, max_displacement_arcsec):
    """
    Link per-epoch clusters into motion tracklets.

    epoch_clusters_by_epoch: dict { epoch_int: [EpochCluster, ...] }
    max_displacement_arcsec: max angular separation between linked clusters
                             in consecutive epochs.

    Returns list of Tracklet objects, each containing an ordered sequence
    of EpochCluster references.
    """
    sorted_epochs = sorted(epoch_clusters_by_epoch.keys())

    if len(sorted_epochs) < 2:
        # Cannot form a tracklet with < 2 epochs.
        # Return each cluster as an isolated (unlinked) candidate.
        return [
            Tracklet(clusters=[c])
            for epoch in sorted_epochs
            for c in epoch_clusters_by_epoch[epoch]
        ]

    # Build a graph: nodes = (epoch, cluster_index), edges = valid links
    # Use greedy nearest-neighbor linkage (simplest for hackathon)

    tracklets = []
    used = set()  # (epoch, cluster_index) tuples already consumed

    for i, epoch_a in enumerate(sorted_epochs[:-1]):
        epoch_b = sorted_epochs[i + 1]
        clusters_a = epoch_clusters_by_epoch[epoch_a]
        clusters_b = epoch_clusters_by_epoch[epoch_b]

        for ai, ca in enumerate(clusters_a):
            if (epoch_a, ai) in used:
                continue

            # Find nearest cluster in next epoch
            best_bi = None
            best_dist = float('inf')
            for bi, cb in enumerate(clusters_b):
                if (epoch_b, bi) in used:
                    continue
                dist = haversine(ca.centroid_ra, ca.centroid_dec,
                                 cb.centroid_ra, cb.centroid_dec)
                if dist <= max_displacement_arcsec and dist < best_dist:
                    best_dist = dist
                    best_bi = bi

            if best_bi is not None:
                # Start or extend a tracklet
                tracklet = Tracklet(clusters=[ca, clusters_b[best_bi]])
                used.add((epoch_a, ai))
                used.add((epoch_b, best_bi))

                # Try to extend to further epochs
                current_cluster = clusters_b[best_bi]
                for j in range(i + 2, len(sorted_epochs)):
                    epoch_c = sorted_epochs[j]
                    clusters_c = epoch_clusters_by_epoch[epoch_c]
                    next_best_ci = None
                    next_best_dist = float('inf')
                    for ci, cc in enumerate(clusters_c):
                        if (epoch_c, ci) in used:
                            continue
                        dist = haversine(current_cluster.centroid_ra,
                                         current_cluster.centroid_dec,
                                         cc.centroid_ra, cc.centroid_dec)
                        if dist <= max_displacement_arcsec and dist < next_best_dist:
                            next_best_dist = dist
                            next_best_ci = ci
                    if next_best_ci is not None:
                        tracklet.clusters.append(clusters_c[next_best_ci])
                        used.add((epoch_c, next_best_ci))
                        current_cluster = clusters_c[next_best_ci]
                    else:
                        break  # cannot extend further

                tracklets.append(tracklet)

    # Unlinked clusters (single-epoch) → isolated candidates for manual review
    for epoch in sorted_epochs:
        for ci, c in enumerate(epoch_clusters_by_epoch[epoch]):
            if (epoch, ci) not in used:
                tracklets.append(Tracklet(clusters=[c]))

    return tracklets
```

### 5.6 Motion Vector Computation

```python
def compute_motion_vector(tracklet):
    """
    Compute motion magnitude (arcsec/epoch) and position angle (degrees).
    Uses the first and last epoch clusters in the tracklet.
    """
    if len(tracklet.clusters) < 2:
        return None, None

    first = tracklet.clusters[0]
    last  = tracklet.clusters[-1]
    n_epoch_gaps = last.epoch - first.epoch

    total_displacement = haversine(
        first.centroid_ra, first.centroid_dec,
        last.centroid_ra,  last.centroid_dec
    )
    motion_arcsec_per_epoch = total_displacement / n_epoch_gaps

    # Position angle: North=0, East=90
    d_ra  = (last.centroid_ra - first.centroid_ra) * cos(radians(
             (first.centroid_dec + last.centroid_dec) / 2.0)) * 3600.0
    d_dec = (last.centroid_dec - first.centroid_dec) * 3600.0

    pa_deg = degrees(atan2(d_ra, d_dec)) % 360.0

    return motion_arcsec_per_epoch, pa_deg
```

### 5.7 Full Consensus Orchestrator

```python
def run_consensus(subject_id, epsilon_arcsec=9.2, min_pts=3,
                  max_displacement_arcsec=30.0):
    """
    Full consensus pipeline for one retired subject.
    """
    subject = db.get_subject(subject_id)
    assert subject.retired, "Subject must be retired before consensus"

    # 1. Per-epoch clustering
    epoch_clusters_by_epoch = {}
    for epoch in subject.epochs:
        clusters = cluster_epoch(subject_id, epoch, epsilon_arcsec, min_pts)
        if clusters:
            epoch_clusters_by_epoch[epoch] = clusters

    if not epoch_clusters_by_epoch:
        return []  # No consensus clusters found

    # 2. Category consensus: majority vote across all classifications
    category_votes = db.query("""
        SELECT category, count(*) as cnt
        FROM classifications
        WHERE subject_id = :sid AND load_time_ms >= 3000
        GROUP BY category
        ORDER BY cnt DESC
    """, sid=subject_id)
    consensus_category = category_votes[0].category

    # 3. Tracklet linking
    tracklets = link_tracklets(epoch_clusters_by_epoch,
                               max_displacement_arcsec)

    # 4. Create candidate records
    candidates_created = []
    for tracklet in tracklets:
        motion, pa = compute_motion_vector(tracklet)

        # Aggregate statistics
        total_marks = sum(c.cluster_size for c in tracklet.clusters)
        mean_reliability = (sum(c.mean_reliability * c.cluster_size
                                for c in tracklet.clusters) / total_marks)
        mean_dispersion = (sum(c.dispersion_arcsec for c in tracklet.clusters)
                           / len(tracklet.clusters))

        candidate = db.insert_candidate(
            subject_id=subject_id,
            category=consensus_category,
            status='new',
            n_classifications=total_marks,
            mean_reliability=mean_reliability,
            cluster_dispersion_arcsec=mean_dispersion,
            motion_arcsec_per_epoch=motion,
            motion_pa_deg=pa
        )

        for cluster in tracklet.clusters:
            db.insert_candidate_epoch(
                candidate_id=candidate.id,
                epoch=cluster.epoch,
                centroid_ra_deg=cluster.centroid_ra,
                centroid_dec_deg=cluster.centroid_dec,
                centroid_position=spoint(cluster.centroid_ra,
                                         cluster.centroid_dec),
                cluster_size=cluster.cluster_size,
                dispersion_arcsec=cluster.dispersion_arcsec
            )

        candidates_created.append(candidate)

    return candidates_created
```

---

## 6. Caching Design

**Owner:** Role 5 (DevOps), Role 2 (Backend).

### 6.1 Cache Layers

| Layer | What | Key pattern | TTL | Invalidation |
|-------|------|-------------|-----|-------------|
| **CDN / Nginx** | Tile images (PNG/WebP) and WCS JSON sidecars | URL path | 24 hours (`Cache-Control: public, max-age=86400`) | Tiles are immutable once written. New ingestion creates new subject IDs. No purge needed. |
| **Redis: Subject queue** | Pre-fetched list of next subject IDs per user (avoids repeated DB queries) | `astroblink:subject_queue:{user_id}` | Refilled when list drops below 5 items | On subject retirement, publish `subject:retired:{id}` to Redis Pub/Sub; client-side queue filters out retired IDs. |
| **Redis: Leaderboard** | Classification counts by user | `astroblink:leaderboard:alltime` / `astroblink:leaderboard:weekly:{isoweek}` | alltime: permanent; weekly: expire after 2 weeks | ZINCRBY on each classification; no explicit invalidation. |
| **API response cache** | `GET /api/v1/candidates` results (filtered lists) | `astroblink:cache:candidates:{hash(query_params)}` | 60 seconds | Invalidated (DEL) when any candidate is created or status-updated. |

### 6.2 Cache Strategy for Subject Assignment

To achieve < 200 ms P95 for `GET /api/v1/subjects/next` (NFR-1):

```
GET /api/v1/subjects/next:
    1. LPOP astroblink:subject_queue:{user_id}
    2. If result:
         a. Verify subject is not retired (SELECT retired FROM subjects WHERE id = ?)
         b. If retired, discard and goto 1
         c. Verify user has not already classified it (unique constraint check)
         d. Return subject
    3. If queue empty:
         a. Query DB for 20 unretired subjects the user hasn't classified,
            with ~5% gold-standard mix:
              - 1 gold-standard subject (if available)
              - 19 regular subjects
            Ordered by classification_count ASC (prioritize under-classified)
         b. RPUSH all 20 IDs to astroblink:subject_queue:{user_id}
         c. Goto 1
```

---

## 7. Rate-Limiting Design

**Owner:** Role 5 (DevOps).

### 7.1 Algorithm: Sliding Window Log

Uses Redis sorted sets where the score is the request timestamp (epoch milliseconds) and the member is a unique request ID.

```python
def check_rate_limit(key: str, max_requests: int, window_seconds: int) -> bool:
    """
    Returns True if the request is allowed, False if rate-limited.
    """
    now_ms = current_time_ms()
    window_start_ms = now_ms - (window_seconds * 1000)

    pipe = redis.pipeline()
    # Remove entries outside the window
    pipe.zremrangebyscore(key, 0, window_start_ms)
    # Count entries in the window
    pipe.zcard(key)
    # Add the current request
    pipe.zadd(key, {str(uuid4()): now_ms})
    # Set TTL to prevent stale keys from accumulating
    pipe.expire(key, window_seconds + 10)
    results = pipe.execute()

    current_count = results[1]
    return current_count < max_requests
```

### 7.2 Rate-Limit Rules

| Endpoint pattern | Scope | Limit | Window | Key |
|------------------|-------|-------|--------|-----|
| `POST /api/v1/classify` | Per user | 60 | 1 hour | `astroblink:ratelimit:classify:{user_id}` |
| `POST /api/v1/cutouts/fetch` | Per user | 10 | 1 hour | `astroblink:ratelimit:ingest:{user_id}` |
| All unauthenticated endpoints | Per IP | 120 | 1 minute | `astroblink:ratelimit:anon:{ip}` |
| `POST /api/v1/consensus/run` | Per user | 5 | 1 hour | `astroblink:ratelimit:consensus:{user_id}` |

### 7.3 Response on Rate Limit

```
HTTP/1.1 429 Too Many Requests
Retry-After: 42
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1696972800

{
    "error": {
        "code": "RATE_LIMITED",
        "message": "Rate limit exceeded. Try again in 42 seconds.",
        "details": []
    }
}
```

---

## 8. Security Design

**Owner:** Role 5 (DevOps), Role 2 (Backend), Role 6 (Team Lead).

### 8.1 Authentication Flow

```
┌──────────┐                ┌──────────┐              ┌──────────┐
│  Client   │                │  FastAPI  │              │  OAuth    │
│  (Next.js)│                │  Backend  │              │  Provider │
│           │                │           │              │ (Google/  │
│           │                │           │              │  GitHub)  │
└─────┬─────┘                └─────┬─────┘              └─────┬─────┘
      │  1. Click "Sign in"        │                          │
      │───────────────────────────▶│                          │
      │  2. Redirect to provider   │                          │
      │◀───────────────────────────│                          │
      │  3. User authenticates     │                          │
      │────────────────────────────┼─────────────────────────▶│
      │  4. Provider redirects     │                          │
      │    with auth code          │                          │
      │───────────────────────────▶│                          │
      │                            │  5. Exchange code for    │
      │                            │     tokens               │
      │                            │─────────────────────────▶│
      │                            │  6. Receive id_token     │
      │                            │◀─────────────────────────│
      │                            │  7. Upsert user in DB    │
      │                            │  8. Issue JWT access     │
      │                            │     + refresh tokens     │
      │  9. Return tokens          │                          │
      │◀───────────────────────────│                          │
      │                            │                          │
```

### 8.2 JWT Structure

**Access Token** (15-minute TTL):

```json
{
    "sub": "user-uuid",
    "role": "volunteer",
    "display_name": "Maya S.",
    "iat": 1696969200,
    "exp": 1696970100,
    "iss": "astroblink"
}
```

**Refresh Token** (7-day TTL): Opaque UUID stored in Redis at `astroblink:session:{token_uuid}` with the associated user ID. Rotated on each refresh (one-time use).

### 8.3 Authorization Matrix

| Endpoint | `volunteer` | `astronomer` | `admin` |
|----------|:-----------:|:------------:|:-------:|
| `GET /api/v1/subjects/next` | ✅ | ✅ | ✅ |
| `POST /api/v1/classify` | ✅ | ✅ | ✅ |
| `GET /api/v1/candidates` | ❌ | ✅ | ✅ |
| `POST /api/v1/consensus/run` | ❌ | ✅ | ✅ |
| `GET /api/v1/candidates/export` | ❌ | ✅ | ✅ |
| `PATCH /api/v1/candidates/{id}` | ❌ | ✅ | ✅ |
| `POST /api/v1/cutouts/fetch` | ❌ | ❌ | ✅ |
| `GET /api/v1/health` | 🌐 (public) | 🌐 | 🌐 |

### 8.4 Input Validation Rules

All validation is enforced server-side via Pydantic models. The client also validates for UX, but server validation is authoritative.

| Field | Rule | Error |
|-------|------|-------|
| `ra` | `0.0 ≤ ra < 360.0` | 422: "RA must be in [0, 360)." |
| `dec` | `-90.0 ≤ dec ≤ 90.0` | 422: "Dec must be in [-90, +90]." |
| `marks[].epoch` | Must be in `subject.epochs` | 422: "Epoch {n} not available for this subject." |
| `marks[].pixel_x` | `0 ≤ pixel_x < NAXIS1` (from WCS JSON) | 422: "pixel_x out of tile bounds." |
| `marks[].pixel_y` | `0 ≤ pixel_y < NAXIS2` (from WCS JSON) | 422: "pixel_y out of tile bounds." |
| `category` | Must be a valid `classification_category` enum value | 422: "Invalid category." |
| `marks` array | If category ≠ `nothing`, must contain ≥ 1 mark | 422: "Marks required for non-nothing classification." |
| `marks` array | If category = `nothing`, must be empty `[]` | 422: "Marks must be empty for 'nothing' category." |
| `size_deg` | `0.0 < size_deg ≤ 1.0` | 422: "size_deg must be in (0, 1.0]." |

### 8.5 Anti-Spam Heuristics

| Heuristic | Threshold | Action |
|-----------|-----------|--------|
| Rapid submission | `load_time_ms < 3000` | Classification stored but flagged `suspicious`; excluded from consensus. |
| Gold-standard failure rate | > 50% failures in last 20 gold encounters | User reliability floored to 0.05. |
| Rate limit breach | > 60 classifications/hour | 429 response; no classification recorded. |
| Account age | < 1 minute | CAPTCHA challenge on next classification. |

### 8.6 Data Integrity

- **Append-only classifications:** No `UPDATE` or `DELETE` on `classifications` or `marks` for users with role `volunteer`. Corrections require admin intervention.
- **Audit log:** `candidate_reviews` table records every status change with the reviewer's ID, old status, new status, rationale, and timestamp.
- **Database backups:** Automated daily `pg_dump` to object store with 7-day retention.

### 8.7 Transport Security

- All traffic over **TLS 1.2+** (terminated at Nginx or cloud load balancer).
- **HSTS** header: `Strict-Transport-Security: max-age=31536000; includeSubDomains`.
- **CORS:** Allow origin `https://astroblink.app` (and `http://localhost:3000` in dev). Credentials: true.
- **CSP:** `default-src 'self'; img-src 'self' blob: data:; connect-src 'self' https://accounts.google.com https://github.com/login/oauth`.

---

## 9. Open Questions

| ID | Question | Origin | Impact |
|----|----------|--------|--------|
| OQ-1 | Exact IRSA SPHEREx Cutout Service API query-string parameters (endpoint URL, parameter names for position, size, band/detector selection). | `[VERIFY]` prompt §4.C | Ingestion worker HTTP client; FR-1.1. |
| OQ-2 | FLAGS bitmask bits 3–5, 8, 10–24 — meanings undocumented. Currently masked conservatively (any set bit → mask). | `[VERIFY]` prompt §4.B | May over-mask valid pixels, reducing coverage. Revisit when IRSA publishes full bitmask spec. |
| OQ-3 | S3 key layout for future DR1/DR2 releases — only `qr2/` and `qr3/` prefixes documented. | `[VERIFY]` prompt §4.C | Ingestion worker S3 key enumeration. |
| OQ-4 | Exact IRSA Cutout Service base URL. Using placeholder `https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts`. | `[VERIFY]` inferred | `.env` configuration; FR-1.1. |
| OQ-5 | Optimal width of RGB sub-band wavelength windows (currently ±0.1 µm around B≈1.0, G≈2.0, R≈4.0 µm). | Design decision | False-color tile quality; needs empirical tuning. |
| OQ-6 | Exact epoch date boundaries — currently using approximate 6-month windows. | `[VERIFY]` mission ops | Epoch grouping correctness. |
| OQ-7 | Whether IRSA Cutout Service preserves all 6 MEF HDUs (especially VARIANCE and WCS-WAVE) in returned cutouts. | `[VERIFY]` — reference says "preserving all six HDUs" but needs runtime test | If missing, must fall back to full-frame S3 download. |
| OQ-8 | pgSphere `spoint` distance operator precision at sub-arcsecond scales for DBSCAN — is the GiST index precise enough for 9.2″ neighborhoods? | Implementation detail | May need to fall back to Python-side haversine if GiST index introduces rounding beyond acceptable tolerance. Likely fine (pgSphere uses `float8` radians). |
| OQ-9 | VOTable `xmlns` version string — IVOA VOTable 1.4 schema uses `xmlns="http://www.ivoa.net/xml/VOTable/v1.3"` (the xmlns did not change from 1.3 to 1.4 in the spec). Confirm this is correct for validator compliance. | Spec ambiguity | VOTable export validation. |
