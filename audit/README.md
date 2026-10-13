# AstroBlink — Audit & Handoff Documentation Index

**Purpose:** Master index, executive status banner, and reading guide for the complete project audit and handoff documentation.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. Executive Status Banner

```
╔═══════════════════════════════════════════════════════════════════════════════════════╗
║                                  PROJECT STATUS BANNER                                ║
╠═══════════════════════════════════════════════════════════════════════════════════════╣
║  Core Backend & Ingestion: MERGED & VERIFIED ON MAIN (Commit cc39991)                 ║
║  Frontend Client:          SCAFFOLD STAGE ONLY (Needs rebuild to match new contracts) ║
║  Overall Progress:         Phase 1 Backend MVP Complete; Client & Integration Pending ║
╚═══════════════════════════════════════════════════════════════════════════════════════╝
```

### What Works [VERIFIED]
- **Worker Ingestion Pipeline (`worker/`):**
  - Live spatial querying via IRSA TAP (`spherex.artifact` / `spherex.plane`) [VERIFIED: `worker/worker/sources/irsa.py`].
  - S3 ranged-read streaming from anonymous bucket `s3://nasa-irsa-spherex` (`us-east-1`), bypassing 502/503 HTTP cutout failures and saving >90% bandwidth [VERIFIED: `docs/VERIFIED_FACTS.md` §2, `worker/worker/sources/s3.py`].
  - FITS header parsing reading blocks through the `END` card, preserving full SIP distortion polynomials and avoiding wavelength evaluation shifts [VERIFIED: `worker/worker/processing/fits_parser.py`].
  - Matched narrow-slice wavelength extraction (1.0 µm, 2.0 µm, 4.0 µm) and 3-band RGB composite, eliminating false-positive photometric blinking caused by SPHEREx Linear Variable Filter (LVF) gradients [VERIFIED: `worker/worker/processing/binning.py`].
  - 0.5° cutout geometry (293×293 px at native 6.15 arcsec/px TAN projection) containing 6-month Earth-orbit parallax shifts for objects at 500–1000 AU [VERIFIED: `docs/VERIFIED_FACTS.md` §7, §8].
  - Per-pixel shared wavelength intersection masking and Level 2 defect masking (FLAGS bits 0–2, 4–7, 9–11, 14–15, 17, 19) + He airglow exclusion (1.075–1.091 µm) [VERIFIED: `worker/worker/processing/masking.py`].
  - Tile renderer generating WebP images under 250 KB with visual hatched mask indicators, accompanying WCS JSON sidecars, and S3/MinIO upload [VERIFIED: `worker/worker/render/tiles.py`].
  - PostgreSQL subject insertion with pgSphere 1-arcsec coordinate deduplication [VERIFIED: `worker/worker/db.py`].
  - Redis queue worker (`astroblink:ingest_jobs`) with health heartbeats (`astroblink:worker:heartbeat`) [VERIFIED: `worker/worker/queue/consumer.py`].
- **API Consensus Engine & Endpoints (`api/`):**
  - Pure consensus algorithm implementing per-epoch DBSCAN clustering, pixel-scale-aware $\varepsilon = 1.5\text{ px} \times 6.15" = 9.225"$, volunteer reliability weighting, and gold-standard evaluation [VERIFIED: `api/app/services/consensus.py`].
  - Database-backed consensus trigger (`POST /api/v1/consensus/run`) with admin bearer token authentication and subject-level idempotency [VERIFIED: `api/app/routers/consensus.py`].
  - Candidate filtering (`GET /api/v1/candidates`) and multi-format export (`GET /api/v1/candidates/export`) supporting CSV and IVOA-compliant VOTable 1.4 XML [VERIFIED: `api/app/services/export.py`].
  - Subject serving (`GET /api/v1/subjects/next`) and public classification recording (`POST /api/v1/classify`) [VERIFIED: `api/app/routers/`].
  - Full suite of unit and contract validation tests passing on API [VERIFIED: `api/tests/`].
- **Database Schema & Migrations (`infra/`, `api/alembic/`):**
  - PostgreSQL 16 schema with pgSphere extension, tables for `users`, `subjects`, `classifications`, `marks`, `candidates`, `candidate_epochs`, `badges`, `user_badges`, `candidate_reviews` [VERIFIED: `api/alembic/versions/001_initial_schema.py`].
- **Remote Synchronization & Git History:**
  - All development branches (`main`, `feat/api-consensus`, `feat/worker-ingestion`) and milestone tags (`scaffold-v0`, `scaffold-v1`, `scaffold-v3`) have been pushed to `origin` [VERIFIED: `git ls-remote`].

### What Does Not Work / Is Incomplete [VERIFIED]
- **Client Application (`client/`):** Only a scaffold exists. `client/src/components/BandSelector.tsx` and `client/src/app/classify/page.tsx` still reference obsolete broad-band keys (`swir`, `mwir`) instead of narrow-slice keys (`1.0um`, `2.0um`, `4.0um`). Coordinate deprojection in `client/src/app/classify/page.tsx` is hardcoded to a 128×128 box instead of parsing the 293×293 WCS JSON sidecar. Gamification, tutorial modals, and discovery feeds are stubs [VERIFIED].
- **API `wcs_urls` Field:** `api/app/routers/subjects.py` hardcodes `wcs_urls={}` when returning subjects, preventing the client from receiving the WCS sidecar URLs written by the worker [VERIFIED: `api/app/routers/subjects.py` L43].
- **Contract Schema Mismatches:** `contracts/openapi.yaml` and `contracts/schemas/subject.yaml` define strict regex patterns (`^[1-4]_[a-z0-9_]+$`) and sidecar schemas with `additionalProperties: false` that reject the worker's narrow-slice tile keys (e.g. `1_1.0um`) and extra WCS fields [VERIFIED: `contracts/schemas/`].
- **Default Admin Token Security:** `ADMIN_TOKEN` defaults to the public placeholder `"astroblink-admin-secret"` in `api/app/config.py` and does not reject startup in production mode [VERIFIED: `api/app/config.py` L27].

### What Is Next [VERIFIED]
1. Update API router to populate `wcs_urls` from `subjects.wcs_urls` column.
2. Update OpenAPI schemas to permit floating-point wavelength slice keys (`1_1.0um`, etc.) and relaxed sidecar fields.
3. Rebuild the Next.js client (`client/`) to consume 293×293 tiles, support narrow-slice band selection, apply client-side WCS TAN deprojection, and display consensus badges.

---

## 2. Master Index of Audit Documents

| File | Purpose | Audited Commit |
| :--- | :--- | :---: |
| [00_project_overview.md](00_project_overview.md) | High-level scientific concept, SPHEREx details, matched-wavelength rationale, 0.5° parallax findings, team roles, and hackathon context. | `cc39991` |
| [01_repo_map.md](01_repo_map.md) | Comprehensive map of folders and key files, ownership per CODEOWNERS, build contexts, and strict zero-shared-code communication interfaces. | `cc39991` |
| [02_architecture_as_built.md](02_architecture_as_built.md) | As-built technical architecture: end-to-end data flow, database schema, Redis queues, MinIO key layout, API endpoints vs contracts, and text diagram. | `cc39991` |
| [03_component_audit.md](03_component_audit.md) | Deep-dive audit per component (`api`, `worker`, `client`, `infra`, `contracts`), configuration matrix, worker pipeline math, and test instructions. | `cc39991` |
| [04_plan_vs_reality.md](04_plan_vs_reality.md) | Detailed requirements matrix comparing original PRD/Architecture specifications against what was actually built, documenting intentional deviations. | `cc39991` |
| [05_known_issues.md](05_known_issues.md) | Ranked issue and risk register (CRITICAL, HIGH, MEDIUM, LOW) with exact file locations, evidence, and recommended remedies. | `cc39991` |
| [06_how_to_run.md](06_how_to_run.md) | Tested step-by-step Windows PowerShell guide for spinning up containers, running migrations, enqueuing ingest jobs, executing API calls, and testing. | `cc39991` |
| [07_troubleshooting.md](07_troubleshooting.md) | Verified catalog of common failure modes, memory settings, port conflicts, Windows encoding gotchas, and proven operational fixes. | `cc39991` |
| [08_decisions_log.md](08_decisions_log.md) | Architectural Decision Records (ADRs) explaining technical trade-offs (pgSphere vs PostGIS, S3 ranged reads vs downloads, 0.5° cutouts, etc.). | `cc39991` |
| [09_next_steps.md](09_next_steps.md) | Prioritized engineering backlog for resuming development, detailing tasks, role assignments, sizing, dependencies, and acceptance criteria. | `cc39991` |
| [10_agent_onboarding.md](10_agent_onboarding.md) | Standing operational guidelines and rules of engagement for any incoming AI agent or software engineer taking over the repository. | `cc39991` |
| [11_verification_log.md](11_verification_log.md) | Audit trail of all terminal commands executed during this audit session with raw, trimmed outputs and execution timestamps. | `cc39991` |

---

## 3. "Start Here" Reading Order for a New Engineer / Agent

If you are picking up this project with zero prior memory:

1. **Step 1: Read [00_project_overview.md](00_project_overview.md)** (10 min)  
   Understand why AstroBlink exists, what SPHEREx data looks like, why matched wavelengths are essential to prevent false alarms, and what objects can realistically be detected.
2. **Step 2: Read [01_repo_map.md](01_repo_map.md) & [02_architecture_as_built.md](02_architecture_as_built.md)** (15 min)  
   Understand the repository layout, Docker build isolation rules, inter-service network boundaries, database schema, and queue job schemas.
3. **Step 3: Follow [06_how_to_run.md](06_how_to_run.md)** (20 min)  
   Spin up the stack using Windows PowerShell, run database migrations, ingest a test subject, inspect it in MinIO, and execute the test suites inside the containers.
4. **Step 4: Review [05_known_issues.md](05_known_issues.md)** (10 min)  
   Review the known bugs and contract discrepancies before modifying any code.
5. **Step 5: Review [09_next_steps.md](09_next_steps.md)** (10 min)  
   Pick up the highest-priority open tasks from the engineering backlog.
6. **Step 6: Keep [10_agent_onboarding.md](10_agent_onboarding.md) Open**  
   Follow the strict rules: evidence-based changes, no destructive Docker commands, no cross-folder imports, and single-turn task scopes.
