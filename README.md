# 🔭 AstroBlink

**A citizen-science blink comparator for NASA's SPHEREx mission — spot the next Pluto.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![NASA Space Apps 2026](https://img.shields.io/badge/NASA_Space_Apps-2026-orange)

---

## Reference Digest

> Facts extracted from the project reference files and used throughout this document.
> Source filenames: `spherex_mission_overview.md`, `irsa_dataset_and_access.md`, `nasa_challenge_and_zooniverse.md`.

1. SPHEREx launched 2025-03-11; nominal science ops started 2025-05-01; 25-month mission with **4 all-sky passes**, each ~6 months apart (source: `spherex_mission_overview.md` §1, §3).
2. 102 spectral channels, 0.744–5.002 µm, across 6 H2RG detectors (2040×2040 active pixels). Pixel scale **6.15″ × 6.15″** (source: `spherex_mission_overview.md` §4).
3. Dichroic beamsplitter at **2.42–2.45 µm** separates SWIR (Bands 1–3, Detectors 1–3) and MWIR (Bands 4–6, Detectors 4–6) (source: `spherex_mission_overview.md` §4).
4. Linear Variable Filters (LVFs) make wavelength a function of pixel position on each detector. The `WCS-WAVE` HDU (Binary Table, HDU 6) maps (x, y) → central wavelength and bandpass (source: `irsa_dataset_and_access.md` §2).
5. Level 2 data are calibrated single-exposure MEF FITS (~67 MB), with HDUs: IMAGE (MJy/sr), FLAGS (bitmask), VARIANCE, ZODI, EPSF, WCS-WAVE (source: `irsa_dataset_and_access.md` §2).
6. FLAGS bitmask known bits: 0 TRANSIENT, 1 OVERFLOW, 2 SUR_ERROR, 6 NONFUNC, 7 DICHROIC, 9 MISSING_DATA, 25 STREAK, 26 BLOOM, 27 SNOWBALL, 28 HALO, 29 SATELLITE_HALO (source: `irsa_dataset_and_access.md` §2).
7. S3 bucket: **`nasa-irsa-spherex`**, region `us-east-1`, anonymous access, key layout `qr2/level2/`, `qr3/` (source: `irsa_dataset_and_access.md` §3).
8. IRSA provides: Cutout Tool, Spectrophotometry Tool (Tractor), Mosaic Tool, MOST (Moving Object Search), SPLICES catalog (source: `irsa_dataset_and_access.md` §4).
9. Known artifacts to mask/filter: He 1.083 µm airglow banding, auroral emission lines, cosmic-ray snowballs/halos, frame-edge ghosts, shuttle glow (source: `irsa_dataset_and_access.md` §5).
10. Challenge track: "Planet X and SPHEREx" — build a public-facing web tool to display SPHEREx sky images and let anyone see how they change over time (source: `nasa_challenge_and_zooniverse.md` §1).
11. Zooniverse model: micro-tasking with 0.1°×0.1° cutouts, 15–30 s tasks, 5–10 volunteer consensus, classification decision tree, onboarding tutorials, gamification (source: `nasa_challenge_and_zooniverse.md` §3).
12. SPHEREx secondary science includes ~100,000 asteroid spectra and comet tracking (source: `spherex_mission_overview.md` §5).

## Conflicts & Verify List

| # | Item | Prompt §4 says | Reference files say | Resolution |
|---|------|----------------|---------------------|------------|
| V1 | S3 bucket name | `nasa-irsa-spherex` `[VERIFY]` | `nasa-irsa-spherex` confirmed (`irsa_dataset_and_access.md` §3) | **Consistent — verified.** |
| V2 | S3 key layout | `[VERIFY]` | Keys under `qr2/level2/`, `qr3/` etc. (`irsa_dataset_and_access.md` §3) | **Verified.** No per-epoch top-level key for DR1/DR2 yet; design must handle future key prefixes. |
| V3 | Pixel scale | "about 6.15″" `[VERIFY]` | 6.15″ × 6.15″ (`spherex_mission_overview.md` §4) | **Consistent — verified.** |
| V4 | IRSA Cutout API params | `[VERIFY]` | Reference describes the Cutout Tool accepting (RA, Dec, angular radius or box size in degrees), but **does not list exact query-string parameter names** (`irsa_dataset_and_access.md` §4). | **Still `[VERIFY]` — exact parameter names remain unknown.** |
| V5 | FLAGS bits to mask | Prompt says "non-zero FLAGS bitmasks (blooming, cosmic rays, saturation)" + `[VERIFY]` unknown bits | Reference lists specific bits (see Digest #6). Bits 3–5, 8, 10–24 are undefined. | **Resolved:** mask all bits listed in reference; treat undefined bits conservatively (mask if set). |
| V6 | `WCS-WAVE` HDU for binning | Prompt says "wavelength … given by the `WCS-WAVE` HDU" | Reference confirms HDU 6 is a binary table mapping pixel (x,y) → CWAVE, CBAND (`irsa_dataset_and_access.md` §2) | **Consistent.** |
| V7 | Composite band boundaries | Prompt: SWIR 0.75–2.42 µm, MWIR 3.8–5.0 µm | Reference: Bands 1–3 cover 0.744–2.421 µm; Bands 4–6 cover 2.423–5.002 µm. Prompt's MWIR starts at 3.8 µm, **excluding** Band 4 (2.423–3.822 µm). | **Conflict:** Prompt's MWIR composite intentionally starts at 3.8 µm to target thermal emission. Band 4 (2.42–3.82 µm) is partly excluded. This is a design choice, not an error — the gap (2.42–3.8 µm) is a twilight zone between reflected and thermal. Accept prompt definition but document the gap. |
| V8 | Retirement count | Prompt says 10 classifications | Zooniverse reference says "5 to 10 volunteers" | **No conflict:** prompt is a specific requirement within the reference range. Use 10. |
| V9 | Cutout size | Prompt doesn't specify | Reference says "e.g., 0.1° × 0.1°" (`nasa_challenge_and_zooniverse.md` §3) | Use 0.1° × 0.1° as default, make configurable. |

### Open Questions (carried forward as `[VERIFY]`)

- **OQ-1:** Exact IRSA SPHEREx Cutout Service API query-string parameters (endpoint URL, `pos`, `size`, `band` params).  
- **OQ-2:** FLAGS bits 3–5, 8, 10–24 — meanings unknown; mask conservatively.
- **OQ-3:** S3 key layout for future DR1/DR2 releases — currently only `qr2/` and `qr3/` documented.

---

## Mission Statement

AstroBlink is a **NASA Space Apps Challenge 2026** project for the **"Planet X and SPHEREx"** track. It brings Clyde Tombaugh's blink-comparator technique into the browser: volunteers view multi-epoch SPHEREx infrared cutouts — pre-processed into three composite bands — and mark objects that move or show anomalous color. Statistical consensus across 10 independent classifications per subject surfaces high-confidence candidates (KBOs, comets, NEAs, brown dwarfs, and hypothetical outer planets) for professional review and catalog publication.

---

## Features

| Feature | Description |
|---------|-------------|
| **Blink Comparator** | Frame-by-frame or slider-based animation of same-band, same-geometry cutouts across SPHEREx epochs. |
| **Spectral Band Binning** | Raw 102-channel LVF data composited into SWIR (0.75–2.42 µm), MWIR (3.8–5.0 µm), and false-color RGB (B≈1.0, G≈2.0, R≈4.0 µm) for web delivery. |
| **Annotation Tools** | Click-to-mark suspected movers per epoch; categorize as asteroid/NEO, comet, brown dwarf, Planet X candidate, or artifact. |
| **Consensus Pipeline** | Per-epoch DBSCAN clustering of volunteer marks → cross-epoch tracklet linking → reliability-weighted candidate extraction. |
| **Gold-Standard Calibration** | Known asteroid/comet subjects seeded into the queue to measure per-user reliability. |
| **Artifact Masking** | FLAG-bitmask and He-airglow masking; masked pixels rendered with visible hatching so users don't confuse them with objects. |
| **Onboarding Tutorial** | Interactive walkthrough teaching artifact recognition and marking technique. |
| **Gamification** | Badges, leaderboard, discovery feed, classification streak counter. |
| **Professional Export** | Validated candidates exported as CSV and IVOA-compliant VOTable for catalog ingestion. |

---

## Data-Flow Diagram

```
┌────────────────────────────────────────────────────────────────────────────┐
│                          DATA INGESTION LAYER                             │
│                                                                           │
│  ┌──────────────┐    ┌──────────────────┐    ┌───────────────────────┐    │
│  │ S3 Bucket    │    │  IRSA Cutout     │    │  Known-Object Seed   │    │
│  │ nasa-irsa-   │───▶│  Service         │───▶│  (MPC/JPL Horizons)  │    │
│  │ spherex      │    │  (RA,Dec,size)   │    │  Gold-standard subj. │    │
│  └──────────────┘    └────────┬─────────┘    └───────────┬───────────┘    │
│                               │                          │                │
│                               ▼                          │                │
│                    ┌──────────────────────┐               │                │
│                    │  Ingestion Worker    │◀──────────────┘                │
│                    │  (Python / Astropy)  │                                │
│                    │                      │                                │
│                    │  1. Parse MEF FITS   │                                │
│                    │  2. Read WCS-WAVE    │                                │
│                    │  3. Apply FLAGS mask │                                │
│                    │  4. Bin into 3 bands │                                │
│                    │  5. Reproject (WCS)  │                                │
│                    │  6. Render PNG/WebP  │                                │
│                    │     (< 250 KB each)  │                                │
│                    │  7. Emit JSON WCS    │                                │
│                    │     sidecar          │                                │
│                    └──────────┬───────────┘                                │
│                               │                                           │
└───────────────────────────────┼────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          STORAGE LAYER                                    │
│                                                                           │
│  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────────────┐     │
│  │ PostgreSQL       │  │ Object Store │  │ Redis Cache             │     │
│  │ (+ pgSphere)     │  │ (tiles +     │  │ (session, rate-limit,   │     │
│  │                  │  │  WCS JSON)   │  │  leaderboard)           │     │
│  │ subjects         │  └──────────────┘  └─────────────────────────┘     │
│  │ classifications  │                                                     │
│  │ candidates       │                                                     │
│  │ users            │                                                     │
│  └──────────────────┘                                                     │
│                                                                           │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          API GATEWAY (FastAPI)                             │
│                                                                           │
│  POST /api/v1/cutouts/fetch   ── trigger ingestion for a sky region       │
│  GET  /api/v1/subjects/next   ── serve next unretired subject to user     │
│  POST /api/v1/classify        ── submit classification marks              │
│  POST /api/v1/consensus/run   ── run DBSCAN + tracklet linking            │
│  GET  /api/v1/candidates/export ── download CSV / VOTable                 │
│                                                                           │
└───────────────────────────────┬────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Next.js + Canvas)                         │
│                                                                           │
│  ┌────────────────────────────────────────────────────────────────┐       │
│  │  Blink Comparator Canvas                                      │       │
│  │  ┌────────┐  ┌────────┐  ┌────────┐                           │       │
│  │  │ Epoch 1│  │ Epoch 2│  │ Epoch 3│  ← same band, same WCS   │       │
│  │  │ SWIR   │  │ SWIR   │  │ SWIR   │                           │       │
│  │  └────────┘  └────────┘  └────────┘                           │       │
│  │  [ ▶ Blink ]  [ Band: SWIR | MWIR | RGB ]  [ Mark ✚ ]       │       │
│  └────────────────────────────────────────────────────────────────┘       │
│                                                                           │
│  Annotation overlay · Onboarding tutorial · Dashboard · Discovery feed    │
│                                                                           │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| **Frontend** | Next.js 14 (React, TypeScript) | SSR for SEO, App Router for API routes, strong ecosystem. |
| **Canvas / Blink** | HTML5 Canvas + OpenSeadragon | Hardware-accelerated tile rendering with pan/zoom; proven in astronomy (ESA Sky). |
| **Backend API** | FastAPI (Python 3.12) | Async, auto-generated OpenAPI docs, natural fit with Astropy/NumPy data stack. |
| **Database** | PostgreSQL 16 + pgSphere | pgSphere provides native spherical-geometry operators (`spoint`, `scircle`, `sbox`) for RA/Dec queries without cos(Dec) errors. |
| **Cache / Rate-limit** | Redis 7 | In-memory session store, sliding-window rate limiter, leaderboard sorted sets. |
| **FITS Processing** | Astropy, reproject, Pillow | Standard astronomy I/O; `reproject_interp` for WCS alignment; Pillow for PNG/WebP export. |
| **Clustering** | scikit-learn DBSCAN | Well-understood, deterministic for fixed ε/minPts; haversine metric via custom distance. |
| **Object Store** | Local filesystem (dev) / S3-compatible (prod) | Tile PNGs and WCS JSON sidecars; S3 for production scalability. |
| **Containerization** | Docker + Docker Compose | Reproducible dev environment; single `docker compose up` to start all services. |
| **CI/CD** | GitHub Actions | Lint, test, build Docker images on push; deploy on tag. |

---

## Local Development Setup

### Prerequisites

| Tool | Minimum Version |
|------|----------------|
| Python | 3.12 |
| Node.js | 20 LTS |
| PostgreSQL | 16 |
| Redis | 7 |
| Docker & Docker Compose | 24+ / v2 |

### 1. Clone and configure environment

```bash
git clone https://github.com/<your-org>/AstroBlink.git
cd AstroBlink
cp .env.example .env          # then edit values below
```

Required `.env` variables:

```dotenv
# Database
DATABASE_URL=postgresql://astroblink:astroblink@localhost:5432/astroblink

# Redis
REDIS_URL=redis://localhost:6379/0

# SPHEREx S3 (anonymous access — no credentials needed)
SPHEREX_S3_BUCKET=nasa-irsa-spherex
SPHEREX_S3_REGION=us-east-1

# IRSA Cutout Service  [VERIFY exact base URL]
IRSA_CUTOUT_BASE_URL=https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts

# Tile storage (local path for dev)
TILE_STORE_PATH=./data/tiles

# App
SECRET_KEY=change-me-in-production
```

### 2. Start infrastructure (Docker)

```bash
docker compose up -d postgres redis
```

### 3. Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head           # run database migrations
uvicorn app.main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev                    # starts on http://localhost:3000
```

### 5. Verify it works

```bash
# Health check
curl http://localhost:8000/api/v1/health
# Expected: {"status": "ok", "db": "connected", "redis": "connected"}

# Fetch a test cutout (uses a known QR2 position)
curl -X POST http://localhost:8000/api/v1/cutouts/fetch \
  -H "Content-Type: application/json" \
  -d '{"ra": 180.0, "dec": 0.0, "size_deg": 0.1}'
# Expected: 202 Accepted with a job ID

# Open the UI
# Navigate to http://localhost:3000 — you should see the onboarding screen.
```

---

## Spectral Band Binning (How It Works)

SPHEREx uses Linear Variable Filters (LVFs) so that each pixel on a detector sees a different wavelength. The same sky position is observed at **different wavelengths on different dates** as the survey's scan pattern places it on different detector columns.

**Our binning pipeline (Ingestion Worker) handles this as follows:**

1. **Query exposures:** For a given sky cutout (RA, Dec, 0.1° box), retrieve all Level 2 exposures that overlap, across all epochs.
2. **Read WCS-WAVE:** For each exposure, use HDU 6 (`WCS-WAVE`) to look up the central wavelength (`CWAVE`) for every pixel in the cutout region.
3. **Select pixels by wavelength range:** For each composite band (e.g., SWIR 0.75–2.42 µm), keep only pixels whose `CWAVE` falls within that range.
4. **Group by epoch:** Separate exposures into epochs (Survey 1, 2, 3, 4) based on observation date.
5. **Reproject and co-add:** Within one epoch and one composite band, reproject all qualifying pixels onto a common WCS grid (tangent-plane projection centered on the cutout) using `reproject_interp`. Co-add with inverse-variance weighting using the VARIANCE HDU.
6. **Apply FLAGS mask:** Zero out any pixel with non-zero FLAGS (bits 0, 1, 2, 6, 7, 9, 25, 26, 27, 28, 29 — see reference). Undefined bits (3–5, 8, 10–24) are masked conservatively. Mark masked pixels with a distinct value for UI rendering.
7. **Suppress He airglow:** Additionally mask pixels whose `CWAVE` falls in 1.075–1.091 µm (the atmospheric He I 1.083 µm emission line).
8. **Normalize and render:** Stretch to asinh scale, render as PNG/WebP (< 250 KB), and write a JSON sidecar preserving the output WCS (CRPIX, CRVAL, CD matrix, NAXIS) for pixel↔RA/Dec mapping in the browser.

**Result:** For each subject, the browser receives (up to) 3 bands × 4 epochs = 12 lightweight images, all on identical pixel grids, ready for blink comparison.

---

## Data Attribution

This project uses data from:

- **NASA/IPAC Infrared Science Archive (IRSA)** — SPHEREx Level 2 calibrated spectral images and associated data products.
- **NASA's SPHEREx mission** — Spectro-Photometer for the History of the Universe, Epoch of Reionization, and Ices Explorer. PI: Dr. Jamie Bock (Caltech). Managed by NASA JPL.
- **AWS Open Data Program** — SPHEREx data hosted in S3 bucket `nasa-irsa-spherex`.

> *SPHEREx is a NASA Astrophysics Medium-class Explorer (MIDEX) mission. Data products are generated by the SPHEREx Science Data Center at Caltech/IPAC and archived at IRSA. If you use SPHEREx data in publications, please cite the mission and data release per the [IRSA SPHEREx acknowledgement guidelines](https://irsa.ipac.caltech.edu/data/SPHEREx/).*

---

## License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.

SPHEREx data products are subject to NASA's data use policies. This software does not redistribute raw FITS data; it provides a web interface for viewing pre-processed cutout imagery.

---

## Contributing

We welcome contributions! This project was built for the NASA Space Apps Challenge 2026 by a 6-person student team.

### Quick start for contributors

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`.
3. Follow the coding style enforced by the linters (ESLint for frontend, Ruff for backend).
4. Write tests for new functionality.
5. Submit a pull request with a clear description of the change.

### Team Roles

| # | Role | Scope |
|---|------|-------|
| 1 | Astronomy Data Engineer | S3/IRSA access, Astropy FITS parsing, spectral binning, tile rendering |
| 2 | Backend & Consensus Dev | FastAPI endpoints, PostgreSQL schema, DBSCAN consensus, VOTable export |
| 3 | Frontend Canvas Dev | Next.js app, OpenSeadragon/Canvas blink comparator, annotation tools |
| 4 | UI/UX & Gamification Lead | Onboarding tutorial, badges, discovery feed, responsive & accessible design |
| 5 | DevOps & Cloud Engineer | Docker, deployment, Redis cache, rate-limiting, CI/CD pipelines |
| 6 | Full-Stack Integrator & Team Lead | API contract ownership, code reviews, documentation, Space Apps submission |

See the [ROADMAP](docs/ROADMAP.md) for current priorities and how to pick up a task.

---

## Open Questions `[VERIFY]`

These items could not be fully verified against the reference files and require confirmation:

| ID | Question | Impact |
|----|----------|--------|
| OQ-1 | Exact IRSA SPHEREx Cutout Service API query-string parameters (endpoint URL, parameter names for position, size, band selection). | Ingestion worker HTTP client implementation. |
| OQ-2 | FLAGS bitmask bits 3–5, 8, 10–24 — meanings undocumented. Currently masked conservatively if set. | May over-mask valid pixels; revisit when IRSA publishes full bitmask documentation. |
| OQ-3 | S3 key layout for future DR1/DR2 releases — only `qr2/` and `qr3/` prefixes documented so far. | Ingestion worker's S3 key enumeration logic must be updated when new releases land. |
| OQ-4 | Exact IRSA Cutout Service base URL. Using `https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts` as placeholder. | `.env` configuration and ingestion worker. |