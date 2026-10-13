# AstroBlink — Plan vs. Reality

**Purpose:** Comprehensive gap analysis comparing the original system design documents (`docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/ROADMAP.md`) against the code as actually implemented, documenting intentional architectural deviations and their justifications.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Requirements Gap Matrix

| Requirement ID | Original Planned Feature | What Was Actually Built | Verification Evidence | Status / Gap |
| :--- | :--- | :--- | :--- | :---: |
| **FR-1.1** (Data Access) | Retrieve FITS via IRSA Cutout Service or S3 download. | S3 ranged byte-slice reads via boto3 (`UNSIGNED`). IRSA Cutout Service bypassed. | `worker/worker/sources/s3.py`, `docs/VERIFIED_FACTS.md` §1, §2 | **DONE (Optimized)**: Ranged reads avoid 502/503 HTTP gateway timeouts. |
| **FR-1.2** (Spectral Binning) | Broad SWIR (0.75–2.42 µm), MWIR (3.8–5.0 µm), RGB. | Narrow slices centered at 1.0, 2.0, 4.0 µm + 3-channel RGB. | `worker/worker/processing/binning.py`, `worker/worker/main.py` L350-425 | **DONE (Deviated)**: Narrow slices prevent Linear Variable Filter (LVF) false-blinking. |
| **FR-1.3** (Reprojection) | Tangent-plane reprojection common grid, inverse variance co-add. | Tangent-plane reprojection on native 6.15"/px grid ($293 \times 293\text{ px}$). | `worker/worker/processing/reproject.py` | **DONE**: Implemented via Astropy TAN projection and `reproject_interp`. |
| **FR-1.4** (FLAGS Masking) | Mask non-zero FLAGS bits; investigate Bits 0 and 19 for movers. | Bits 0, 1, 2, 4–7, 9–11, 14, 15, 17, 19 masked by default. | `worker/worker/processing/masking.py`, `docs/VERIFIED_FACTS.md` §4 | **DONE (Deviated)**: Moving-object hypothesis for Bits 0/19 disproven; masked as defects. |
| **FR-1.5** (Airglow Mask) | Mask He I airglow (1.075–1.091 µm). | Masked during spectral processing. | `worker/worker/processing/masking.py` L62-67 | **DONE**: Fully implemented. |
| **FR-1.6** (Mask Indicator)| Distinct semi-transparent hatching in rendered tile. | Red diagonal hatching overlay generated via PIL. | `worker/worker/render/tiles.py` L80-120 | **DONE**: Hatched pixels visible in output WebP tiles. |
| **FR-1.7** (Tile & WCS) | Output WebP/PNG < 250 KB with JSON WCS sidecar. | WebP tiles (~20–30 KB) with WCS JSON sidecars. | `worker/worker/render/tiles.py`, `worker/worker/render/wcs_sidecar.py` | **DONE**: Strictly enforced (< 250 KB assert). |
| **FR-1.8** (Cutout Size) | Cutout size $0.1^\circ \times 0.1^\circ$ ($64 \times 64$ to $128 \times 128\text{ px}$). | Cutout size expanded to $0.5^\circ \times 0.5^\circ$ ($293 \times 293\text{ px}$). | `worker/worker/config.py` L71, `docs/VERIFIED_FACTS.md` §7, §8 | **DONE (Deviated)**: Expanded to contain 6-month Earth-orbit parallax shifts. |
| **FR-1.9** (Subject DB) | Store subjects with position, epochs, tile URLs, retired flag. | Inserted into PostgreSQL using pgSphere `spoint` with 1″ dedup. | `worker/worker/db.py` L110-138 | **DONE**: Full schema matching Alembic 001. |
| **FR-2.1** (Blink Comparator)| Animate across epochs at 0.5–2 Hz with pan/zoom. | Basic Canvas cycling epochs; no pan/zoom or OpenSeadragon. | `client/src/components/BlinkCanvas.tsx` | **PARTIAL**: Basic animation works; interactive controls missing. |
| **FR-2.2** (Band Switcher)| Toggle SWIR, MWIR, RGB preserving pan/zoom. | Hardcodes `swir`, `mwir`, `rgb` buttons; incompatible with narrow slices. | `client/src/components/BandSelector.tsx` | **GAP / BUG**: Needs update to `1.0um`, `2.0um`, `4.0um`, `rgb`. |
| **FR-2.3** (Mark Placement)| Click on canvas → convert (x, y) to (RA, Dec) via WCS sidecar. | Hardcoded linear formula dividing by 128px; ignores WCS sidecar. | `client/src/app/classify/page.tsx` L91-96 | **GAP / BUG**: Must implement client-side WCS TAN deprojection. |
| **FR-2.4** (Categorization)| Dropdown for 6 categories; submit to API. | Dropdown present; submits classification to `/api/v1/classify`. | `client/src/app/classify/page.tsx` L188-202 | **DONE**: Persists in DB. |
| **FR-2.5** (WCS Readout) | Live (RA, Dec) cursor coordinate readout bar. | Not implemented in current client UI. | `client/src/app/classify/page.tsx` | **MISSING**: Pending frontend rewrite. |
| **FR-3.1** (DBSCAN Consensus)| Per-epoch clustering, reliability weighting, tracklet linking. | Pure consensus engine implemented with spherical Haversine metric. | `api/app/services/consensus.py` | **DONE**: 9 unit tests passing. |
| **FR-3.2** (Retirement) | Automatic retirement after 10 classifications. | Implemented in `/api/v1/classify` via `retirement_threshold=10`. | `api/app/routers/classify.py` L175-180 | **DONE**: Sets `retired=true`. |
| **FR-4.1** (Candidate Export)| Export CSV and IVOA-compliant VOTable. | Both formats implemented with multi-epoch centroids and UCDs. | `api/app/services/export.py` | **DONE**: Validated via unit tests. |
| **FR-5.1** (Onboarding) | Step-by-step interactive tutorial modal with examples. | Static placeholder page `/tutorial`. | `client/src/app/tutorial/page.tsx` | **STUB**: Needs interactive component. |
| **FR-5.2** (Gamification) | Badges, streak counter, volunteer leaderboard. | DB tables created; UI shows only static badges. | `api/alembic/versions/001_initial_schema.py`, `client/src/components/ConsensusBadge.tsx` | **PARTIAL**: Backend tables exist; UI logic missing. |
| **FR-5.3** (Discovery Feed)| Feed displaying confirmed candidates. | Static placeholder page `/discoveries`. | `client/src/app/discoveries/page.tsx` | **STUB**: Needs API integration. |
| **API Endpoints** | All endpoints defined in `contracts/openapi.yaml`. | Implemented: `health`, `subjects/next`, `classify`, `consensus/run`, `candidates`, `candidates/export`. Stubbed: `cutouts/fetch`, `candidates/{id}`. | `api/app/routers/` | **PARTIAL**: 6 of 8 functional. |
| **Authentication** | OAuth2 JWT with volunteer/astronomer roles. | Static constant-time Bearer token `ADMIN_TOKEN`. | `api/app/auth.py` | **DONE (Deviated)**: Simplified for Phase 1 MVP. |

---

## 2. Intentional Architectural Deviations (Decided on Purpose)

The following design changes were intentionally adopted during development to resolve physical astronomical constraints and infrastructure bottlenecks [VERIFIED]:

### 1. 0.5-Degree Tiles Instead of 0.1-Degree Tiles
- **Original Plan:** $0.1^\circ \times 0.1^\circ$ cutouts ($360" \times 360"$, half-width $180"$).
- **Built Reality:** $0.5^\circ \times 0.5^\circ$ cutouts ($1800" \times 1800"$, half-width $900"$, $293 \times 293\text{ pixels}$ at $6.15"/px$).
- **Reason:** Astronomical analysis proved that 6 months of Earth-orbit parallax ($\Delta\theta_{\text{par}} \approx 399"/d_{1000\text{AU}}$) shifts distant objects at $500\text{--}1000\text{ AU}$ by $388"\text{ to }835"$, causing them to completely exit a $0.1^\circ$ tile. Expanding to $0.5^\circ$ guarantees containment for deep outer Solar System objects [VERIFIED: `docs/VERIFIED_FACTS.md` §7, §8.2].

### 2. Anonymous S3 Ranged Reads Instead of Full Downloads or IRSA Cutout API
- **Original Plan:** Download full 68 MiB FITS files or call the IRSA SPHEREx Cutout API.
- **Built Reality:** HTTP byte-range GETs directly on `s3://nasa-irsa-spherex` (`us-east-1`, anonymous `UNSIGNED` mode).
- **Reason:** The IRSA Cutout API repeatedly returned `503 Service Temporarily Unavailable` / `502 Bad Gateway` during live testing. Direct S3 ranged reads stream only the specific pixel rows and WCS header blocks required (~60 MB per job vs ~570 MB for full files), reducing network transfer by >90% and completing in 90–135 seconds [VERIFIED: `docs/VERIFIED_FACTS.md` §1, §8.3].

### 3. Narrow-Slice Matched Wavelengths (1.0, 2.0, 4.0 µm) Instead of Broad Co-Adds
- **Original Plan:** Co-add all exposures into broad SWIR (0.75–2.42 µm) and MWIR (3.8–5.0 µm) bands.
- **Built Reality:** Extract narrow slices centered at 1.0 µm (Detector 1), 2.0 µm (Detector 3), and 4.0 µm (Detector 5), plus a 3-channel RGB composite, with a per-pixel shared-wavelength intersection mask.
- **Reason:** SPHEREx's Linear Variable Filter (LVF) causes wavelength to vary continuously across the detector. Blinking broad co-adds taken at different spacecraft roll angles caused stationary stars to fluctuate in apparent flux due to spectral slopes, generating false-positive moving objects. Matched narrow slices guarantee identical spectral bandpasses across epochs [VERIFIED: `worker/worker/processing/binning.py`].

### 4. Intra-Epoch Blinking Mode Omitted
- **Original Plan:** Support both inter-epoch (6-month) and intra-epoch (~1–5 day) blinking modes.
- **Built Reality:** Only inter-epoch mode (Epoch 1 vs Epoch 2) is implemented.
- **Reason:** Within a single survey epoch, SPHEREx sweeps rapidly; exposures taken 1–5 days apart rarely have overlapping footprints with matched wavelength coverage. Developing an intra-epoch matcher required complex multi-detector pairing that could not be de-risked within the sprint [VERIFIED: `docs/VERIFIED_FACTS.md` §7].

### 5. `FLAGS` Bits 0 and 19 Masked by Default
- **Original Plan:** Investigate whether Bit 0 (`MP_TRANSIENT`) or Bit 19 (`MP_OUTLIER`) selectively flag moving objects.
- **Built Reality:** Masked by default (`mask_transient_and_outlier_flags = True`).
- **Reason:** FITS header comments and empirical verification proved Bit 0 flags single-sample readout jumps (cosmic rays) and Bit 19 flags sharp PSF gradients around stationary bright stars. The claim that they track Solar System movers was disproven [VERIFIED: `docs/VERIFIED_FACTS.md` §4].

### 6. pgSphere Chosen Over PostGIS
- **Original Plan:** Evaluate spatial database extensions.
- **Built Reality:** Custom PostgreSQL 16 Alpine container compiling `pgSphere` from source.
- **Reason:** pgSphere natively implements spherical trigonometry (`spoint`, `<->` great-circle distance in radians) with an extremely small footprint and zero GIS overhead [VERIFIED: `infra/postgres/Dockerfile`].

### 7. Direct Database Writes by Worker
- **Original Plan:** Worker posts processed subjects through internal API endpoints.
- **Built Reality:** Worker connects directly to PostgreSQL via psycopg2 and inserts subject rows.
- **Reason:** Eliminates HTTP serialization overhead and container networking dependencies during heavy batch ingestion [VERIFIED: `worker/worker/db.py`].

### 8. Static Admin Bearer Token Authentication
- **Original Plan:** OAuth2 JWT with volunteer, astronomer, and admin roles.
- **Built Reality:** Static Bearer token verified using constant-time `hmac.compare_digest`.
- **Reason:** Streamlined development for Phase 1 backend MVP while securing sensitive consensus and candidate export endpoints [VERIFIED: `api/app/auth.py`].

### 9. Raw Parameterized SQL in API Routers
- **Original Plan:** SQLAlchemy declarative ORM models.
- **Built Reality:** Parameterized raw SQL queries via `text(...)` across all router handlers; ORM `tables.py` kept as a stub.
- **Reason:** pgSphere's custom `spoint` type and spherical operators are not natively supported by SQLAlchemy ORM without complex type compiler overrides [VERIFIED: `api/app/models/tables.py`].
