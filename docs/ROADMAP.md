# AstroBlink — Project Roadmap

> **Project:** AstroBlink · NASA Space Apps Challenge 2026 · "Planet X and SPHEREx" track
> **Version:** 1.0 · **Date:** 2026-10-10
> **Companion docs:** [README.md](../README.md) · [PRD.md](PRD.md) · [ARCHITECTURE.md](ARCHITECTURE.md)

---

## Table of Contents

1. [Phase Overview](#1-phase-overview)
2. [Phase 1 — Hackathon MVP](#2-phase-1--hackathon-mvp)
3. [Phase 2 — Consensus & Tuning Beta](#3-phase-2--consensus--tuning-beta)
4. [Phase 3 — Production & Catalog Release](#4-phase-3--production--catalog-release)
5. [Hackathon Weekend Cut Line](#5-hackathon-weekend-cut-line)
6. [Risk Register](#6-risk-register)
7. [Open Questions](#7-open-questions)

---

## Team Roles Reference

| # | Role | Person |
|---|------|--------|
| 1 | Astronomy Data Engineer | S3/IRSA access, Astropy FITS parsing, spectral binning, tile rendering |
| 2 | Backend & Consensus Dev | FastAPI endpoints, PostgreSQL schema, DBSCAN consensus, VOTable export |
| 3 | Frontend Canvas Dev | Next.js app, OpenSeadragon/Canvas blink comparator, annotation tools |
| 4 | UI/UX & Gamification Lead | Onboarding tutorial, badges, discovery feed, responsive & accessible design |
| 5 | DevOps & Cloud Engineer | Docker, deployment, Redis cache, rate-limiting, CI/CD pipelines |
| 6 | Full-Stack Integrator & Team Lead | API contract ownership, code reviews, documentation, Space Apps submission |

---

## 1. Phase Overview

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 Phase 1: Hackathon MVP          Phase 2: Beta            Phase 3: Production
 (48-hour sprint)                (Weeks 1–4 post-hack)    (Months 2–4)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 ▸ Ingest ≥10 real subjects      ▸ Full consensus pipeline ▸ 10K+ subjects
 ▸ Working blink comparator      ▸ Gold-standard seeding   ▸ Confirmed candidates
 ▸ End-to-end classify flow      ▸ 50+ users, 500+ classif ▸ VOTable catalog
 ▸ Demo-ready deployment         ▸ Onboarding + badges     ▸ Pro review dashboard
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## 2. Phase 1 — Hackathon MVP

**Duration:** 48 hours (hackathon weekend)
**Goal:** Demonstrate end-to-end flow from SPHEREx S3 data → browser blink comparator → classification submission → database persistence. Impress judges with a working, visually polished demo on real data.

### Exit Criteria

| # | Criterion | Traces to |
|---|-----------|-----------|
| P1-E1 | ≥ 10 subjects ingested from real SPHEREx QR2/QR3 S3 data, with tiles rendered in all 3 bands (SWIR, MWIR, RGB). | FR-1, PRD §9 Phase 1 |
| P1-E2 | Blink comparator loads and animates ≥ 3 epochs of ≥ 1 subject in all 3 bands with band switching. | FR-2.1, FR-2.2 |
| P1-E3 | A user can place marks, select a category, and submit a classification; the classification and marks persist in PostgreSQL. | FR-2.3–FR-2.5 |
| P1-E4 | Application runs via `docker compose up` with a single command on a fresh machine. | NFR-3 |
| P1-E5 | Live demo URL accessible to hackathon judges (deployed or tunneled). | Hackathon requirement |

### Task Table

| ID | Task | Owner | Depends on | Est. Effort | Sprint Slot |
|----|------|-------|------------|-------------|-------------|
| **Infrastructure & Scaffolding** | | | | | |
| P1-01 | Create monorepo structure: `api/`, `client/`, `worker/`, `infra/`, `contracts/`, `docs/` | 6 | — | 1 h | Hour 0–1 |
| P1-02 | `docker-compose.yml` with PostgreSQL 16, Redis 7, backend, frontend, worker services | 5 | P1-01 | 2 h | Hour 0–2 |
| P1-03 | PostgreSQL schema migration (Alembic): `users`, `subjects`, `classifications`, `marks` tables. Minimal schema — skip `candidates`, `badges`, `candidate_reviews` until Phase 2. | 2 | P1-02 | 2 h | Hour 1–3 |
| P1-04 | FastAPI app scaffold with health endpoint, CORS, Pydantic base models, `.env` config | 2 | P1-02 | 2 h | Hour 1–3 |
| P1-05 | Next.js 14 app scaffold with App Router, Tailwind CSS, base layout, health check page | 3 | P1-02 | 2 h | Hour 1–3 |
| P1-06 | CI pipeline: GitHub Actions for lint (Ruff + ESLint), type check, Docker build test | 5 | P1-01 | 1.5 h | Hour 2–4 |
| **Data Ingestion** | | | | | |
| P1-07 | S3 client module: anonymous boto3 access to `nasa-irsa-spherex`, list and download Level 2 FITS from `qr2/level2/` | 1 | P1-02 | 3 h | Hour 1–4 |
| P1-08 | MEF FITS parser: open with Astropy, extract IMAGE (HDU 1), FLAGS (HDU 2), VARIANCE (HDU 3), WCS-WAVE (HDU 6); read per-pixel `CWAVE` from WCS-WAVE binary table | 1 | P1-07 | 4 h | Hour 4–8 |
| P1-09 | Wavelength binning: select pixels by CWAVE into SWIR (0.75–2.42 µm), MWIR (3.8–5.0 µm), RGB sub-bands (B≈1.0, G≈2.0, R≈4.0 µm ± 0.1 µm) | 1 | P1-08 | 3 h | Hour 8–11 |
| P1-10 | FLAGS masking: mask any pixel with non-zero FLAGS (all known bits + conservative mask for undefined bits 3–5, 8, 10–24). He airglow mask (CWAVE 1.075–1.091 µm). | 1 | P1-08 | 2 h | Hour 8–10 |
| P1-11 | Reprojection & co-add: for each (epoch, band), reproject qualifying pixels onto a common TAN WCS grid using `reproject_interp`; inverse-variance weighted co-add | 1 | P1-09, P1-10 | 4 h | Hour 11–15 |
| P1-12 | Tile renderer: asinh stretch, masked-pixel hatching, PNG/WebP output (< 250 KB), JSON WCS sidecar (CRPIX, CRVAL, CD, NAXIS) | 1 | P1-11 | 3 h | Hour 15–18 |
| P1-13 | Ingestion worker: Redis job queue consumer (BRPOP), orchestrates P1-07 through P1-12 per (RA, Dec, size_deg) job, writes tiles to `./data/tiles/`, inserts subject row in DB | 1, 5 | P1-07–P1-12 | 3 h | Hour 18–21 |
| P1-14 | Batch ingest script: hardcoded list of 10–20 (RA, Dec) positions targeting known asteroid fields or ecliptic plane regions; enqueue jobs and run to completion | 1 | P1-13 | 2 h | Hour 21–23 |
| **Backend API** | | | | | |
| P1-15 | `POST /api/v1/cutouts/fetch`: validate (RA, Dec, size_deg), insert `ingest_jobs` row, push job ID to Redis queue, return 202 | 2 | P1-04, P1-13 | 2 h | Hour 10–12 |
| P1-16 | `GET /api/v1/subjects/next`: return next unretired subject the user hasn't classified, with tile URLs and WCS JSON URLs. Hardcoded user for MVP (no auth). | 2 | P1-03 | 2.5 h | Hour 12–14 |
| P1-17 | `POST /api/v1/classify`: validate marks (RA/Dec bounds, epoch in subject.epochs), insert classification + marks, increment `subjects.classification_count`, set `retired=true` at 10 | 2 | P1-03 | 3 h | Hour 14–17 |
| P1-18 | Tile serving: Nginx or FastAPI static file mount for `./data/tiles/` with `Cache-Control` header | 2, 5 | P1-12 | 1 h | Hour 12–13 |
| **Frontend** | | | | | |
| P1-19 | Blink comparator canvas: load tile PNGs for a subject, loop animation at adjustable frame rate (0.5–2 Hz), manual slider mode | 3 | P1-05, P1-18 | 6 h | Hour 4–10 |
| P1-20 | Band switcher: toggle between SWIR, MWIR, RGB; swap tile set, preserve pan/zoom state | 3 | P1-19 | 2 h | Hour 10–12 |
| P1-21 | Mark placement: click/tap on canvas → place epoch-colored circle, convert (pixel_x, pixel_y) → (RA, Dec) using WCS JSON sidecar (client-side TAN deprojection) | 3 | P1-19 | 4 h | Hour 12–16 |
| P1-22 | Category selector + submit button: dropdown for 6 categories, submit POST to `/api/v1/classify`, show success/error feedback | 3 | P1-21, P1-17 | 3 h | Hour 16–19 |
| P1-23 | WCS coordinate readout bar: display live (RA, Dec) on cursor hover | 3 | P1-21 | 1.5 h | Hour 19–20 |
| P1-24 | Subject loading flow: call `GET /api/v1/subjects/next` on page load and after each submission; show loading spinner | 3 | P1-16, P1-19 | 2 h | Hour 20–22 |
| **UI/UX Polish** | | | | | |
| P1-25 | Landing page: project name, one-line description, "Start Classifying" CTA button, data attribution footer | 4 | P1-05 | 3 h | Hour 4–7 |
| P1-26 | Classification page layout: blink canvas (center), controls bar (bottom), info sidebar (right — subject ID, epoch count, band), responsive down to 375 px | 4 | P1-19 | 4 h | Hour 10–14 |
| P1-27 | Visual design: color palette, typography, masked-pixel hatching legend, epoch color coding | 4 | P1-26 | 3 h | Hour 14–17 |
| P1-28 | Minimal tutorial: static modal with 3 annotated screenshots (real mover, artifact, masked region) shown before first classification; dismissible | 4 | P1-27 | 3 h | Hour 20–23 |
| **Deployment & Demo** | | | | | |
| P1-29 | Production Docker build: multi-stage Dockerfile for backend (Python slim), frontend (Node alpine + static export), worker | 5 | P1-02 | 2.5 h | Hour 20–22 |
| P1-30 | Deploy to cloud VM or tunnel (ngrok/Cloudflare Tunnel) for live demo URL | 5 | P1-29 | 2 h | Hour 22–24 |
| P1-31 | Hackathon submission: README, 2-minute demo video script, screenshots, challenge form | 6 | P1-30 | 3 h | Hour 40–43 |
| **Integration & Testing** | | | | | |
| P1-32 | End-to-end smoke test: ingest 1 subject → load in blink UI → place marks → submit → verify in DB | 6 | P1-24, P1-17 | 2 h | Hour 23–25 |
| P1-33 | Bug bash: all team members test on different browsers/devices, fix critical blockers | 6, all | P1-32 | 4 h | Hour 36–40 |
| P1-34 | Demo rehearsal: 5-minute walkthrough with backup plan if live demo fails (pre-recorded fallback) | 6 | P1-33 | 2 h | Hour 43–45 |

### Phase 1 Dependency Graph

```
P1-01 ──▶ P1-02 ──┬──▶ P1-03 ──▶ P1-16 ──▶ P1-24 ──┐
                   │              P1-17 ──┤           │
                   │                      │           │
                   ├──▶ P1-04 ──▶ P1-15   │           │
                   │                      │           │
                   ├──▶ P1-05 ──▶ P1-19 ──┤           │
                   │              │       │           │
                   │              ▼       │           ▼
                   │         P1-20,21,23  │      P1-32 ──▶ P1-33 ──▶ P1-34
                   │              │       │
                   │              ▼       │
                   │         P1-22 ◀──────┘
                   │
                   ├──▶ P1-07 ──▶ P1-08 ──┬──▶ P1-09 ──┐
                   │                      │             │
                   │                      ├──▶ P1-10    │
                   │                      │             ▼
                   │                      │        P1-11 ──▶ P1-12 ──▶ P1-13 ──▶ P1-14
                   │                      │                            │
                   │                      │                            ▼
                   │                      │                       P1-18
                   │
                   └──▶ P1-06
```

---

## 3. Phase 2 — Consensus & Tuning Beta

**Duration:** 4 weeks post-hackathon
**Goal:** Implement the full consensus pipeline, gold-standard calibration, user authentication, onboarding, gamification, and deploy a public beta with real volunteers.

### Exit Criteria

| # | Criterion | Traces to |
|---|-----------|-----------|
| P2-E1 | Consensus pipeline runs on retired subjects: per-epoch DBSCAN with haversine distance, tracklet linking, reliability-weighted scoring. Produces candidate records. | FR-3 |
| P2-E2 | ≥ 50 registered users via OAuth (Google/GitHub) have submitted ≥ 500 classifications. | PRD §9 Phase 2 |
| P2-E3 | Gold-standard subjects seeded (≥ 5% of queue); per-user reliability scores update automatically. | FR-3.6, FR-3.7 |
| P2-E4 | Onboarding tutorial functional for first-time users. | FR-5.1 |
| P2-E5 | Badge system awards at least 3 badge types. | FR-5.2 |
| P2-E6 | Mean volunteer accuracy on gold-standard subjects ≥ 70%. | PRD §9 Phase 2 |
| P2-E7 | Median classification time (load-to-submit) ≤ 30 seconds. | PRD §9 Phase 2 |
| P2-E8 | Rate limiting and anti-spam heuristics operational. | NFR-2, ARCH §7, §8.5 |

### Task Table

| ID | Task | Owner | Depends on | Est. Effort |
|----|------|-------|------------|-------------|
| **Authentication & Users** | | | | |
| P2-01 | OAuth 2.0 integration: Google + GitHub sign-in, user upsert, JWT access (15 min) + refresh (7 day) tokens | 2, 5 | P1-03 | 8 h |
| P2-02 | Auth middleware: JWT verification, role extraction, inject `current_user` into FastAPI dependency | 2 | P2-01 | 3 h |
| P2-03 | Frontend auth flow: sign-in page, token storage (httpOnly cookie for refresh, memory for access), auto-refresh, sign-out | 3, 4 | P2-01 | 6 h |
| P2-04 | Authorization enforcement: role-based access on all endpoints per ARCH §8.3 matrix | 2 | P2-02 | 3 h |
| **Consensus Pipeline** | | | | |
| P2-05 | Haversine distance function: Python implementation with RA wraparound, unit tests with edge cases (RA near 0/360, Dec near ±90) | 2 | — | 3 h |
| P2-06 | Reliability-weighted DBSCAN: implement custom DBSCAN with weighted density (per ARCH §5.3), configurable ε (default 9.2″) and minPts (default 3) | 2 | P2-05 | 8 h |
| P2-07 | Per-epoch clustering function: load marks for a (subject, epoch), apply weighted DBSCAN, compute cluster centroids and dispersion (per ARCH §5.4) | 2 | P2-06 | 4 h |
| P2-08 | Tracklet linking: greedy nearest-neighbor across sorted epochs with configurable max-displacement (default 30″) (per ARCH §5.5) | 2 | P2-07 | 5 h |
| P2-09 | Motion vector computation: magnitude (arcsec/epoch) and position angle (degrees) from first/last cluster (per ARCH §5.6) | 2 | P2-08 | 2 h |
| P2-10 | Consensus orchestrator: full pipeline wiring per ARCH §5.7; insert candidates and candidate_epochs in DB | 2 | P2-09 | 4 h |
| P2-11 | `POST /api/v1/consensus/run`: single-subject and batch modes, parameter validation (per ARCH §4.3) | 2 | P2-10, P2-04 | 3 h |
| P2-12 | Auto-trigger: automatically run consensus when a subject reaches retirement (10 classifications) via background task | 2 | P2-10 | 2 h |
| P2-13 | Consensus unit tests: test with synthetic marks (known cluster positions, expected tracklets), edge cases (no clusters, single-epoch, all noise) | 2 | P2-10 | 5 h |
| **Gold-Standard Calibration** | | | | |
| P2-14 | Gold-standard ingestion: script to query JPL Horizons or MPC for known asteroids/comets in ingested sky regions; create gold-standard subjects with `gold_expected` JSON | 1 | P1-14 | 6 h |
| P2-15 | Gold-standard serving: modify subject queue to mix ≥ 5% gold-standard subjects, indistinguishable in the UI | 2 | P2-14 | 3 h |
| P2-16 | Reliability scoring: on classify, if subject is gold-standard, compare marks to `gold_expected`; update `users.gold_total`, `gold_correct`, recalculate `reliability = gold_correct / gold_total` clamped to [0.05, 1.0] | 2 | P2-15 | 4 h |
| P2-17 | Low-reliability intervention: users with reliability < 0.2 shown prompt to retake tutorial | 2, 4 | P2-16, P2-20 | 2 h |
| **Onboarding & Gamification** | | | | |
| P2-18 | Schema migration: add `badges`, `user_badges` tables with seed data (7 badge definitions per ARCH §3) | 2 | P1-03 | 1.5 h |
| P2-19 | Badge check logic: background task after each classification checks milestone thresholds, inserts `user_badges` rows, returns newly earned badges in classify response | 2 | P2-18 | 4 h |
| P2-20 | Interactive onboarding tutorial: step-by-step modal with annotated gold-standard examples (real mover, cosmic-ray artifact, masked region, satellite streak), skip after first completion | 4 | P2-03 | 10 h |
| P2-21 | User profile page: classification count, badges earned, reliability score (displayed as "accuracy" to the user), streak counter | 4, 3 | P2-19, P2-03 | 5 h |
| P2-22 | Leaderboard page: all-time and weekly rankings from Redis sorted sets; top 50 displayed | 4, 3 | P2-01 | 4 h |
| P2-23 | Discovery feed stub: landing page section showing placeholder "recent discoveries" cards (populated with real data in Phase 3) | 4 | P2-03 | 3 h |
| **Security & Anti-Spam** | | | | |
| P2-24 | Rate-limit middleware: sliding-window log in Redis (per ARCH §7), 60 classify/hr/user, 120 req/min/IP for anon, 10 ingest/hr/user, 5 consensus/hr/user | 5 | P2-02 | 4 h |
| P2-25 | Anti-spam: flag classifications with `load_time_ms < 3000` as suspicious (excluded from consensus); floor reliability for users failing > 50% gold in last 20 | 2 | P2-16 | 3 h |
| P2-26 | Input validation hardening: server-side Pydantic validation for all mark fields (RA, Dec, epoch, pixel bounds) per ARCH §8.4 | 2 | P1-17 | 2 h |
| **Ingestion Improvements** | | | | |
| P2-27 | Subject deduplication: before insert, query pgSphere `spoint <-> spoint` for existing subjects within 1″; skip or update | 1 | P1-13 | 3 h |
| P2-28 | Retry logic for S3/IRSA: exponential backoff (5s initial, 5min max, 3 retries); `ingest_jobs.status` tracking | 1, 5 | P1-13 | 3 h |
| P2-29 | Batch ingestion: admin UI or script to ingest a grid of sky positions (e.g., ecliptic ± 10° in 0.1° steps) | 1, 6 | P2-27 | 4 h |
| P2-30 | Scale to ≥ 500 subjects across multiple sky regions | 1 | P2-29 | 4 h |
| **Testing & Deployment** | | | | |
| P2-31 | Integration test suite: API tests for all endpoints (classify, consensus, subjects/next) with test database | 6, 2 | P2-11 | 6 h |
| P2-32 | Accessibility audit: WCAG 2.1 AA check (color contrast, keyboard nav, screen reader) on classification page; fix critical issues | 4, 3 | P2-20 | 4 h |
| P2-33 | Production deployment: cloud VM (DigitalOcean/AWS/GCP), Docker Compose, HTTPS with Let's Encrypt, DNS setup | 5 | P2-01 | 6 h |
| P2-34 | Monitoring: basic logging (structured JSON), error alerting (email or Slack webhook on 500s), uptime check | 5 | P2-33 | 3 h |
| P2-35 | Beta launch: invite 50+ volunteers (social media, Zooniverse forums, university astronomy clubs), collect feedback | 6, 4 | P2-33 | 4 h |

---

## 4. Phase 3 — Production & Catalog Release

**Duration:** 2–3 months post-beta
**Goal:** Scale subject coverage to ≥ 10,000 subjects, implement the professional review workflow, export validated candidates as IVOA-compliant VOTable, achieve ≥ 1 confirmed cross-match with a known or new minor body.

### Exit Criteria

| # | Criterion | Traces to |
|---|-----------|-----------|
| P3-E1 | ≥ 10,000 subjects ingested covering ≥ 5% of the sky. | PRD §9 Phase 3 |
| P3-E2 | Professional review dashboard functional: candidate list with filters, per-candidate detail view with epoch overlays, status update with rationale, audit log. | FR-4.1–FR-4.3 |
| P3-E3 | `GET /api/v1/candidates/export` produces valid CSV and IVOA VOTable 1.4 output; VOTable validates against schema. | FR-4.4, FR-4.5, PRD §9 Phase 3 |
| P3-E4 | ≥ 1 confirmed candidate cross-matched with MPC or JPL Horizons. | PRD §9 Phase 3 |
| P3-E5 | ≥ 3 professional astronomer accounts performing reviews. | PRD §9 Phase 3 |
| P3-E6 | Lighthouse accessibility score ≥ 90 on classification page. | PRD §9 Phase 3 |
| P3-E7 | System handles 200 concurrent classifiers without P95 subject-fetch latency exceeding 200 ms. | NFR-1, NFR-5 |

### Task Table

| ID | Task | Owner | Depends on | Est. Effort |
|----|------|-------|------------|-------------|
| **Professional Review** | | | | |
| P3-01 | Schema migration: add `candidate_reviews` table (per ARCH §3) | 2 | P2-10 | 1 h |
| P3-02 | `GET /api/v1/candidates`: list candidates with sorting/filtering by status, motion, reliability, category, sky region | 2 | P3-01 | 4 h |
| P3-03 | `PATCH /api/v1/candidates/{id}`: update status (`confirmed`/`rejected`) with rationale; insert `candidate_reviews` audit row; require `astronomer` role | 2 | P3-01, P2-04 | 3 h |
| P3-04 | Review dashboard frontend: candidate table with column sorting, pagination, status filters; candidate detail page with per-epoch thumbnails, mark overlay, motion vector visualization, status form | 3, 4 | P3-02, P3-03 | 12 h |
| P3-05 | Candidate detail: overlay volunteer marks (colored dots), cluster centroids (crosshairs), motion arrow (SVG), dispersion ellipse on blink canvas | 3 | P3-04 | 6 h |
| **Catalog Export** | | | | |
| P3-06 | CSV exporter: query candidates with filters (status, reliability, category, sky region), stream CSV response with proper headers | 2 | P3-02 | 3 h |
| P3-07 | VOTable exporter: generate IVOA VOTable 1.4 XML with proper UCDs (`pos.eq.ra`, `pos.eq.dec`, `pos.pm`), unit annotations, per-epoch position columns (per ARCH §4.4) | 2 | P3-06 | 6 h |
| P3-08 | VOTable validation: test against IVOA VOTable validator (`stilts tpipe`); fix any schema errors | 2 | P3-07 | 3 h |
| P3-09 | Export UI: download buttons on review dashboard for CSV and VOTable with filter presets | 3 | P3-06, P3-07 | 2 h |
| **Scale Ingestion** | | | | |
| P3-10 | Automated sky tiling: script to generate (RA, Dec) grid covering ecliptic ± 30°, galactic plane avoidance zones, polar cap regions; output as ingest job batch | 1 | P2-29 | 6 h |
| P3-11 | Parallel ingestion: run 4+ worker processes concurrently; handle shared-nothing job claims with Redis BRPOP | 1, 5 | P2-28 | 4 h |
| P3-12 | Handle new data releases: update S3 key prefix config for DR1/DR2 when available; re-ingest existing positions with new epochs `[VERIFY: OQ-3]` | 1 | P3-10 | 4 h |
| P3-13 | Scale to ≥ 10,000 subjects; monitor ingest throughput and tile storage growth | 1, 5 | P3-11, P3-10 | 8 h |
| **Gamification & Engagement** | | | | |
| P3-14 | Discovery feed (real data): list confirmed candidates with per-epoch thumbnails, contributor credits (opt-in), brief auto-generated description | 4, 3 | P3-03 | 5 h |
| P3-15 | User classification history page: list of past classifications with subject thumbnails, marks, category; link to candidate if consensus produced one | 4, 3 | P2-19 | 4 h |
| P3-16 | Email notifications: notify users when their classified subject produces a confirmed candidate (opt-in) | 2, 5 | P3-03 | 4 h |
| **Stretch Goals** | | | | |
| P3-17 | *(Stretch)* Adaptive retirement: subjects with unanimous "nothing" in first 5 classifications retire early; configurable threshold | 2 | P2-12 | 4 h |
| P3-18 | *(Stretch)* MPC cross-match: automated query of Minor Planet Center ephemeris service to check if candidate positions match known objects; annotate candidate with cross-match result | 1, 2 | P3-03 | 8 h |
| P3-19 | *(Stretch)* SAMP integration: "Send to TOPCAT" button for VOTable export via SAMP protocol | 2, 3 | P3-07 | 4 h |
| P3-20 | *(Stretch)* ML pre-screening: train a simple CNN on gold-standard data to flag likely movers/artifacts; show ML confidence alongside human consensus for comparison (not a replacement) | 1, 2 | P2-14, P2-10 | 20 h |
| **Quality & Performance** | | | | |
| P3-21 | Load testing: k6 scripts simulating 200 concurrent classifiers; identify and fix bottlenecks in subject-fetch and classify endpoints | 5 | P2-33 | 6 h |
| P3-22 | Accessibility remediation: full WCAG 2.1 AA audit with automated tools (axe-core) + manual screen-reader testing; target Lighthouse ≥ 90 | 4, 3 | P2-32 | 6 h |
| P3-23 | Database performance tuning: EXPLAIN ANALYZE on hot queries (subject-next, consensus marks load), add missing indexes, consider partitioning `marks` by `subject_id` range if needed | 2, 5 | P3-13 | 4 h |
| P3-24 | Security hardening: penetration test checklist (OWASP Top 10), CSP tuning, dependency vulnerability scan (Dependabot/Snyk) | 5, 6 | P2-33 | 4 h |
| P3-25 | Documentation: API reference (auto-generated OpenAPI), user guide, contributor guide, data provenance and citation instructions | 6 | P3-08 | 6 h |

---

## 5. Hackathon Weekend Cut Line

The 48-hour hackathon constraint forces hard prioritization. Below is the definitive list of what **ships** versus what is **mocked or deferred**.

### ✅ Ships (Must Have for Demo)

| Component | Scope | Tasks |
|-----------|-------|-------|
| **Ingestion Worker** | Fully functional: S3 fetch → FITS parse → WCS-WAVE binning → FLAGS mask → reproject → tile render → DB insert. ≥ 10 real subjects. | P1-07 – P1-14 |
| **Blink Comparator** | Canvas animation with adjustable speed, band switching (SWIR/MWIR/RGB), pan/zoom. | P1-19, P1-20 |
| **Mark & Classify** | Click-to-mark with (RA, Dec) conversion, category selector, submit to backend, persists in DB. | P1-21 – P1-24 |
| **Backend API** | `/cutouts/fetch`, `/subjects/next`, `/classify`, `/health` endpoints. | P1-15 – P1-18 |
| **Database** | `users`, `subjects`, `classifications`, `marks` tables. Single hardcoded user (no auth). | P1-03 |
| **Docker** | `docker compose up` starts all services. | P1-02, P1-29 |
| **Landing Page** | Project name, description, CTA, attribution. | P1-25 |
| **Minimal Tutorial** | Static modal with 3 annotated screenshots. | P1-28 |

### 🔶 Mocked / Simplified

| Component | Mock Strategy |
|-----------|---------------|
| **Authentication** | Hardcoded user `{"id": "demo-user", "role": "volunteer", "reliability": 0.5}`. No OAuth. |
| **Consensus Pipeline** | Not implemented. Classifications are stored but not aggregated. Demo narrative: "After 10 volunteers classify, our DBSCAN pipeline clusters their marks…" (show architecture slide). |
| **Gold-Standard Subjects** | Not seeded. All subjects are regular. |
| **Reliability Scoring** | All users have fixed reliability = 0.5. |
| **Badges / Gamification** | Not implemented. Show UI mockup in slides. |
| **Leaderboard** | Not implemented. |
| **Rate Limiting** | Not enforced (demo environment). |
| **Candidate Export** | Not implemented. Show VOTable sample in slides. |
| **Professional Review** | Not implemented. |

### ❌ Deferred to Phase 2+

| Component | Phase |
|-----------|-------|
| OAuth 2.0 authentication | Phase 2 |
| Full consensus pipeline (DBSCAN + tracklet linking) | Phase 2 |
| Gold-standard seeding + reliability | Phase 2 |
| Interactive onboarding tutorial | Phase 2 |
| Badge system | Phase 2 |
| Rate limiting + anti-spam | Phase 2 |
| Professional review dashboard | Phase 3 |
| VOTable export | Phase 3 |
| Adaptive retirement | Phase 3 (stretch) |
| MPC cross-match | Phase 3 (stretch) |

---

## 6. Risk Register

| ID | Risk | Probability | Impact | Mitigation | Owner |
|----|------|:-----------:|:------:|-----------|-------|
| R1 | **SPHEREx S3 data is unavailable or access blocked during hackathon** | Low | Critical | Pre-download 5–10 Level 2 FITS files to local storage before the hackathon. Ingestion worker has a local-file mode alongside S3 mode. Test anonymous access well in advance. | 1, 5 |
| R2 | **WCS-WAVE HDU format is different than expected; CWAVE lookup fails** | Medium | High | Write the FITS parser first (P1-08) and test against real QR2 files before building binning. If the binary table schema differs, adapt the parser. Keep a raw FITS sample in `tests/fixtures/`. | 1 |
| R3 | **Tile rendering exceeds 250 KB per image for dense fields** | Medium | Medium | Apply aggressive WebP compression (quality 70); if still over, downsample by 2× (pixel scale 12.3″). Log warnings. This is acceptable for MVP; optimize tile encoding in Phase 2. | 1 |
| R4 | **IRSA Cutout Service API parameters are wrong — cutout requests fail** | Medium | Medium | Fall back to full-frame S3 download + local Astropy cutout (`Cutout2D`). This is slower but fully under our control. `[VERIFY: OQ-1, OQ-7]` | 1 |
| R5 | **Frontend canvas performance is poor on mobile devices** | Medium | Medium | Use WebP tiles (smaller than PNG). Limit max cutout display size to 512 × 512 px. Test on a real phone early (P1-32). Defer OpenSeadragon deep-zoom to Phase 2 if needed; use simple `<canvas>` drawImage loop. | 3 |
| R6 | **Team member unavailable during hackathon (illness, emergency)** | Low | High | Each role has a designated backup buddy. Role 6 (Team Lead) can cover any api/client gap at a basic level. Critical-path tasks (P1-08, P1-19) should be started early so partial progress is salvageable. | 6 |
| R7 | **DBSCAN ε parameter is poorly tuned — produces too many or too few clusters** | Medium | Medium | ε is configurable per consensus run (FR-3.3). Default of 9.2″ (1.5 px) is a starting point. Tune in Phase 2 using gold-standard subjects. Expose ε in admin UI for real-time experimentation. | 2 |
| R8 | **Volunteers produce low-quality classifications (random clicking, misunderstanding UI)** | High | Medium | Mitigated by: (a) onboarding tutorial, (b) gold-standard reliability scoring, (c) anti-spam heuristic (< 3s submissions excluded), (d) DBSCAN naturally filters noise points. Deploy all mitigations in Phase 2 before beta launch. | 2, 4 |
| R9 | **PostgreSQL pgSphere extension is unavailable in chosen deployment environment** | Low | High | Test `CREATE EXTENSION pg_sphere` in Docker image early (P1-02). Use the `pgSphere/pgsphere` Docker image or build from source. Fallback: use `q3c` or plain float columns with a haversine function — less elegant but functional. | 2, 5 |
| R10 | **Scope creep during hackathon — team spends time on Phase 2 features** | High | Medium | The cut line (§5) is the contract. Team Lead (Role 6) enforces it. No auth, no consensus, no badges during the hackathon. If a team member finishes early, they help with polish and testing, not new features. | 6 |
| R11 | **FLAGS bitmask has undocumented bits that mask too many valid pixels** | Medium | Low | Conservative masking may lose 5–15% of pixels. Acceptable for MVP. In Phase 2, analyze mask fraction statistics across ingested subjects. If > 30% of pixels are masked in > 20% of subjects, revisit by masking only known harmful bits (0, 1, 2, 6, 25, 26, 27). `[VERIFY: OQ-2]` | 1 |
| R12 | **Legal / data-use concerns with SPHEREx data redistribution** | Low | Low | AstroBlink does not redistribute raw FITS data. It serves pre-rendered derivative images (PNG/WebP tiles). SPHEREx data is public under the AWS Open Data Program. Attribution is provided per IRSA guidelines. Confirm with NASA data use policy before Phase 3 public release. | 6 |
| R13 | **VOTable export fails IVOA validation** | Medium | Medium | Use `astropy.io.votable` for generation, which produces spec-compliant output. Validate with `stilts tpipe` in CI. Address `xmlns` version ambiguity (OQ-9) by testing against the IVOA validator web service. | 2 |

---

## 7. Open Questions

All `[VERIFY]` items consolidated across all documents:

| ID | Question | Origin | Impact | Responsible | Target Resolution |
|----|----------|--------|--------|-------------|-------------------|
| OQ-1 | Exact IRSA SPHEREx Cutout Service API query-string parameters (endpoint URL, parameter names). | Prompt §4.C | Ingestion worker HTTP client (P1-07, P2-28). Fallback: S3 full-frame + local cutout. | Role 1 | Before hackathon |
| OQ-2 | FLAGS bitmask bits 3–5, 8, 10–24 — meanings undocumented. Currently masked conservatively. | Prompt §4.B | May over-mask valid pixels. Analyze mask fraction in Phase 2. | Role 1 | Phase 2 |
| OQ-3 | S3 key layout for future DR1/DR2 releases. Only `qr2/` and `qr3/` documented. | Prompt §4.C | Ingestion worker S3 key enumeration (P3-12). | Role 1 | Phase 3 |
| OQ-4 | Exact IRSA Cutout Service base URL. Placeholder: `https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts`. | Inferred | `.env` configuration. | Role 1 | Before hackathon |
| OQ-5 | Optimal width of RGB sub-band wavelength windows (currently ±0.1 µm). | Design decision | False-color tile quality. Needs empirical tuning with real data. | Role 1 | Phase 2 |
| OQ-6 | Exact epoch date boundaries. Using approximate 6-month windows. | Mission timeline | Epoch grouping correctness. | Role 1 | Phase 2 |
| OQ-7 | Whether IRSA Cutout Service preserves all 6 MEF HDUs in returned cutouts. | Prompt §4.C | If VARIANCE or WCS-WAVE missing, fall back to S3 full-frame. | Role 1 | Before hackathon |
| OQ-8 | pgSphere `spoint` distance operator precision at sub-arcsecond scales for DBSCAN neighborhoods. | Implementation | May need Python-side haversine if GiST index rounding exceeds tolerance. | Role 2 | Phase 2 |
| OQ-9 | VOTable `xmlns` version string — v1.4 may use v1.3 xmlns. | IVOA spec | VOTable validation. | Role 2 | Phase 3 |
