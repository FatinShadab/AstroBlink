# AstroBlink — Project Overview & Scientific Rationale

**Purpose:** Comprehensive overview of AstroBlink's purpose, astronomical science foundation, SPHEREx mission mechanics, detectability limits, team role assignments, and hackathon context.  
**Last-Verified Date:** `2026-10-13`  
**Audited Commit:** `cc39991`  

---

## 1. What AstroBlink Is and Who It Is For

AstroBlink is an open-source citizen-science web application designed to enable public volunteers, amateur astronomers, and research astrophysicists to discover moving Solar System bodies and exotic infrared transients within NASA SPHEREx mission data [REPORTED: `docs/PRD.md` §1].

### Target Personas [REPORTED: `docs/PRD.md` §3]

| Persona | Archetype | Motivation | Key System Feature Utilized |
| :--- | :--- | :--- | :--- |
| **"Maya"** | High-school student / Citizen Scientist | Curiosity, NASA science engagement, gamification badges. | Simple auto-blinking canvas, clear binary/category selection, mobile responsiveness, visual defect hatching. |
| **"Raj"** | Amateur Astronomer / Equipment Owner | Hunting faint KBOs/brown dwarfs, cross-matching sky coordinates. | Live WCS RA/Dec readouts, multi-band switching (1.0, 2.0, 4.0 µm, RGB), explicit mask overlays. |
| **"Dr. Chen"** | Research Astrophysicist | Acquiring vetted candidate catalogs for follow-up observation. | Reliability-weighted DBSCAN consensus catalogs, CSV and IVOA VOTable 1.4 exports. |

---

## 2. What Is SPHEREx?

SPHEREx (Spectro-Photometer for the History of the Universe, Epoch of Reionization and Ices Explorer) is a NASA Medium-Class Explorer (MIDEX) mission designed to perform an all-sky near-infrared spectral survey [REPORTED: `docs/spherex_mission_overview.md`].

### Core Mission Facts [VERIFIED: `docs/VERIFIED_FACTS.md` §3–§5]
- **All-Sky Survey Cadence:** Maps the entire sky every ~6 months across four planned survey epochs.
- **Spectral Coverage:** 102 distinct spectral channels spanning $0.75\text{ to }5.00\text{ }\mu\text{m}$.
- **Focal Plane Arrays:** 6 detector arrays (`1D1` through `4D6`), each equipped with a Linear Variable Filter (LVF).
- **Pixel Scale:** 
  - Nominal detector pixel scale: **$6.15\text{ arcsec/pixel}$** (verified from HDU 5 PSF header: `CDELT1 = 0.615 arcsec` with `OVERSAMP = 10` [VERIFIED: `docs/VERIFIED_FACTS.md` §5]).
  - WCS-derived pixel scale in HDU 1 (`IMAGE`): $6.134\text{ to }6.141\text{ arcsec/pixel}$ TAN-SIP projection [VERIFIED: `docs/VERIFIED_FACTS.md` §5].
- **Data Access:** Level 2 Multi-Extension FITS (MEF) files stored in public AWS S3 bucket `s3://nasa-irsa-spherex` (`us-east-1`, anonymous access supported) [VERIFIED: `docs/VERIFIED_FACTS.md` §2].

---

## 3. The Science Idea in Plain Language

### Why a "Blink Comparator"?
In 1930, Clyde Tombaugh discovered Pluto by placing photographic plates taken on different nights into an optical blink comparator, switching rapidly between images to spot a point of light jumping across a stationary background of stars. AstroBlink implements a modern, browser-based digital blink comparator for infrared satellite imagery [REPORTED: `docs/PRD.md` §1].

### Why Matched Wavelength Slices Are Critical [VERIFIED]
Unlike classical telescopes equipped with broad, uniform optical filters (such as $B, V, R$), SPHEREx utilizes **Linear Variable Filters (LVF)** mounted directly atop its detector arrays:
1. Across a single $2048 \times 2048$ detector array, the transmission wavelength varies continuously from one edge to the other along the dispersion axis.
2. If SPHEREx observes the same coordinate $(RA, Dec)$ in Epoch 1 and Epoch 2 at differing spacecraft roll angles or pointing offsets, raw pixels covering that sky patch will sample **different wavelengths**.
3. Astronomical sources (stars, galaxies, dust) have sharp spectral features and steep infrared continuum slopes. Blinking two raw images taken at mismatched wavelengths causes stationary stars to fluctuate in apparent flux, creating **false-positive blinking artifacts**.
4. **AstroBlink Solution:** The worker pipeline extracts narrow wavelength slices centered on specific matched bands ($1.0\text{ }\mu\text{m}$, $2.0\text{ }\mu\text{m}$, $4.0\text{ }\mu\text{m}$) and computes a per-pixel **shared-wavelength intersection mask**. Every unmasked pixel presented to the user is verified to compare identical spectral wavelengths between epochs [VERIFIED: `worker/worker/processing/binning.py`, `docs/VERIFIED_FACTS.md` §8.2].

---

## 4. Why Inter-Epoch 0.5-Degree Tiles (and Earth-Orbit Parallax)

### The 0.1° Scaffold Assumption vs. 0.5° Reality [VERIFIED]
Early project documentation assumed a $0.1^\circ \times 0.1^\circ$ cutout size ($360" \times 360"$, half-width $180"$). However, astronomical analysis revealed a critical physical constraint:
- **Solar Elongation Geometry:** SPHEREx observes at solar elongation $\sim 90^\circ$ (quadrature).
- **Parallax Baseline:** Over the $\sim 6\text{ months}$ separating Epoch 1 and Epoch 2, the Earth moves to the opposite side of its orbit, creating a perpendicular baseline shift of $|\Delta\mathbf{r}_{\oplus,\perp}| = 1.78\text{ to }1.99\text{ AU}$ [VERIFIED: `docs/VERIFIED_FACTS.md` §7].
- **Earth-Orbit Parallax:** The apparent angular displacement is dominated by parallax:
  $$\Delta\theta_{\text{par}} \approx \frac{|\Delta\mathbf{r}_{\oplus,\perp}|}{d} \approx \frac{399"}{d_{1000\text{AU}}}$$
- At $d = 1000\text{ AU}$, the 6-month topocentric shift is **$387.5"\text{ to }407.8"$**, which far exceeds the $180"$ half-width of a $0.1^\circ$ tile! Any object at $1000\text{ AU}$ centered in Epoch 1 would have completely disappeared from a $0.1^\circ$ tile by Epoch 2.

### 0.5-Degree Tile Geometry [VERIFIED]
- Angular size: $0.5^\circ \times 0.5^\circ$ ($1800" \times 1800"$, half-width $900"$).
- Native resolution: At $6.15"/px$, this corresponds to an exact **$293 \times 293\text{ pixel}$** grid ($85,849\text{ pixels}$).
- Containment: As proven below, a $0.5^\circ$ field reliably contains candidate objects located at $500\text{ to }1000\text{ AU}$ over 6-month baselines [VERIFIED: `docs/VERIFIED_FACTS.md` §8.2].

---

## 5. What Kinds of Objects the Blink Can and Cannot Detect

Based on computed JPL Horizons ephemerides and 3D barycentric Earth-orbit parallax simulations across the 5 verified SPHEREx targets [VERIFIED: `docs/VERIFIED_FACTS.md` §7A, §7B]:

### Detectability Matrix across 6-Month Inter-Epoch Blink

| Object Class | Example Object / Distance | 6-Month Displacement ($\Delta\theta$) | Displ. in Native Pixels ($6.15"/px$) | Stays Inside $0.5^\circ$ Tile ($900"$ half-width)? | Detectable in 6-Month Inter-Epoch Blink? |
| :--- | :--- | :---: | :---: | :---: | :---: |
| **Near-Earth Objects (NEOs)** | (433) Eros ($a = 1.46\text{ AU}$) | $80,889"\text{--}292,248"$ ($22.5^\circ\text{--}81.2^\circ$) | $13,153\text{--}47,520\text{ px}$ | **No** (0/5) | **CANNOT DETECT** (Exits tile instantly) |
| **Main Belt Asteroids (MBAs)** | (1) Ceres ($a = 2.77\text{ AU}$) | $10,057"\text{--}125,001"$ ($2.79^\circ\text{--}34.7^\circ$) | $1,635\text{--}20,325\text{ px}$ | **No** (0/5) | **CANNOT DETECT** (Exits tile instantly) |
| **Classical Kuiper Belt (KBOs)** | (134340) Pluto ($a = 39.5\text{ AU}$) | $2,242"\text{--}14,215"$ ($0.62^\circ\text{--}3.95^\circ$) | $365\text{--}2,311\text{ px}$ | **No** (0/5) | **CANNOT DETECT** (Exits tile; needs intra-epoch mode) |
| **Hypothetical Planet X / Outer Perturber (300 AU)** | Hypothetical object at $300\text{ AU}$ | $1,232"\text{--}1,424"$ ($0.34^\circ\text{--}0.40^\circ$) | $200\text{--}232\text{ px}$ | **No** (0/5) | **BORDERLINE / EXITS** (Requires $\ge 0.8^\circ$ cutout) |
| **Hypothetical Planet X / Outer Perturber (500 AU)** | Hypothetical object at $500\text{ AU}$ | **$757"\text{--}835"$** ($0.21^\circ\text{--}0.23^\circ$) | **$123\text{--}136\text{ px}$** | **YES** (5/5) | **CAN DETECT** (Clear shift, contained in tile) |
| **Hypothetical Planet X / Oort Cloud (1000 AU)** | Hypothetical object at $1000\text{ AU}$ | **$388"\text{--}408"$** ($0.11^\circ\text{--}0.11^\circ$) | **$63\text{--}66\text{ px}$** | **YES** (5/5) | **CAN DETECT** (Ideal parallax displacement) |
| **Sub-stellar Brown Dwarfs** | Ultra-cool brown dwarfs ($d \sim 10\text{ pc}$) | $\mu \sim 0.5\text{--}3.0"/yr$ ($< 1.5"$ over 6 mo) | $< 0.5\text{ px}$ | **YES** (5/5) | **CAN DETECT via color anomaly** (strong $4.0\text{ }\mu\text{m}$ excess) |

> [!IMPORTANT]
> **Summary on Moving Objects:** The 6-month inter-epoch blink comparator is physically specialized for **deep outer Solar System bodies ($500\text{--}1000\text{ AU}$) and cold sub-stellar brown dwarfs**. Fast inner Solar System objects (asteroids, NEOs, typical KBOs) move too fast over 6 months and can only be detected via short-cadence intra-epoch blinking (which is out of scope for the MVP due to low matched-wavelength coverage).

---

## 6. Team Roles Reference

As defined in the project governance structure [REPORTED: `docs/ROADMAP.md` §Team Roles Reference, `.github/CODEOWNERS`]:

| Role # | Title | Primary Responsibilities | Directory Ownership |
| :---: | :--- | :--- | :--- |
| **Role 1** | **Astronomy Data Engineer** | S3 anonymous access, FITS parsing, spectral/wavelength binning, reprojection co-addition, tile rendering, WCS sidecars, worker pipeline. | `/worker/` |
| **Role 2** | **Backend & Consensus Dev** | FastAPI endpoints, PostgreSQL schema & Alembic migrations, DBSCAN consensus algorithm, reliability weighting, CSV/VOTable exports. | `/api/` |
| **Role 3** | **Frontend Canvas Dev** | Next.js application, Canvas/OpenSeadragon blink comparator, pan/zoom interaction, mark placement, coordinate deprojection. | `/client/` (shared) |
| **Role 4** | **UI/UX & Gamification Lead** | Volunteer onboarding tutorial, badges, discovery feed, responsive layout, accessible styling, legend hatching. | `/client/` (shared) |
| **Role 5** | **DevOps & Cloud Engineer** | Docker Compose orchestration, PostgreSQL + pgSphere container, Redis queue, CI/CD GitHub Actions, environment configuration. | `/infra/`, `/.github/`, `Makefile` |
| **Role 6** | **Full-Stack Integrator & Team Lead** | API contract ownership (`openapi.yaml`, schemas), PR reviews, architecture integrity, NASA Space Apps submission deliverables. | `/contracts/`, `/docs/`, `README.md` |

---

## 7. Hackathon Context & Current Project Status

- **Competition:** NASA Space Apps Challenge 2026.
- **Challenge Track:** "Planet X and SPHEREx".
- **Sprint Schedule:** Originally designed as an intensive 48-hour hackathon MVP sprint, followed by post-hackathon refinement.
- **Current State (Commit `cc39991`):**
  - Backend and ingestion pipelines are fully merged and de-risked against live SPHEREx data.
  - The project is entering the handoff phase, requiring a complete audit before frontend client reconstruction and final end-to-end integration.
