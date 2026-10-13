# AstroBlink — Decisions Log (Architecture Decision Records)

**Purpose:** Comprehensive log of architectural and technical decisions made during AstroBlink development, documenting context, rationale, rejected alternatives, approvals, and current status.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Decisions Register Summary

| ADR # | Decision Title | Decision Date | Current Status | Governance Approval Required |
| :-: | :--- | :---: | :---: | :---: |
| **ADR-01** | Flat Monorepo Layout with Strict Build Isolation | 2026-10-10 | **ACCEPTED** | Approved by Role 6 |
| **ADR-02** | Git Worktrees & Independent Docker Compose Stacks | 2026-10-11 | **ACCEPTED** | Approved by Role 5 & 6 |
| **ADR-03** | pgSphere Chosen Over PostGIS | 2026-10-10 | **ACCEPTED** | Approved by Role 2 |
| **ADR-04** | Direct PostgreSQL Insertion by Ingestion Worker | 2026-10-11 | **ACCEPTED** | Approved by Role 1 & 2 |
| **ADR-05** | MinIO Local Object Storage with Host-Reachable URLs | 2026-10-10 | **ACCEPTED** | Approved by Role 5 |
| **ADR-06** | boto3 S3 Ranged Reads Over Full Downloads & Cutout API | 2026-10-11 | **ACCEPTED** | Approved by Role 1 |
| **ADR-07** | Wavelength-Matched Narrow Slices Over Broad Co-Adds | 2026-10-12 | **ACCEPTED** | Approved by Role 1 |
| **ADR-08** | Per-Detector Wavelength Tolerance $\text{tol} = k \cdot (\lambda/R)$ | 2026-10-12 | **ACCEPTED** | Approved by Role 1 |
| **ADR-09** | Data-Driven Survey Epoch Clustering (30d Gap / 182.5d CVZ) | 2026-10-12 | **PENDING TEAM APPROVAL** | Role 6 / Science Lead Review |
| **ADR-10** | 0.5° Cutout Geometry to Contain Earth-Orbit Parallax | 2026-10-12 | **ACCEPTED** | Approved by Role 1 & 6 |
| **ADR-11** | Omission of Intra-Epoch Blinking Mode for MVP | 2026-10-12 | **PENDING TEAM APPROVAL** | Role 6 / Science Lead Review |
| **ADR-12** | Masking FLAGS Bits 0 and 19 by Default (Hypothesis Disproven) | 2026-10-11 | **ACCEPTED** | Approved by Role 1 |
| **ADR-13** | Consensus Parameters: $\varepsilon = 1.5\text{ px} \times 6.15"$, Haversine Metric | 2026-10-12 | **ACCEPTED** | Approved by Role 2 |
| **ADR-14** | HTTP 404 Response for Unretired Subjects on Consensus Run | 2026-10-12 | **ACCEPTED** | Approved by Role 2 & 6 |
| **ADR-15** | Constant-Time Static Admin Bearer Token Auth | 2026-10-12 | **ACCEPTED** | Approved by Role 2 |
| **ADR-16** | Raw Parameterized SQL Over SQLAlchemy ORM for pgSphere | 2026-10-11 | **ACCEPTED** | Approved by Role 2 |

---

## 2. Detailed Architecture Decision Records (ADRs)

### ADR-01: Flat Monorepo Layout with Strict Build Isolation [VERIFIED]
- **Context:** AstroBlink comprises backend API, ingestion worker, web client, deployment scripts, and OpenAPI contracts.
- **Decision:** Adopt a flat root layout (`api/`, `worker/`, `client/`, `infra/`, `contracts/`, `docs/`). Enforce strict build isolation: each application Dockerfile builds using only its own subdirectory as Docker context.
- **Alternatives Rejected:**
  - Nested `src/` hierarchy: Added boilerplate path traversal.
  - Shared Python library package: Created build coupling across worker and API containers.
- **Status:** **ACCEPTED** (Role 6 approved).

---

### ADR-02: Git Worktrees & Independent Docker Compose Stacks [VERIFIED]
- **Context:** Multiple engineers (or AI subagents) developing API and worker simultaneously on the same machine without code or container conflicts.
- **Decision:** Use Git worktrees (`D:\GITHUB\ME\astroblink-worker` on `feat/worker-ingestion` and `D:\GITHUB\ME\astroblink-api` on `feat/api-consensus`) with independent Docker Compose projects (`ab-worker`, `ab-api`) and port offsets (5433/6380/8001/9100 vs 5434/6381/8002/9200).
- **Alternatives Rejected:**
  - Branch switching in a single directory: Destroyed running container state and volume caches on every switch.
- **Status:** **ACCEPTED** (Role 5 & 6 approved).

---

### ADR-03: pgSphere Chosen Over PostGIS [VERIFIED]
- **Context:** AstroBlink requires spherical indexing and distance queries on astronomical coordinates $(RA, Dec)$.
- **Decision:** Build a custom PostgreSQL 16 Alpine container with the `pg_sphere` C extension.
- **Alternatives Rejected:**
  - PostGIS (`geography` type): Heavy image size (>600 MB vs <200 MB), geospatial planar assumptions, complex projection conversions for celestial poles.
- **Status:** **ACCEPTED** (Role 2 approved).

---

### ADR-04: Direct PostgreSQL Insertion by Ingestion Worker [VERIFIED]
- **Context:** Ingestion worker processes tiles and needs to persist subject records.
- **Decision:** Worker connects directly to PostgreSQL via psycopg2 and executes `INSERT INTO subjects` with 1-arcsecond pgSphere deduplication.
- **Alternatives Rejected:**
  - Internal API REST POST endpoint: Created runtime container dependency on API readiness, added HTTP serialization latency for binary tile URLs, and doubled network hops.
- **Status:** **ACCEPTED** (Role 1 & 2 approved).

---

### ADR-05: MinIO Local Object Storage with Host-Reachable URLs [VERIFIED]
- **Context:** Client browser needs to render high-resolution astronomical tiles.
- **Decision:** Run MinIO S3-compatible object storage locally. Store relative object keys in DB (`{subject_id}/{epoch}_{band}.webp`), but prepend host-reachable `TILE_BASE_URL` (`http://localhost:9000/astroblink-tiles`) when serving subjects to the client.
- **Alternatives Rejected:**
  - Storing images in PostgreSQL BLOB / BYTEA: Excessive database bloat and slow concurrent tile delivery.
  - Base64 encoding in JSON API: 33% bandwidth overhead and eliminates browser image caching.
- **Status:** **ACCEPTED** (Role 5 approved).

---

### ADR-06: boto3 S3 Ranged Reads Over Full Downloads & IRSA Cutout API [VERIFIED]
- **Context:** Ingestion worker must obtain small cutouts from SPHEREx Level 2 FITS files in `s3://nasa-irsa-spherex`.
- **Decision:** Use boto3 `UNSIGNED` HTTP Range requests to stream only required row strips and FITS header blocks.
- **Alternatives Rejected:**
  - IRSA SPHEREx Cutout Service: Service returned `502 Bad Gateway` and `503 Service Unavailable` during live testing [VERIFIED: `docs/VERIFIED_FACTS.md` §1].
  - Full 68 MiB FITS file downloads: Required downloading ~570 MB across 8 exposures per subject; ranged reads transfer only ~60 MB (<11% bandwidth) and finish in 90–135 seconds.
- **Status:** **ACCEPTED** (Role 1 approved).

---

### ADR-07: Wavelength-Matched Narrow Slices Over Broad Co-Adds [VERIFIED]
- **Context:** SPHEREx detectors use Linear Variable Filters (LVF) where transmission wavelength varies continuously across the detector surface.
- **Decision:** Extract narrow slices centered at 1.0 µm, 2.0 µm, 4.0 µm and apply a per-pixel shared-wavelength intersection mask across epochs.
- **Alternatives Rejected:**
  - Broad SWIR (0.75–2.42 µm) and MWIR (3.8–5.0 µm) co-adds: Caused stationary stars observed at different roll angles to change apparent brightness due to steep spectral continuum slopes, generating false-positive moving object detections.
- **Status:** **ACCEPTED** (Role 1 approved).

---

### ADR-08: Per-Detector Wavelength Tolerance $\text{tol} = k \cdot (\lambda/R)$ [VERIFIED]
- **Context:** Determining how close an exposure's central wavelength must be to the target wavelength across survey sweeps.
- **Decision:** Set tolerance dynamically using the detector's resolving power $R$ from TAP:
  $$\text{tol} = k \cdot \frac{\lambda_{\text{target}}}{R} \quad (k = 1.0, R \approx 40)$$
- **Alternatives Rejected:**
  - Static universal tolerance (e.g. $\pm 0.05\text{ }\mu\text{m}$): Too broad at 1.0 µm (introducing spectral leakage) and too narrow at 4.0 µm (rejecting valid matching exposures).
- **Status:** **ACCEPTED** (Role 1 approved).

---

### ADR-09: Data-Driven Survey Epoch Clustering (30d Gap / 182.5d CVZ) [VERIFIED]
- **Context:** Level 2 FITS files do not contain an explicit "Epoch" header keyword; observations must be grouped into 6-month survey sweeps from timestamp `mjd`.
- **Decision:** Sort exposures by MJD; split when time gap $> 30.0\text{ days}$. In Continuous Viewing Zones (polar orbits with no 30-day gap), split when elapsed span in the current cluster exceeds $182.5\text{ days}$.
- **Status:** **PENDING TEAM APPROVAL** (Needs formal verification against published DR1 survey coverage).

---

### ADR-10: 0.5° Cutout Geometry to Contain Earth-Orbit Parallax [VERIFIED]
- **Context:** Initial design used $0.1^\circ \times 0.1^\circ$ cutouts ($360" \times 360"$, half-width $180"$).
- **Decision:** Expand primary cutout size to $0.5^\circ \times 0.5^\circ$ ($1800" \times 1800"$, half-width $900"$, $293 \times 293\text{ pixels}$ at $6.15"/px$).
- **Alternatives Rejected:**
  - $0.1^\circ$ Cutout: Failed completely for moving object science. Over 6 months at quadrature, Earth moves 2 AU perpendicular to the line of sight, creating parallax $\Delta\theta_{\text{par}} \approx 399"/d_{1000\text{AU}}$. Even at 1000 AU, objects shift $388"\text{ to }408"$, exiting a $0.1^\circ$ tile entirely. At $0.5^\circ$, objects at 500–1000 AU stay contained.
- **Status:** **ACCEPTED** (Role 1 & 6 approved).

---

### ADR-11: Omission of Intra-Epoch Blinking Mode for MVP [VERIFIED]
- **Context:** Original roadmap contemplated both inter-epoch (6-month) and intra-epoch (~1–5 day) blinking modes.
- **Decision:** Omit intra-epoch mode for the Phase 1 MVP; focus solely on inter-epoch blinking for distant outer Solar System objects (500–1000 AU) and cold brown dwarfs.
- **Alternatives Rejected:**
  - Attempting intra-epoch mode: Rapid orbital sweep speed meant exposures separated by 1–5 days rarely overlapped in sky footprint and detector wavelength, causing high rejection rates.
- **Status:** **PENDING TEAM APPROVAL** (Needs Role 6 sign-off for Phase 2 roadmap).

---

### ADR-12: Masking FLAGS Bits 0 and 19 by Default [VERIFIED]
- **Context:** Project research questioned whether `FLAGS` Bit 0 (`MP_TRANSIENT`) or Bit 19 (`MP_OUTLIER`) selectively marked moving objects.
- **Decision:** Mask both bits as defects by default (`mask_transient_and_outlier_flags = True`).
- **Alternatives Rejected:**
  - Leaving Bits 0/19 unmasked: Real data verification proved Bit 0 flags cosmic ray hits during 112.5s ramp integrations, and Bit 19 flags sharp PSF gradients around stationary bright stars. Leaving them unmasked generated spurious blinking artifacts [VERIFIED: `docs/VERIFIED_FACTS.md` §4].
- **Status:** **ACCEPTED** (Role 1 approved).

---

### ADR-13: Consensus Parameters: $\varepsilon = 1.5\text{ px} \times 6.15"$, Haversine Metric [VERIFIED]
- **Context:** Aggregating volunteer clicks into consensus spatial clusters.
- **Decision:** Set DBSCAN clustering radius to $\varepsilon = 1.5\text{ pixels} \times 6.15"/px = 9.225\text{ arcseconds}$ using Great-Circle Haversine distance, weighting mark coordinates by volunteer historical reliability.
- **Alternatives Rejected:**
  - Planar Euclidean distance: Distorted near celestial poles and across $RA = 0^\circ / 360^\circ$ boundary.
  - Fixed pixel-independent arcsecond radius: Did not scale with native detector resolution.
- **Status:** **ACCEPTED** (Role 2 approved).

---

### ADR-14: HTTP 404 Response for Unretired Subjects on Consensus Run [VERIFIED]
- **Context:** Determining API response when consensus is requested on a subject that has not reached 10 classifications.
- **Decision:** Return `HTTP 404 Not Found` with `{"code": "NOT_FOUND", "message": "Subject ... is not retired"}`.
- **Alternatives Rejected:**
  - Returning `HTTP 400 Bad Request` or `HTTP 422 Unprocessable Entity`: The OpenAPI specification and architecture contract explicitly defined `404` for unretired subjects to treat them as "not available for candidate generation" [VERIFIED: `contracts/openapi.yaml` L171].
- **Status:** **ACCEPTED** (Role 2 & 6 approved).

---

### ADR-15: Constant-Time Static Admin Bearer Token Auth [VERIFIED]
- **Context:** Securing sensitive endpoints (`consensus/run` and `candidates/export`).
- **Decision:** Use Bearer token verification matching `ADMIN_TOKEN` via `hmac.compare_digest`.
- **Alternatives Rejected:**
  - Full OAuth2 JWT with volunteer/astronomer roles: Excessive implementation overhead for Phase 1 backend MVP.
  - Standard string comparison `token == expected`: Vulnerable to side-channel timing attacks.
- **Status:** **ACCEPTED** (Role 2 approved).

---

### ADR-16: Raw Parameterized SQL Over SQLAlchemy ORM for pgSphere [VERIFIED]
- **Context:** Executing spatial queries on pgSphere `spoint` columns (`subjects.position`, `marks.position`).
- **Decision:** Use raw parameterized SQL via `sqlalchemy.text(...)` across all API routers; maintain `api/app/models/tables.py` as a non-executable stub.
- **Alternatives Rejected:**
  - Defining full SQLAlchemy declarative models with custom GeoAlchemy types: Required building custom compiler extensions for `spoint` and `<->` operators in asyncpg, which had high complexity and risk of runtime dialect errors.
- **Status:** **ACCEPTED** (Role 2 approved).
