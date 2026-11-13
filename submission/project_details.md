# AstroBlink: Project Details

## 1. Overview

AstroBlink is a public web tool for NASA's SPHEREx mission. It displays infrared images of the sky over time, so that anyone can quickly see how a star, brown dwarf or variable object changes between observations. A visitor types a sky position or clicks a preset, and a short series of real SPHEREx frames plays like a film. A citizen-science layer sits on top: guided projects, practice rounds, classification batches, a field guide, personal statistics and a certificate. Behind the viewer, a backend pipeline fetches the SPHEREx data, prepares matched image series, and combines volunteer marks into candidate lists.

The project was built for the NASA Space Apps Challenge 2026, SPHEREx sky blinker track. The repository is a monorepo with three applications (front end, API, worker), shared API contracts, infrastructure and documentation.

---

## 2. The challenge and how we answered it

The brief asked for a public-facing tool in which a user enters a sky position (RA and Dec), sees a series of images that play like a short video, and can test the tool on five targets. Optional goals were: data that is easy to update, use of the many wavelength bands and six detectors, adding and subtracting images, a choice of field of view, catalogue overlays, shareable links and embeddable viewers, and contamination flags.

| Brief requirement | How AstroBlink answers it |
|---|---|
| Public-facing, no barrier | The viewer opens without an account. Sign-in is optional and used only for personal progress. |
| Enter RA and Dec | A coordinate search box accepts sexagesimal (08h55m10.8s, -07d14m42s) and decimal degrees. |
| A series of images, not two | A blink player with play and pause, a timeline, frame metadata and zoom and pan. |
| Five test targets | Five one-click presets: Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae and R Draconis. |
| Easy to update with new data | One data-provider interface, and a fetch script that adds new SPHEREx epochs and rebuilds each target's index. |
| Use the bands and detectors | Detector selector (D1 to D6), narrow-slice wavelength handling in the backend, and a spectrum chart on click. |
| Add or subtract images | Difference and stack view modes, alongside blink, side-by-side and merge. |
| Choose a field of view | Field-of-view selector (2, 5, 10 and 15 arcminutes). |
| Shareable and embeddable | Every viewer state lives in the URL. An embed route is provided for iframes. |
| Contamination flags | A glitch flag overlay, with cosmic-ray and saturation marks. |

---

## 3. Science background

SPHEREx observes the whole sky about every six months, across roughly 100 narrow infrared bands from 0.75 to 5 micrometres, using six detectors (D1 to D6). Two features of the instrument shaped the design:

1. **Wavelength gradient.** Each detector uses a linear variable filter, so the wavelength changes across its field. If two frames of the same spot are compared at different wavelengths, the difference looks like brightness change even when nothing changed. AstroBlink therefore selects frames at the same wavelength (1.0 micrometre on D1, 2.0 on D3 and 4.0 on D5), with a tight tolerance and a shared-overlap check. This removes the false blinks that the gradient would create.

2. **Six-month orbit parallax.** Earth's motion over six months shifts nearby objects against the background. A brown dwarf 500 to 1000 AU away can move by several pixels between visits. The backend therefore builds 0.5 degree cutouts (293 by 293 pixels at 6.15 arcseconds per pixel), which are large enough to contain these shifts.

These choices are recorded in the project's decision log, so that the scientific reasoning can be checked.

---

## 4. User experience (front-end)

### 4.1 Landing page

The landing page introduces the mission and the tool, with a short looping demonstration, a coordinate search and a clear call to try the viewer. Visitors can go directly to a preset.

### 4.2 Explore viewer

The viewer is the core of the product and is designed so that the image gets most of the space. It contains:

- **Search and presets.** A coordinate search with both common formats, and five preset chips. Each preset has an object card that explains what the target is, what to look for, and the source of its coordinates.
- **Five view modes.** *Blink* alternates frames. *Side by side* shows two frames together. *Merge* combines three wavelengths into a false-colour image. *Difference* subtracts one frame from another, so stationary stars vanish while movers show as a bright and dark pair. *Stack* adds frames together, to reveal faint objects.
- **Playback.** A player bar and timeline, with play, pause, step and speed controls. Blinking is designed to stay within two frame changes per second. A reduced-motion setting, or the operating system's setting, switches to a gentle cross-fade.
- **Analysis tools.** Stretch (linear, logarithmic or asinh), detector choice, field of view, glitch-flag overlay, and a frame information strip (observation date, detector and wavelength).
- **Light curve and spectrum.** A brightness-over-time chart for the selected object, and a spectrum chart when a source is clicked. The spectrum can be exported as CSV.
- **Sharing.** The URL records the target, mode, detector, stretch, field of view, frame and zoom, so that a link opens exactly the same view. A share-and-embed panel provides the link and iframe code.

### 4.3 Citizen-science projects

Four projects each have their own question and answer buttons, so that the task is clear for each kind of object:

| Project | Task | Level | Detector | Fields |
|---|---|---|---|---|
| Hunt moving stars | Did the object move? | Beginner | D2 | 120 |
| Brown dwarfs | Did the faint object move? | Intermediate | D6 | 80 |
| Variable watch | Did the brightness change? | Intermediate | D3 | 100 |
| Glitch patrol | Is this real or a glitch? | Advanced | D3 | 60 |

Each project has an overview page and a short training round. The round uses fields with known answers and gives feedback after each one. Classification then runs in batches of ten, with a progress bar. Keyboard keys 1 to 4 map to the answer buttons, so that a session can be completed quickly. When a batch is finished, a completion screen offers another batch or the user's statistics.

A **field guide** explains the common look of movers, variables and glitches, with examples. Explainer cards on the guide page cover the same ground for readers who prefer text.

### 4.4 Personal layer

- **Sign-in.** A mock sign-in stores a name and email on the device. No password is requested and no server stores the account, which keeps the public tool free of a login wall.
- **My stats.** Classifications, projects and activity are kept in the browser's local storage, and shown as charts.
- **Certificate.** Users who meet the eligibility rule can preview and download a certificate. It is drawn on a canvas in the browser, so no server is needed.
- **Community page.** Shows community agreement and activity. These numbers are demonstration data and are labelled as such on the page.

### 4.5 Settings, language and accessibility

- **Languages.** English and Bangla, with the Bangla font (Noto Sans Bengali) and date and number formatting for each language. Every user-facing string goes through a single translation dictionary.
- **Settings dialog.** Language, reduced motion, blink speed and a colour-blind-safe merge setting.
- **Design.** A dark theme that keeps the image as the focus, with no sidebar. Content flows from top to bottom in a single column.
- **Keyboard and screen readers.** Skip links, labelled controls and focus states are provided throughout.

### 4.6 About and guide pages

The about page explains the mission, the team roles, the data credits and the honest status of each feature. Any simulated or demonstration content is labelled "Simulated sky" or "Demo data", so the user always knows what they are looking at.

---

## 5. Data pipeline (worker)

The ingestion worker is a standalone Python process that consumes jobs from a Redis queue. For each job, it runs the following stages:

1. **Runtime guards.** A scratch-space budget of 500 MiB and a per-job time cap of 600 seconds protect the host. The worker also writes a heartbeat file, used by Docker health checks.
2. **Duplicate check.** Before any work starts, PostgreSQL with the pgSphere extension checks whether a subject already exists within one arcsecond of the requested position.
3. **Discovery.** The worker queries IRSA's TAP service for SPHEREx exposures that cover the position, with their band names and observation times. Observations are grouped into epochs using a 30 day gap, which separates the six-month survey passes.
4. **Wavelength-matched selection.** For each epoch, the worker chooses one exposure per detector at the target wavelength. Ties within 0.002 micrometres are broken by larger shared overlap, then by earlier observation date. A subject needs at least two matched epochs. If it does not have them, the worker records the reason and inserts nothing.
5. **Efficient archive access.** Instead of downloading whole files, the worker reads the needed row strips of the FITS files directly from the anonymous public S3 bucket, using HTTP Range requests in parallel. Header parsing reads only up to the END card. This avoids the cutout service, which returned HTTP 503 errors during testing, and saves most of the bandwidth.
6. **Quality masking.** Detector defect flags are applied. Transient and outlier flags are masked by default. Pixels that are not valid in every epoch of the shared wavelength are excluded.
7. **Reprojection.** All frames are placed on a common 6.15 arcsecond-per-pixel tangent-plane grid, so that positions can be compared directly. The grid is the native pixel scale, so no resampling blur is added.
8. **Rendering.** Each narrow-slice image is rendered with an asinh stretch. Masked pixels are hatched so that they cannot be mistaken for stars. A three-band colour composite is made when all three slices exist. Each tile is saved as WebP under 250 KB, with a JSON sidecar that records the world-coordinate solution and provenance.
9. **Storage and records.** Tiles and sidecars are uploaded to S3-compatible storage (MinIO in development). A subject row is inserted into PostgreSQL, and the ingest job is marked complete.

Each stage has a matching test module in the worker's test suite.

---

## 6. Backend API and consensus

The API is a FastAPI service with Alembic migrations. Its main endpoints are:

- `GET /api/v1/subjects/next` returns the next subject to classify.
- `POST /api/v1/classify` records a volunteer's marks for a subject.
- `POST /api/v1/consensus/run` runs the consensus engine. It is protected by an admin bearer token and is idempotent per subject.
- `GET /api/v1/candidates` lists candidates, and `GET /api/v1/candidates/export` exports them as CSV or as an IVOA-compliant VOTable 1.4, which astronomers can load in standard tools.
- `GET /health` reports service health.

### 6.1 Consensus algorithm

The consensus engine is a pure function with no database or web dependencies, which makes it easy to test. It works as follows:

- **Distance.** Angular separations use the haversine formula, which handles the wrap-around at 0 and 360 degrees and the scaling of right ascension with declination.
- **Clustering.** Within each epoch, a reliability-weighted DBSCAN groups the marks that point at the same place. The clustering radius comes from the pixel scale: 1.5 pixels, or about 9.2 arcseconds.
- **Centroid and dispersion.** Each cluster's position is a weighted spherical centroid, and its dispersion is measured in arcseconds.
- **Reliability.** Each volunteer has a reliability weight, which is updated from their agreement with gold-standard subjects whose answers are already known.
- **Tracklets.** Clusters from different epochs are linked into tracklets within a maximum displacement. Each tracklet receives a motion vector, given as arcseconds per epoch and a position angle.
- **Candidates.** Tracklets that pass the thresholds become candidates, with their epochs and dispersion. Experts can review them.

### 6.2 Data model

The PostgreSQL schema, created by an Alembic migration, has tables for users, subjects, classifications, marks, candidates, candidate epochs, badges, user badges and candidate reviews. Spatial queries use pgSphere, which is why the database is self-managed rather than a managed service.

---

## 7. Architecture and technology

### 7.1 Monorepo

| Folder | Role | Stack |
|---|---|---|
| `client/` | Public web front end | Next.js (App Router), TypeScript (strict), Tailwind CSS v4, Radix and shadcn/ui, Zustand, nuqs, Recharts, Vitest |
| `api/` | REST API and consensus | FastAPI, SQLAlchemy, Alembic, Pydantic, pytest |
| `worker/` | Ingestion and tile rendering | Python, Astropy, NumPy, Redis queue, boto3, pytest |
| `contracts/` | Shared API contract | OpenAPI 3.1 and JSON schemas, language-neutral |
| `infra/` | Containers and deployment | Docker Compose, PostgreSQL 16 with pgSphere, MinIO, Redis, CI workflows |
| `docs/` and `audit/` | Documentation | Product requirements, architecture, verified facts, decisions and audit records |

Each application builds from its own folder, and the apps communicate only through HTTP, PostgreSQL, Redis and object storage. This keeps each part independently deployable.

### 7.2 Front-end data design

The front end is designed so that components never fetch data. They request data through a `SkyDataProvider` interface, which has four calls: field, frame pixels, spectrum and project queue. A routing provider decides, for each request, whether to use the real static data (for the five presets) or the labelled simulated sky (everywhere else). A third provider slot is reserved for the backend API, so the viewer can switch to live subjects without changing any component.

### 7.3 Deployment

The front end is designed for Vercel, and the API and worker for container hosts such as Render or Fly.io. PostgreSQL with pgSphere is self-managed, because managed PostgreSQL services do not support that extension. Docker Compose runs the full stack locally, with health checks for each service.

---

## 8. Data and testing

### 8.1 Real data

The viewer ships with real SPHEREx frames for five targets. The data comes from the public SPHEREx Quick Release and DR1 products, retrieved from IRSA by a documented fetch script. The fetch script is idempotent: frames already on disk are skipped, new epochs are appended, and each target's manifest and spectrum are rebuilt.

| Target | Frames | Observed (first to last) | Releases |
|---|---|---|---|
| WISE 0855 | 48 | 2025-05-05 to 2026-05-14 | QR2 |
| Barnard's Star | 47 | 2025-08-25 to 2026-09-22 | DR1, QR3 |
| Epsilon Indi B | 46 | 2025-04-24 to 2026-10-02 | QR2, QR3 |
| R Draconis | 66 | 2025-04-25 to 2026-09-17 | DR1, QR3 |
| RW Aurigae | 48 | 2026-09-02 to 2026-09-16 | QR3 |
| **Total** | **255** | | |

### 8.2 Backend verification

The backend's verified facts were checked against live responses from the public S3 bucket and the IRSA service. They record:

- anonymous listing of the bucket and byte-range inspection of FITS headers, confirming that the header can be read without downloading the file;
- the cutout geometry (293 by 293 pixels at 6.15 arcseconds per pixel, covering 0.5 degrees);
- the wavelength-matching tolerances and the masking rules;
- the tile size limit (250 KB) and the metadata written to each sidecar;
- the pgSphere one-arcsecond duplicate check.

The verification log records each command and output, so the results can be reproduced.

### 8.3 Automated tests

- **Backend API.** The API has 25 test functions covering authentication, classification validation, the consensus algorithm (including DBSCAN clustering, haversine scaling and reliability weighting), the export formats and subject retrieval. The API suite passed 31 tests in the October 2026 audit run inside its container. Contract-validation tests were excluded from that run.
- **Worker.** The worker has 38 test functions covering FITS parsing, WCS handling, binning, masking, reprojection, rendering and the main pipeline. Real-data integration tests are marked separately and run on demand, so that continuous integration does not depend on the network.
- **Front end.** Roughly 100 unit tests across 16 files cover coordinate parsing and formatting, stretch and difference maths, view modes, synthetic data generation, the static provider, the translation dictionaries, persisted state, URL state, statistics and certificate eligibility.

### 8.4 Continuous integration

Separate workflows run the API, worker and client checks on every push: linting, type checking and tests. Each application is also built on its own, to prove that it does not depend on the other folders.

---

## 9. Design decisions

| Decision | Reason |
|---|---|
| Match frames by wavelength, not by filter position | The linear variable filter would otherwise make false blinks |
| Use 0.5 degree cutouts | Large enough to contain the six-month parallax of nearby objects |
| Keep the native 6.15 arcsecond grid | Avoids resampling blur, so the image shows real detail |
| Read S3 byte ranges instead of the cutout service | Faster and more reliable, and it avoids the service's 503 errors |
| Use pgSphere for positional deduplication | Exact spherical distance checks within one arcsecond |
| Keep the consensus engine pure | Easy to test and to reason about |
| Label all simulated content | Users always know whether they are looking at real data |
| No login wall and no sidebar | A public tool should open instantly, with the image as the focus |
| Cap the blink rate | Comfortable viewing, and it respects reduced-motion settings |

---

## 10. Accessibility and inclusion

- **Language.** Full English and Bangla interfaces, with a Bangla-capable font and locale-aware formatting. Learners who are more comfortable in Bangla can use the whole tool.
- **Motion.** A reduced-motion mode replaces blinking with a gentle cross-fade. The mode follows the operating system setting or the in-app setting.
- **Colour vision.** A colour-blind-safe merge option and an explicit legend for the merge view.
- **Keyboard and assistive technology.** Skip links, visible focus states, labelled controls, and keyboard shortcuts for classification.
- **Honest labelling.** Simulated and demonstration content is always labelled, so no one mistakes it for real observations.

---

## 11. Who it helps

- **General public and students** can look at real infrared survey data for the first time, with no software to install.
- **Teachers** can use the presets and the field guide in class, and the Bangla interface widens access.
- **Citizen scientists** can join guided projects and contribute classifications that feed the consensus engine.
- **Astronomers** get candidate lists exported as VOTable 1.4, which standard astronomy tools can read.
- **Developers** get a clean monorepo, shared contracts, tests and documentation to build on.

---

## 12. What we would build next

1. **Live subjects in the viewer.** Connect the reserved backend provider, so that classification batches come from the backend's subjects instead of the static fields.
2. **More real targets.** Use the same fetch script to add targets as SPHEREx releases publish new data.
3. **Catalogue overlays.** Add Gaia and WISE overlays with Aladin Lite, loaded only when the user opens them.
4. **Expert review.** Give reviewers a queue of consensus candidates, with the motion tracks and VOTable export.
5. **Community statistics.** Replace the demonstration numbers with real agreement statistics once accounts and the database are live.
6. **Tracklet view.** Show a candidate's linked positions across epochs directly in the viewer.

The guiding principle for all of this is the one we started with: the image is the product, and every addition must keep the core path (search, series, blink) fast and clear.

---

## Appendix: Form-ready project details (under 5,000 characters)

AstroBlink is a public, no-login web tool for NASA's SPHEREx mission. Anyone can type a sky position or click one of five presets (Barnard's Star, Epsilon Indi B, WISE 0855, RW Aurigae, R Draconis) and watch a short series of real SPHEREx infrared frames play like a film, so moving, pulsing or glitching objects stand out.

The viewer offers blink, side-by-side, merge, difference and stack modes; detector, stretch and field-of-view controls; glitch flags; a light curve and a spectrum on click; and an embed route. Every view is stored in the URL, so any view can be shared.

A citizen-science layer adds four guided projects (moving stars, brown dwarfs, variable stars, glitch patrol), a practice round with feedback, batches of ten classifications with progress tracking, a field guide, personal statistics and a browser-drawn certificate. The interface is bilingual (English and Bangla), with reduced-motion and colour-blind-safe options.

The science is built in. SPHEREx's linear variable filters shift wavelength across each detector, so frames are matched at the same wavelength to avoid false blinks. Cutouts are 0.5 degrees, large enough to contain the six-month parallax of nearby objects. The backend worker reads only the needed bytes from the public S3 archive, aligns frames on the native 6.15 arcsecond grid, masks defect pixels, and renders WebP tiles under 250 KB with coordinate sidecars. A FastAPI service stores subjects and classifications in PostgreSQL with pgSphere, and a consensus engine clusters volunteer marks per epoch, weights volunteers by reliability, links clusters into motion tracks, and exports candidates as CSV or IVOA VOTable 1.4.

The five presets use 255 real SPHEREx frames from the public Quick Release and DR1 products. Other positions show a clearly labelled simulated sky. The front end is built with Next.js and TypeScript, the backend with Python, FastAPI and Astropy, and the whole stack runs with Docker Compose. Unit test suites cover the viewer's maths and state, the consensus engine, the worker's FITS, masking and rendering code, and the API.

Next, we would connect the viewer to live backend subjects, add more real targets as SPHEREx releases arrive, add Gaia and WISE catalogue overlays, and give experts a review queue for consensus candidates.
