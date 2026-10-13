# AstroBlink — Known Issues & Risk Register

**Purpose:** Ranked catalog (CRITICAL, HIGH, MEDIUM, LOW) of verified technical issues, contract discrepancies, operational vulnerabilities, and astronomical edge cases across the AstroBlink repository.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Issue Summary Matrix

| ID | Severity | Category | File / Location | Summary | Status |
| :-: | :---: | :--- | :--- | :--- | :---: |
| **ISS-01** | **CRITICAL** | Security | `api/app/config.py` L39 | Default static `ADMIN_TOKEN` placeholder active without production refusal check. | [VERIFIED] |
| **ISS-02** | **CRITICAL** | Contract / Frontend | `client/src/components/BandSelector.tsx`, `client/src/app/classify/page.tsx` | Client hardcodes obsolete `"swir" \| "mwir" \| "rgb"` keys and 128px linear deprojection, breaking narrow-slice tiles. | [VERIFIED] |
| **ISS-03** | **HIGH** | API Bug | `api/app/routers/subjects.py` L64 | `wcs_urls` is hardcoded as empty dict `{}` in subject response, hiding sidecar URLs from clients. | [VERIFIED] |
| **ISS-04** | **HIGH** | Contract Divergence | `contracts/schemas/subject.yaml` | Tile key pattern and strict schema (`additionalProperties: false`) reject narrow slices (`1_1.0um`) and extra sidecar metadata. | [VERIFIED] |
| **ISS-05** | **HIGH** | Test / Build | `api/requirements-dev.txt` | `jsonschema` missing from manifest; `test_contract_validation.py` fails inside `api` Docker container. | [VERIFIED] |
| **ISS-06** | **HIGH** | Data Integrity | Database / Tile Store | Only Target 1 was re-ingested with the W13 coverage fix; other subjects may contain truncated pre-W13 tiles. | [VERIFIED] |
| **ISS-07** | **MEDIUM** | Test / Build Isolation | `worker/tests/test_ingest_job_schema.py` | Worker tests require mounting `/contracts`, violating strict independent build context rule in CI. | [VERIFIED] |
| **ISS-08** | **MEDIUM** | Rate Limiting / Abuse | `api/app/routers/classify.py`, `subjects.py` | Public endpoints lack IP rate-limiting, allowing classification flooding and automated subject retirement spam. | [VERIFIED] |
| **ISS-09** | **MEDIUM** | Ingestion Performance | `worker/worker/config.py` L84 | 600-second job timeout cap (`job_timeout_sec`) is exceeded on slower internet connections (<100 KB/s to AWS S3). | [VERIFIED] |
| **ISS-10** | **MEDIUM** | Scientific Science View | `worker/worker/main.py` L395-425 | RGB composite has low valid fraction (5–12%) due to 3-detector overlap; weak comparison compared to narrow slices. | [VERIFIED] |
| **ISS-11** | **LOW** | Astronomical Calibration| `worker/worker/config.py` L51-53 | Survey epoch gap (30d) and CVZ epoch span (182.5d) are unverified empirical estimates (`[VERIFY]`). | [VERIFIED] |
| **ISS-12** | **LOW** | Git Hygiene | Local Git repository | Local tags `scaffold-v0`, `scaffold-v1` and branch `feat/api-consensus` exist locally only (unpushed). | [VERIFIED] |
| **ISS-13** | **LOW** | Documentation | `docs/ARCHITECTURE.md`, `docs/PRD.md` | Legacy references to old folder names (`backend/`, `frontend/`, `docker/`) persist in documentation. | [VERIFIED] |
| **ISS-14** | **LOW** | CI Execution | `.github/workflows/ci-api.yml`, `ci-worker.yml` | Workflows run pytest on the host runner rather than inside built Docker containers, missing container-specific failures. | [VERIFIED] |

---

## 2. Detailed Issue Reports

### ISS-01: Default `ADMIN_TOKEN` Allows Unauthenticated Admin Access in Production [VERIFIED]
- **Severity:** **CRITICAL**
- **Location:** `api/app/config.py` line 39; `api/app/auth.py` lines 49–53.
- **Evidence:**
  ```python
  # api/app/config.py:39
  admin_token: str = "dev-admin-token-change-in-production"
  ```
  The API startup sequence (`api/app/main.py`) does not check whether `ENVIRONMENT == "production"` or verify that `admin_token` has been overridden. Any deployment running with default settings exposes the administrative consensus trigger (`POST /api/v1/consensus/run`) and astronomical candidate catalog export (`GET /api/v1/candidates/export`) to anyone using the public placeholder token.
- **Suggested Fix:** Add a validator in `api/app/config.py` that raises `ValueError("ADMIN_TOKEN must be changed in production")` if `admin_token == "dev-admin-token-change-in-production"` and `ENVIRONMENT == "production"`.

---

### ISS-02: Client Uses Obsolete Band Keys & Hardcoded Linear Coordinate Mapping [VERIFIED]
- **Severity:** **CRITICAL**
- **Location:**
  - `client/src/components/BandSelector.tsx` line 3: `export type Band = "swir" | "mwir" | "rgb";`
  - `client/src/app/classify/page.tsx` line 267: `const key = `${ep}_${currentBand}`;`
  - `client/src/app/classify/page.tsx` lines 91–96:
    ```typescript
    const ra = Number((((subject.ra_deg + (pixelX / 128 - 0.5) * subject.size_deg) % 360) + 360) % 360);
    const dec = Number(Math.max(-90, Math.min(90, subject.dec_deg + (0.5 - pixelY / 128) * subject.size_deg)).toFixed(6));
    ```
- **Evidence:**
  The ingestion worker produces narrow-slice tiles under keys `1_1.0um`, `1_2.0um`, `1_4.0um`, and `1_rgb` on a $293 \times 293\text{ pixel}$ grid. The client looks for `1_swir` and `1_mwir`, resulting in broken tile loads. Furthermore, pixel coordinates are deprojected using a linear division by 128, which completely corrupts volunteer mark coordinates on $293 \times 293$ tiles and ignores WCS tangent-plane distortion.
- **Suggested Fix:**
  1. Update `BandSelector.tsx` to dynamically query available band keys from `subject.tile_urls` (e.g. `1.0um`, `2.0um`, `4.0um`, `rgb`).
  2. Implement client-side tangent plane deprojection using the `crpix`, `crval`, and `cd` matrix from the WCS JSON sidecar.

---

### ISS-03: `wcs_urls` Hardcoded as Empty Dictionary in Subject Response [VERIFIED]
- **Severity:** **HIGH**
- **Location:** `api/app/routers/subjects.py` line 64.
- **Evidence:**
  ```python
  # api/app/routers/subjects.py:63-64
  "tile_urls": tile_urls,
  "wcs_urls": {},
  ```
  The ingestion worker writes JSON WCS sidecar files to MinIO next to every tile (`{subject_id}/{tile_key}.wcs.json`). However, the `subjects` PostgreSQL table does not have a `wcs_urls` column, and `subjects.py` hardcodes `"wcs_urls": {}`. As a result, the frontend client cannot access sidecar metadata URLs.
- **Suggested Fix:**
  Add a migration adding `wcs_urls JSONB` to `subjects`, have the worker populate it during `insert_subject()`, and update `api/app/routers/subjects.py` to construct sidecar URLs identically to `tile_urls`.

---

### ISS-04: Contracts Reject Narrow-Slice Keys and Provenance Sidecar Metadata [VERIFIED]
- **Severity:** **HIGH**
- **Location:** `contracts/schemas/subject.yaml` lines 23–35.
- **Evidence:**
  The OpenAPI contract regex pattern assumes keys without floating-point periods (`^[1-4]_[a-z0-9_]+$`), rejecting keys like `1_1.0um`. Furthermore, the sidecar schema specifies `additionalProperties: false`, which rejects sidecars generated by the worker that include `tiles`, `mask_fraction`, `job_runtime_s`, and `job_bytes_transferred`.
- **Suggested Fix:** Update `contracts/schemas/subject.yaml` to allow floating-point strings (`^[1-4]_[a-z0-9_.]+$`) and set `additionalProperties: true` on sidecars.

---

### ISS-05: Missing `jsonschema` in API Container Dependencies [VERIFIED]
- **Severity:** **HIGH**
- **Location:** `api/requirements-dev.txt`.
- **Evidence:**
  Running `python -m pytest tests/` inside the `api` container failed during Phase 3 verification with:
  ```text
  ImportError while importing test module '/build/tests/test_contract_validation.py'.
  E   ModuleNotFoundError: No module named 'jsonschema'
  ```
  `jsonschema` was added to `test_contract_validation.py` in Phase C7 (commit `61209b8`), but was never added to `api/requirements-dev.txt`.
- **Suggested Fix:** Add `jsonschema>=4.20.0` to `api/requirements-dev.txt`.

---

### ISS-06: Existing Stack Subjects Carry Outdated Pre-W13 Tiles [VERIFIED]
- **Severity:** **HIGH**
- **Location:** `worker/scripts/run_w13_verify.py` lines 1–5; PostgreSQL database.
- **Evidence:**
  Phase W13 fixed a critical bounding-box clipping bug where SIP distortion terms were ignored, causing the raw pixel cutout to clip $0.5^\circ$ footprints prematurely. Only Target 1 was re-ingested with the fix. Targets 2, 3, 4, and 5 in the `ab-worker` stack carry old, pre-W13 tiles with valid fractions reduced by 15–30%.
- **Suggested Fix:** Execute a database purge and re-ingest all demo targets using `worker/scripts/run_w13_verify.py`.

---

### ISS-07: Worker Unit Tests Depend on Repository-Level `/contracts` Mount [VERIFIED]
- **Severity:** **MEDIUM**
- **Location:** `worker/tests/test_ingest_job_schema.py` lines 8–11; `worker/Dockerfile`.
- **Evidence:**
  `test_ingest_job_schema.py` attempts to load `contracts/schemas/ingest_job.yaml` from `../../contracts`. In a standalone Docker container where the build context is `./worker`, the test fails unless `./contracts:/contracts:ro` is explicitly bind-mounted via `docker-compose.override.yml`.
- **Suggested Fix:** Bundle a copy of `ingest_job.yaml` inside `worker/tests/fixtures/` or bundle contracts in the Docker image during CI.

---

### ISS-08: Unprotected Public Endpoints Lack Rate Limiting [VERIFIED]
- **Severity:** **MEDIUM**
- **Location:** `api/app/routers/classify.py`, `api/app/routers/subjects.py`.
- **Evidence:**
  `POST /api/v1/classify` and `GET /api/v1/subjects/next` have no IP-based rate limiting or captcha. An automated script can submit 10 fast classifications in <1 second to forcibly retire subjects. While `load_time_ms < 3000` marks are ignored during consensus, the subject is still marked `retired=true`, removing it from the public queue.
- **Suggested Fix:** Implement Redis sliding-window rate limiting on `/classify` (e.g. 10 requests per minute per IP).

---

### ISS-09: 600-Second Job Timeout Cap Exceeded on Slower Network Connections [VERIFIED]
- **Severity:** **MEDIUM**
- **Location:** `worker/worker/config.py` line 84; `worker/worker/main.py` lines 87–93.
- **Evidence:**
  During Phase 3 live testing on Windows, downloading 4 ranged FITS files from `s3://nasa-irsa-spherex` (`us-east-1`) at ~85 KB/s caused the worker to trigger:
  ```text
  TimeoutError: Job exceeded per-job time cap (645.70s > 600.00s)
  ```
- **Suggested Fix:** Make `JOB_TIMEOUT_SEC` configurable via `.env` and increase the default to `1200.0` seconds (20 minutes).

---

### ISS-10: 3-Band RGB Composite Has Low Valid Pixel Fraction [VERIFIED]
- **Severity:** **MEDIUM**
- **Location:** `worker/worker/main.py` lines 395–425; `docs/VERIFIED_FACTS.md` §8.2.
- **Evidence:**
  Because the RGB composite requires the intersection of all three narrow slices (1.0 µm on D1, 2.0 µm on D3, 4.0 µm on D5) across both epochs, the resulting valid pixel area is only 5.01%–12.11% of the $293 \times 293$ grid. In contrast, narrow slices preserve 14.29%–31.46% (and up to 77–90% valid pixels per exposure). The RGB view is heavily hatched.
- **Suggested Fix:** Instruct volunteers in the UI tutorial that narrow-slice views are the primary science channel and that RGB is a secondary false-color check.

---

### ISS-11: Empirical Clustering Constants Marked `[VERIFY]` [VERIFIED]
- **Severity:** **LOW**
- **Location:** `worker/worker/config.py` lines 51–53.
- **Evidence:**
  `survey_epoch_gap_days = 30.0` and `cvz_epoch_span_days = 182.5` were derived empirically from 5 test positions. As SPHEREx progresses into full operations and survey sweeps vary slightly due to orbital maneuvers, these constants may split or merge epochs improperly.
- **Suggested Fix:** Calibrate thresholds against official SPHEREx survey timeline tables once DR1 is published.

---

### ISS-12: Unpushed Git Branches and Tags [VERIFIED]
- **Severity:** **LOW**
- **Location:** Local git repository (`D:\GITHUB\ME\AstroBlink`).
- **Evidence:**
  `git ls-remote --tags origin` confirms that only `scaffold-v3` exists on GitHub. Tags `scaffold-v0` and `scaffold-v1` are local only. Branch `feat/api-consensus` is also local only (though its commits are merged into `main`).
- **Suggested Fix:** Run `git push origin scaffold-v0 scaffold-v1` and push any desired tracking branches.

---

### ISS-13: Legacy Directory References in Documentation [VERIFIED]
- **Severity:** **LOW**
- **Location:** `docs/ARCHITECTURE.md`, `docs/PRD.md`.
- **Evidence:**
  Pre-scaffold architectural diagrams and PRD text still reference `backend/`, `frontend/`, and `docker/` instead of `api/`, `client/`, and `infra/`.
- **Suggested Fix:** Execute a documentation cleanup pass replacing obsolete folder names.

---

### ISS-14: CI Workflows Run on Host Rather than Inside Built Containers [VERIFIED]
- **Severity:** **LOW**
- **Location:** `.github/workflows/ci-api.yml`, `.github/workflows/ci-worker.yml`.
- **Evidence:**
  Both CI workflows execute `pip install` and `pytest` directly on the Ubuntu runner host, and then build the Docker container without running container tests. This allowed ISS-05 (missing `jsonschema`) and ISS-07 (missing `/contracts`) to pass CI silently.
- **Suggested Fix:** Update GitHub Actions workflows to execute tests inside the built Docker image (`docker run --rm ...`).
