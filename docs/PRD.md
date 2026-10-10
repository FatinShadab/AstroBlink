# AstroBlink — Product Requirements Document (PRD)

> **Project:** AstroBlink · NASA Space Apps Challenge 2026 · "Planet X and SPHEREx" track
> **Version:** 1.0 · **Date:** 2026-10-10
> **Authors:** AstroBlink Team (6 CSE students)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Problem Statement](#2-problem-statement)
3. [Personas](#3-personas)
4. [Functional Requirements (FR-1 – FR-5)](#4-functional-requirements)
5. [Non-Functional Requirements](#5-non-functional-requirements)
6. [Ingestion Pipeline Specification](#6-ingestion-pipeline-specification)
7. [Edge Cases & Mitigations](#7-edge-cases--mitigations)
8. [Out of Scope](#8-out-of-scope)
9. [Success Metrics](#9-success-metrics)
10. [Open Questions](#10-open-questions)

---

## 1. Executive Summary

AstroBlink is a citizen-science web application that enables public volunteers to visually inspect multi-epoch infrared sky images from NASA's SPHEREx mission. Using a digital blink comparator, participants identify objects that move between epochs (asteroids, comets, Kuiper Belt Objects, hypothetical Planet X) or exhibit anomalous infrared colors (brown dwarfs, ultra-cool sub-stellar objects). Classifications from multiple independent volunteers are aggregated through spatial clustering and tracklet-linking algorithms to produce consensus-validated candidates. Professional astronomers review these candidates and export them as catalog-ready VOTable files.

The platform addresses the "Planet X and SPHEREx" challenge by combining:

- **Spectral binning** — collapsing SPHEREx's 102 LVF-based channels into three science-optimized composite bands (SWIR, MWIR, false-color RGB) suitable for web delivery.
- **Micro-tasking** — decomposing the all-sky survey into 0.1° × 0.1° cutout subjects, each completable in 15–30 seconds.
- **Statistical consensus** — requiring 10 independent classifications per subject and applying DBSCAN clustering with reliability weighting to suppress noise and spam.

---

## 2. Problem Statement

SPHEREx maps the entire sky every six months across 102 infrared spectral channels, generating ~1.4 trillion spectral-spatial voxels per pass. Solar System bodies (NEAs, KBOs, comets) and nearby cold objects (brown dwarfs) reveal themselves through positional shifts between epochs or distinctive infrared spectral signatures — but they are buried among billions of static sources and numerous detector artifacts (cosmic-ray snowballs, He airglow banding, satellite streaks, frame-edge ghosts).

**No automated pipeline alone can reliably separate all real movers from artifacts at the faint end.** Human visual pattern recognition excels at distinguishing genuine point-source displacement from correlated noise — a fact demonstrated by Zooniverse projects like *Backyard Worlds: Planet 9* and *Planet Hunters*. However, there is currently **no public-facing tool** that presents SPHEREx multi-epoch imagery in a blink-comparison format optimized for volunteer classification.

AstroBlink closes this gap by:

1. Pre-processing raw LVF spectral images into artifact-masked, band-composited, WCS-aligned cutout tiles.
2. Serving them through an intuitive blink comparator with annotation tools.
3. Aggregating volunteer classifications into scientifically useful candidate catalogs.

---

## 3. Personas

### Persona 1: Curious Citizen Scientist — "Maya"

| Attribute | Detail |
|-----------|--------|
| **Background** | High-school senior, interested in space, no formal astronomy training. |
| **Technical skill** | Comfortable with web apps on phone and laptop; no command-line experience. |
| **Goals** | Contribute to real NASA science; earn badges; possibly discover something named after her. |
| **Pain points** | Overwhelmed by jargon ("LVF", "MJy/sr"); loses interest if the first task isn't immediately understandable; frustrated by slow-loading images on mobile data. |
| **What AstroBlink provides** | Interactive onboarding tutorial with labeled examples; mobile-responsive blink UI; gamification (badges, streak counter, discovery feed); plain-language explanations of what each band shows. |

### Persona 2: Amateur Astronomer — "Raj"

| Attribute | Detail |
|-----------|--------|
| **Background** | Software engineer by day; owns a 10″ Dobsonian; active on Cloudy Nights forum; has used Aladin and DS9. |
| **Technical skill** | Can read FITS headers; understands RA/Dec, magnitudes, proper motion. |
| **Goals** | Hunt for faint KBOs and brown dwarfs in MWIR; cross-reference marks with known catalogs; contribute to a peer-reviewed discovery. |
| **Pain points** | Wants more than just "tap to mark" — wants to see the WCS coordinates of his marks, overlay catalog positions, and filter by galactic latitude. Annoyed if masked pixels aren't clearly indicated (he'll mistake hatched regions for real objects). |
| **What AstroBlink provides** | RA/Dec readout on cursor; visible mask hatching for flagged pixels; band selector (SWIR/MWIR/RGB); export of personal classification history; optional advanced settings (DBSCAN ε, minimum epochs). |

### Persona 3: Research Astrophysicist — "Dr. Chen"

| Attribute | Detail |
|-----------|--------|
| **Background** | Postdoc at a university astronomy department; studies outer Solar System dynamics; needs spectrophotometry of KBO candidates. |
| **Technical skill** | Expert in Python/Astropy, database queries, VOTable/SAMP; writes papers, not frontends. |
| **Goals** | Receive a vetted candidate list with sky coordinates, motion vectors, and per-epoch thumbnails; cross-match against MPC and JPL Horizons; download a VOTable she can ingest into TOPCAT. |
| **Pain points** | Distrusts unvetted crowd data; needs to see per-user reliability scores and raw classification counts; wants to set custom consensus thresholds before exporting. Wasted time if candidates are dominated by artifacts the pipeline should have caught. |
| **What AstroBlink provides** | `/api/v1/candidates/export` endpoint with CSV and IVOA-compliant VOTable; consensus summary including cluster size, mean position, dispersion, reliability-weighted score; configurable export filters (min classifications, min reliability, max dispersion); per-candidate epoch thumbnails in the professional review dashboard. |

---

## 4. Functional Requirements

### FR-1: Subject Ingestion & Spectral Binning

**Statement:** The system shall ingest SPHEREx Level 2 MEF FITS data, bin the 102 LVF channels into three composite bands, and produce web-deliverable tile images with WCS metadata.

| AC # | Acceptance Criterion | Owner |
|------|---------------------|-------|
| FR-1.1 | The ingestion worker retrieves Level 2 FITS files from S3 bucket `nasa-irsa-spherex` (anonymous access, `us-east-1`) or via the IRSA Cutout Service for a specified (RA, Dec, size) region. `[VERIFY: exact IRSA Cutout API parameters — see OQ-1]` | Role 1 |
| FR-1.2 | For each exposure, the worker reads the `WCS-WAVE` HDU (HDU 6) to determine per-pixel central wavelength (`CWAVE`), and selects pixels by wavelength range for each composite band: **SWIR** (0.75–2.42 µm), **MWIR** (3.8–5.0 µm), **False-color RGB** (B ≈ 1.0 µm, G ≈ 2.0 µm, R ≈ 4.0 µm). | Role 1 |
| FR-1.3 | The worker groups qualifying exposures by epoch (each ~6-month all-sky pass), then reprojects all pixels for a given (epoch, band) combination onto a common tangent-plane WCS grid using `reproject_interp`. Co-addition uses inverse-variance weighting from the VARIANCE HDU (HDU 3). | Role 1 |
| FR-1.4 | Pixels with any non-zero FLAGS bit (HDU 2) are masked. Known bits: 0 (TRANSIENT), 1 (OVERFLOW), 2 (SUR_ERROR), 6 (NONFUNC), 7 (DICHROIC), 9 (MISSING_DATA), 25 (STREAK), 26 (BLOOM), 27 (SNOWBALL), 28 (HALO), 29 (SATELLITE_HALO). Undefined bits (3–5, 8, 10–24) are also masked conservatively. `[VERIFY: undefined bit meanings — see OQ-2]` | Role 1 |
| FR-1.5 | Pixels with `CWAVE` in the range 1.075–1.091 µm are additionally masked to suppress atmospheric He I 1.083 µm airglow emission. | Role 1 |
| FR-1.6 | Masked pixels are encoded with a distinct visual indicator (e.g., semi-transparent red hatching) in the rendered tile so users can distinguish masked regions from empty sky. | Role 1, Role 3 |
| FR-1.7 | Output tiles are PNG or WebP, **< 250 KB per epoch per band**, with an accompanying JSON sidecar containing the output WCS (CRPIX, CRVAL, CD matrix, NAXIS1, NAXIS2) enabling pixel↔RA/Dec conversion in the browser. | Role 1 |
| FR-1.8 | Blink comparison shall only compare images of the **same band** and the **same cutout geometry** (identical WCS grid). The reprojection step in FR-1.3 guarantees pixel-grid alignment. | Role 1 |
| FR-1.9 | Each processed cutout is stored as a **subject** record in the database with: sky position (RA, Dec), cutout size, available epoch list, tile URLs per (epoch, band), and a `retired` flag (default `false`). | Role 1, Role 2 |

### FR-2: Blink Comparator & Classification UI

**Statement:** The system shall present volunteers with a blink comparator that animates same-band, same-geometry cutout tiles across epochs and collects classification marks.

| AC # | Acceptance Criterion | Owner |
|------|---------------------|-------|
| FR-2.1 | The blink comparator displays tiles for a single subject in a looping animation (frame rate: 0.5–2 Hz, user-adjustable) or via a manual slider. Only tiles of the same band are shown simultaneously. | Role 3 |
| FR-2.2 | The user can switch between bands (SWIR, MWIR, false-color RGB) via a toggle. Switching bands does not change the cutout geometry. | Role 3 |
| FR-2.3 | A click/tap on the canvas during any epoch frame places a positional mark. The mark is recorded with: (pixel_x, pixel_y) converted to (RA, Dec) using the JSON WCS sidecar, the epoch index, and a timestamp. | Role 3 |
| FR-2.4 | After marking, the user selects a category: *Asteroid/NEO*, *Comet*, *Brown Dwarf*, *Planet X Candidate*, or *Artifact*. A "Nothing here" option submits an empty classification. | Role 3, Role 4 |
| FR-2.5 | A classification consists of all marks placed by one user on one subject. Submitting a classification is atomic (all marks or none). The backend records it with the user ID, subject ID, list of marks, category, and submission timestamp. | Role 2, Role 3 |
| FR-2.6 | The same subject is never shown to the same user twice. Each subject is served to users independently until it reaches retirement (default: 10 classifications). | Role 2 |
| FR-2.7 | Cursor position displays live (RA, Dec) coordinates computed client-side from the WCS sidecar. | Role 3 |
| FR-2.8 | Pan and zoom are supported via OpenSeadragon or equivalent, preserving annotation overlay alignment. | Role 3 |

### FR-3: Consensus Pipeline

**Statement:** The system shall aggregate classifications using per-epoch spatial clustering, cross-epoch tracklet linking, and per-user reliability weighting to produce validated candidates.

| AC # | Acceptance Criterion | Owner |
|------|---------------------|-------|
| FR-3.1 | When a subject reaches retirement (10 classifications), the consensus pipeline is triggered (manually via `/api/v1/consensus/run` or automatically). | Role 2 |
| FR-3.2 | **Per-epoch clustering:** Volunteer marks for each epoch are clustered independently using DBSCAN with **angular distance (haversine formula)** as the metric. The implementation handles RA wraparound at 0°/360° and cos(Dec) scaling correctly. Euclidean RA/Dec distance is explicitly prohibited. | Role 2 |
| FR-3.3 | **DBSCAN ε parameter:** Default ε = 1.5 × pixel scale ≈ **9.2″** (1.5 pixels at 6.15″/pixel). This is above the sub-pixel threshold (< 6.15″) to avoid rejecting honest clicks, and below the cutout scale to avoid merging distinct sources. ε is configurable per consensus run. | Role 2 |
| FR-3.4 | **DBSCAN minPts parameter:** Default `minPts = 3` (at least 3 of 10 classifiers must agree on a position for it to form a cluster). Configurable. | Role 2 |
| FR-3.5 | **Tracklet linking:** Per-epoch clusters are linked across epochs into motion tracklets. Two clusters in consecutive epochs are linked if their centroids are separated by an angular distance consistent with plausible proper motion (configurable max displacement per epoch, default: 30″ for outer Solar System objects). Linkage produces a tracklet with a position sequence and implied motion vector. | Role 2 |
| FR-3.6 | **Reliability weighting:** Each user has a reliability score (0.0–1.0), initialized at 0.5. The score is updated based on performance on **gold-standard subjects** — subjects seeded with known asteroids/comets from MPC or JPL Horizons. A user's marks are weighted by their reliability score before DBSCAN clustering. | Role 2 |
| FR-3.7 | Gold-standard subjects are indistinguishable from regular subjects in the UI. At least 5% of subjects served are gold-standard. | Role 2, Role 1 |
| FR-3.8 | A **candidate** record is created for each validated tracklet, storing: mean RA/Dec per epoch, motion vector (arcsec/epoch), cluster dispersion, number of contributing classifications, mean reliability-weighted score, category consensus, and a status field (`new`, `under_review`, `confirmed`, `rejected`). | Role 2 |
| FR-3.9 | **(Stretch goal — Adaptive retirement):** Subjects where all classifications received so far are unanimous "Nothing here" may retire early at 5 classifications instead of 10, freeing classifier bandwidth for more promising subjects. | Role 2 |

### FR-4: Professional Review & Export

**Statement:** The system shall provide professional astronomers with tools to review consensus candidates and export them in standard catalog formats.

| AC # | Acceptance Criterion | Owner |
|------|---------------------|-------|
| FR-4.1 | A review dashboard lists candidates sortable/filterable by: status, motion magnitude, cluster size, reliability score, sky region, category. | Role 3, Role 2 |
| FR-4.2 | Each candidate detail page shows: per-epoch thumbnail tiles (all bands), overlay of volunteer mark positions, cluster centroids, motion vector arrow, and raw classification counts. | Role 3 |
| FR-4.3 | Authorized reviewers (role: `astronomer`) can change candidate status to `confirmed` or `rejected` with a text rationale. | Role 2 |
| FR-4.4 | `GET /api/v1/candidates/export?format=csv` returns a CSV file with columns: `candidate_id, ra_epoch1, dec_epoch1, ..., ra_epochN, dec_epochN, motion_arcsec_per_epoch, motion_pa_deg, n_classifications, mean_reliability, category, status`. | Role 2 |
| FR-4.5 | `GET /api/v1/candidates/export?format=votable` returns an IVOA-compliant VOTable (version 1.4) with the same columns, proper UCDs (`pos.eq.ra`, `pos.eq.dec`, `pos.pm`), and unit annotations. | Role 2 |

### FR-5: Onboarding, Gamification & Accessibility

**Statement:** The system shall onboard new users with an interactive tutorial, sustain engagement with gamification, and meet accessibility standards.

| AC # | Acceptance Criterion | Owner |
|------|---------------------|-------|
| FR-5.1 | First-time users are presented with a mandatory interactive tutorial (skippable after first completion) that teaches: what the blink comparator shows, how to identify a real mover vs. an artifact, how to place marks, and what each band represents. The tutorial uses annotated example cutouts including a known asteroid and a cosmic-ray artifact. | Role 4 |
| FR-5.2 | Users earn badges for milestones: first classification, 10/50/100/500 classifications, first gold-standard hit, classification streak (7 consecutive days). Badge definitions are stored in the database and rendered in the user profile. | Role 4, Role 2 |
| FR-5.3 | A **discovery feed** on the landing page shows recent confirmed candidates with thumbnails, discoverer usernames (if opted in), and brief descriptions. | Role 4, Role 3 |
| FR-5.4 | A leaderboard ranks users by classification count (all-time and weekly). Leaderboard data is served from Redis sorted sets for performance. | Role 4, Role 5 |
| FR-5.5 | The UI is responsive (functional on viewports ≥ 375 px width) and meets **WCAG 2.1 Level AA** for color contrast, keyboard navigation, and screen-reader labels on all interactive elements. | Role 4, Role 3 |
| FR-5.6 | All text labels in the classification UI avoid technical jargon unless accompanied by a tooltip explanation. | Role 4 |

---

## 5. Non-Functional Requirements

### NFR-1: Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Tile load time** | < 500 ms (P95) for a single epoch/band PNG on a 10 Mbps connection. | Synthetic monitoring (Lighthouse, k6). |
| **Blink frame rate** | Sustained 2 Hz animation (500 ms per frame) without dropped frames on a mid-range 2023 smartphone. | Manual test on reference device (e.g., Pixel 7a). |
| **Classification submit latency** | < 300 ms (P95) from button press to server acknowledgment. | API response time logged server-side. |
| **Subject queue fetch** | < 200 ms (P95) to serve the next unretired subject. | API response time. |
| **Tile file size** | < 250 KB per epoch per band (PNG/WebP). | Enforced by ingestion worker; CI check on sample outputs. |
| **Consensus run time** | < 5 s for a single subject with 10 classifications. | Backend benchmark. |

### NFR-2: Security

| Requirement | Implementation |
|-------------|---------------|
| **Authentication** | OAuth 2.0 via Google / GitHub; optional anonymous guest mode (classifications tagged as low-reliability, not counted toward consensus until account linked). |
| **Authorization** | Role-based: `volunteer` (classify), `astronomer` (review + export), `admin` (manage subjects, users, config). JWT access tokens (15 min TTL) + refresh tokens (7-day TTL). |
| **Rate limiting** | Sliding-window rate limit: 60 classification submissions per user per hour; 120 API calls per minute per IP for unauthenticated endpoints. Enforced via Redis. |
| **Input validation** | All marks validated server-side: RA ∈ [0°, 360°), Dec ∈ [−90°, +90°], epoch index within subject's available epochs. Reject out-of-bounds or malformed payloads with 422. |
| **Data integrity** | Classifications are append-only (no edits/deletes by volunteers). Candidate status changes are audit-logged with user ID and timestamp. |
| **HTTPS** | All traffic over TLS 1.2+. HSTS header enforced. |

### NFR-3: Reliability & Availability

| Requirement | Target |
|-------------|--------|
| **Uptime** | 99% during hackathon demo; 99.5% for beta. (No SLA for MVP.) |
| **Data durability** | PostgreSQL with daily automated `pg_dump` backups to object storage. |
| **Graceful degradation** | If S3 or IRSA is unreachable, ingestion jobs fail with retry (exponential backoff, max 3 retries). Existing subjects remain classifiable. Dashboard shows a banner indicating ingestion is paused. |
| **Idempotent ingestion** | Re-ingesting the same (RA, Dec, epoch) does not create duplicate subjects. Deduplication by sky position (within 1″ tolerance) and epoch. |

### NFR-4: Accessibility

| Requirement | Standard |
|-------------|----------|
| **Color contrast** | All text and interactive elements meet WCAG 2.1 AA (≥ 4.5:1 for body text, ≥ 3:1 for large text). |
| **Keyboard navigation** | Full classification flow completable via keyboard alone (Tab, Enter, Arrow keys). |
| **Screen reader** | All images have descriptive `alt` text; blink animation can be paused; marks announced via ARIA live regions. |
| **Motion sensitivity** | `prefers-reduced-motion` media query disables auto-blink; user controls frame advance manually. |

### NFR-5: Scalability (Stretch)

| Requirement | Target |
|-------------|--------|
| **Concurrent users** | Support 200 simultaneous classifiers without performance degradation. |
| **Subject catalog** | Handle up to 100,000 subjects without schema or query performance issues. |
| **Horizontal scaling** | Backend is stateless (session in Redis); can add API replicas behind a load balancer. |

---

## 6. Ingestion Pipeline Specification

**Owner:** Role 1 (Astronomy Data Engineer), with Role 5 (DevOps) for queue infrastructure.

### 6.1 Pipeline Overview

```
Trigger (API or scheduled)
  │
  ▼
┌─────────────────────────────────────────────────────────┐
│  Step 1: RESOLVE TARGET                                  │
│  Input: (RA, Dec, size_deg)                             │
│  Output: list of L2 FITS exposure keys overlapping      │
│          the target, grouped by epoch                    │
│  Method:                                                 │
│    a) Query IRSA Cutout Service [VERIFY: OQ-1] OR       │
│    b) Query S3 index of L2 files + filter by WCS         │
│       footprint intersection (Astropy WCS.footprint)     │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Step 2: FETCH & PARSE MEF FITS                          │
│  For each exposure:                                      │
│    - Download from S3 (boto3, botocore.UNSIGNED)         │
│      OR receive cutout from IRSA                         │
│    - Open with astropy.io.fits                           │
│    - Extract HDUs: IMAGE (1), FLAGS (2), VARIANCE (3),   │
│      WCS-WAVE (6)                                        │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Step 3: WAVELENGTH SELECTION & MASKING                  │
│  For each pixel (x, y) in the cutout region:             │
│    cwave = WCS_WAVE_TABLE.lookup(x, y)  # central λ     │
│    flag  = FLAGS[y, x]                                   │
│                                                          │
│    MASK pixel if:                                        │
│      flag != 0                        (any flag set)     │
│      OR cwave ∈ [1.075, 1.091] µm    (He airglow)       │
│                                                          │
│    ASSIGN pixel to band(s):                              │
│      if 0.75 ≤ cwave ≤ 2.42  → SWIR                     │
│      if 3.80 ≤ cwave ≤ 5.00  → MWIR                     │
│      if 0.95 ≤ cwave ≤ 1.05  → RGB-B channel            │
│      if 1.90 ≤ cwave ≤ 2.10  → RGB-G channel            │
│      if 3.90 ≤ cwave ≤ 4.10  → RGB-R channel            │
│                                                          │
│    Note: RGB sub-band ranges are narrow windows          │
│    centered on the target wavelengths. Width is ±0.1 µm  │
│    to capture sufficient pixels. [VERIFY: optimal width] │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Step 4: EPOCH GROUPING                                  │
│  Determine epoch from observation date in FITS header:   │
│    Survey 1: 2025-05-01 to 2025-10-31                    │
│    Survey 2: 2025-11-01 to 2026-05-31                    │
│    Survey 3: 2026-06-01 to 2026-12-31                    │
│    Survey 4: 2027-01-01 to 2027-06-30                    │
│  (Exact date boundaries [VERIFY] from mission timeline)  │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Step 5: REPROJECT & CO-ADD                              │
│  For each (epoch, band):                                 │
│    - Define output WCS: TAN projection centered on       │
│      (RA, Dec), pixel scale = 6.15″, NAXIS = cutout     │
│      size / pixel scale                                  │
│    - For each qualifying exposure:                       │
│        reproject_interp(image_data, input_wcs,           │
│                         output_wcs)                      │
│    - Co-add reprojected pixels with weights =            │
│      1 / VARIANCE (inverse-variance weighting)           │
│    - Propagate mask: output pixel masked if ALL          │
│      contributing input pixels were masked               │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Step 6: RENDER TILES                                    │
│  For each (epoch, band) co-added image:                  │
│    - Apply asinh stretch (Lupton et al.) for dynamic     │
│      range compression                                   │
│    - For false-color RGB: map B/G/R channels to          │
│      blue/green/red; apply per-channel percentile        │
│      normalization (2nd–99th percentile)                  │
│    - Render masked pixels with distinct hatching pattern  │
│      (semi-transparent red diagonal lines)               │
│    - Encode as PNG or WebP, target < 250 KB              │
│    - If file exceeds 250 KB: increase WebP quality       │
│      reduction or downsample (warn in logs)              │
│    - Write JSON WCS sidecar:                             │
│      {                                                   │
│        "crpix": [cx, cy],                                │
│        "crval": [ra_center, dec_center],                 │
│        "cd": [[cd1_1, cd1_2], [cd2_1, cd2_2]],          │
│        "naxis": [nx, ny],                                │
│        "ctype": ["RA---TAN", "DEC--TAN"]                 │
│      }                                                   │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Step 7: PERSIST SUBJECT                                 │
│  - Store tiles + WCS JSON in object store                │
│  - INSERT subject row into PostgreSQL:                   │
│      (ra, dec, size_deg, epochs[], tile_urls{},          │
│       is_gold_standard, retired=false)                   │
│  - Deduplication: if a subject within 1″ of (RA, Dec)   │
│    already exists for the same epochs, skip or update    │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Handling LVF Wavelength-Position Coupling

The core challenge of SPHEREx data is that the same sky position is observed at **different wavelengths on different dates**, because the LVF maps wavelength to detector column position and the survey scan pattern places targets on different columns across visits.

**Our approach:** We do not try to extract a single wavelength per position. Instead, we collect *all* exposures that cover the target position, read the per-pixel wavelength from `WCS-WAVE`, and bin pixels by wavelength range into composite bands. This means:

- A given pixel in the output SWIR tile may be constructed from multiple exposures where the target happened to fall on detector columns with wavelengths in 0.75–2.42 µm.
- Not every exposure contributes to every band. An exposure where the target position falls at λ = 3.0 µm contributes to neither SWIR nor MWIR (it falls in the 2.42–3.80 µm gap — see conflict V7 in README).
- Some (epoch, band) combinations may have **zero contributing exposures** if the target was never observed at wavelengths in that band's range during that epoch. This is handled as a missing-epoch edge case (§7).

### 6.3 Auroral & Airglow Masking Detail

Beyond the primary He I 1.083 µm mask, the following atmospheric emission lines (from `irsa_dataset_and_access.md` §5) are masked with ±0.01 µm windows when they fall within a composite band range:

| Emission | λ (µm) | Affected band |
|----------|--------|---------------|
| O I / OH | 0.78 | SWIR |
| O I | 0.84 | SWIR |
| H₂O | 0.93 | SWIR, RGB-B edge |
| **He I** | **1.083** | **SWIR, RGB-B** (primary mask) |
| OH | 1.13 | SWIR |
| OH | 1.81 | SWIR |
| H₂O / CO₂ | 2.63 | Near SWIR boundary |
| CO₂ | 2.75 | In 2.42–3.8 µm gap (not in any composite band) |
| CO₂ | 4.03 | MWIR, RGB-R |
| CO | 4.64 | MWIR |

---

## 7. Edge Cases & Mitigations

### EC-1: Missing Epochs

| Scenario | A subject has < 4 epochs because the target was not observed in all survey passes, or no exposures contributed to the selected band for a given epoch (LVF coverage gap). |
|----------|-------------|
| **Mitigation** | The subject is still classifiable with available epochs (minimum 2 for motion detection). The UI labels each frame with its epoch number and greys out missing epochs in the band selector. The consensus pipeline's tracklet linker operates on whatever epochs are present; candidates from 2-epoch tracklets are flagged as `low_confidence`. |
| **Owner** | Role 1, Role 2, Role 3 |

### EC-2: Saturation & Bright-Star Contamination

| Scenario | A bright star causes OVERFLOW (bit 1) and BLOOM (bit 26) flags across a large region, masking most of the cutout. |
|----------|-------------|
| **Mitigation** | If > 60% of a cutout's pixels are masked in any epoch, the subject is auto-flagged as `heavily_masked` and deprioritized in the classification queue (served only after less-masked subjects are exhausted). The UI shows a warning banner: "This region is heavily affected by a bright star." |
| **Owner** | Role 1, Role 2 |

### EC-3: Spam & Bot Classifications

| Scenario | A malicious user or bot submits rapid, random classifications to game the leaderboard or pollute consensus. |
|----------|-------------|
| **Mitigation** | (1) Rate limiting: 60 classifications/hour/user. (2) Gold-standard subjects detect random clickers — a user who fails > 50% of gold-standard subjects within a sliding window of 20 gold encounters has their reliability score floored to 0.05, effectively nullifying their vote weight. (3) CAPTCHA challenge on account creation. (4) Anonymous/guest classifications are excluded from consensus until the account is linked. (5) Server-side timing: classifications submitted < 3 seconds after subject load are flagged as suspicious and excluded from consensus. |
| **Owner** | Role 2, Role 5 |

### EC-4: Low-Quality Classifiers

| Scenario | Well-intentioned users consistently misidentify artifacts as real objects, or vice versa. |
|----------|-------------|
| **Mitigation** | The reliability-weighting system (FR-3.6) naturally down-weights inaccurate classifiers via gold-standard feedback. Users with reliability < 0.2 are prompted to retake the tutorial. Their classifications are still recorded (for transparency) but receive negligible weight in clustering. |
| **Owner** | Role 2, Role 4 |

### EC-5: Duplicate Subjects

| Scenario | Two ingestion requests overlap spatially, producing cutouts that cover the same sky region in the same epochs. |
|----------|-------------|
| **Mitigation** | Deduplication at ingestion time: before creating a new subject, query for existing subjects within 1″ of the target center. If a match with the same epoch set exists, skip. If a match exists but with additional epochs (new data release), update the existing subject with new tiles and reset its retired flag. |
| **Owner** | Role 1, Role 2 |

### EC-6: S3 / IRSA Service Outage

| Scenario | AWS S3 bucket `nasa-irsa-spherex` or the IRSA Cutout Service is temporarily unreachable. |
|----------|-------------|
| **Mitigation** | Ingestion jobs retry with exponential backoff (initial: 5 s, max: 5 min, max retries: 3). On persistent failure, the job is marked `failed` in the queue and an admin alert is emitted. Existing subjects in the database remain fully classifiable — the outage only blocks new ingestion. A status banner on the UI indicates "New sky regions are temporarily unavailable." |
| **Owner** | Role 1, Role 5 |

### EC-7: RA Wraparound in Clustering

| Scenario | A subject straddles RA = 0°/360° boundary, causing naïve RA differences to produce ~360° errors. |
|----------|-------------|
| **Mitigation** | The DBSCAN distance function uses the haversine formula on (RA, Dec), which inherently handles wraparound. All RA comparisons go through this function; no code path uses Euclidean RA difference. pgSphere `spoint` operators also handle wraparound natively. |
| **Owner** | Role 2 |

### EC-8: Very High Proper Motion Objects

| Scenario | A nearby NEA moves so far between epochs (>> 30″) that tracklet linking with the default max-displacement threshold fails to connect per-epoch clusters. |
|----------|-------------|
| **Mitigation** | The max-displacement threshold is configurable. For NEA-focused campaigns, operators can increase it. Additionally, isolated (unlinked) per-epoch clusters with high cluster confidence (≥ 7/10 classifiers) are flagged as `unlinked_candidate` for manual review, not discarded. |
| **Owner** | Role 2 |

---

## 8. Out of Scope

The following are explicitly **not** part of AstroBlink's requirements:

| Item | Rationale |
|------|-----------|
| **Automated ML-based motion detection** | The project is a citizen-science platform; ML classification is a complement, not a replacement. May be a future enhancement. |
| **Raw FITS download or display** | Raw multi-channel FITS are never sent to the browser (constraint §4.A). The platform serves pre-rendered tiles only. |
| **Spectral extraction / SED fitting** | AstroBlink identifies movers and color anomalies; detailed spectrophotometric analysis is left to IRSA tools (The Tractor) and professional pipelines. |
| **Orbital element fitting** | Computing orbits from tracklets requires > 3 epochs and specialized astrodynamics software (e.g., Find_Orb). AstroBlink provides position/motion data; orbit determination is downstream. |
| **Real-time transient alerts** | SPHEREx data releases are not real-time. The platform operates on released data products (QR2, QR3, DR1, DR2). |
| **Mobile native app** | The web UI is responsive down to 375 px, but no native iOS/Android app is planned. |
| **User-uploaded images** | Volunteers classify SPHEREx data only; uploading personal observations is not supported. |
| **Multi-language / i18n** | English only for MVP and beta. Internationalization is a post-challenge stretch goal. |

---

## 9. Success Metrics

### Hackathon Demo (Phase 1)

| Metric | Target |
|--------|--------|
| **Working blink comparator** | Loads and animates ≥ 3 epochs of ≥ 1 subject in all 3 bands. |
| **End-to-end classification** | A volunteer can mark, categorize, and submit a classification; the mark persists in the database. |
| **Ingestion proof** | ≥ 10 subjects ingested from real SPHEREx S3 data (QR2 or QR3). |

### Beta (Phase 2)

| Metric | Target |
|--------|--------|
| **Volunteer adoption** | ≥ 50 registered users; ≥ 500 total classifications within 2 weeks of beta launch. |
| **Consensus pipeline** | Consensus runs on ≥ 100 retired subjects; produces ≥ 5 candidate records. |
| **Gold-standard accuracy** | Mean volunteer accuracy on gold-standard subjects ≥ 70%. |
| **Task completion time** | Median classification time (load-to-submit) ≤ 30 seconds. |

### Production (Phase 3)

| Metric | Target |
|--------|--------|
| **Subject coverage** | ≥ 10,000 subjects covering ≥ 5% of the sky. |
| **Candidate catalog** | ≥ 1 confirmed candidate cross-matched with MPC or JPL Horizons as a known or new minor body. |
| **Professional adoption** | ≥ 3 professional astronomer accounts performing reviews and exports. |
| **VOTable compliance** | Exported VOTable validates against IVOA VOTable 1.4 schema without errors. |
| **Accessibility** | Lighthouse accessibility score ≥ 90. |

---

## 10. Open Questions

| ID | Question | Origin | Impact |
|----|----------|--------|--------|
| OQ-1 | Exact IRSA SPHEREx Cutout Service API query-string parameters (endpoint URL, parameter names for position, size, band/detector selection). | `[VERIFY]` from prompt §4.C | Ingestion worker HTTP client; FR-1.1 implementation. |
| OQ-2 | FLAGS bitmask bits 3–5, 8, 10–24 — meanings undocumented. Currently masked conservatively (any set bit → mask). | `[VERIFY]` from prompt §4.B | May over-mask valid pixels, reducing effective coverage. Revisit when IRSA publishes full bitmask spec. |
| OQ-3 | S3 key layout for future DR1/DR2 releases — only `qr2/` and `qr3/` prefixes documented. | `[VERIFY]` from prompt §4.C | Ingestion worker S3 key enumeration; may need config update per release. |
| OQ-4 | Exact IRSA Cutout Service base URL. Using `https://irsa.ipac.caltech.edu/cgi-bin/Cutouts/nph-cutouts` as placeholder. | `[VERIFY]` inferred | `.env` configuration; FR-1.1. |
| OQ-5 | Optimal width of RGB sub-band wavelength windows (currently ±0.1 µm around target λ). Narrower windows give purer color but fewer contributing pixels. | Design decision | FR-1.2; false-color tile quality. |
| OQ-6 | Exact epoch date boundaries — pipeline §6.1 Step 4 uses approximate 6-month windows. Actual survey pass start/end dates depend on mission operations. | `[VERIFY]` against mission timeline | Epoch grouping correctness; FR-1.3. |
| OQ-7 | Whether the IRSA Cutout Service preserves all 6 MEF HDUs in returned cutouts, or only a subset. | `[VERIFY]` — reference says "preserving all six HDUs and WCS geometry" but this needs runtime confirmation. | If VARIANCE or WCS-WAVE HDUs are missing from cutouts, we must fall back to full-frame S3 download. |
