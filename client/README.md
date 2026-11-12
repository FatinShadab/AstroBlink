# AstroBlink client

Next.js (App Router) frontend for AstroBlink. It has the Explore viewer with all five view modes, the four
citizen-science projects (training, classify batches, field guide), the landing and about pages, stats,
community (demo), certificate, mock sign-in, and an embeddable viewer at `/embed`.

All sky data comes from a `SkyDataProvider`. The default source is synthetic, and every view labels itself
"Simulated sky". Community numbers are demo data and say so.

## Run

```bash
npm ci
npm run dev          # http://localhost:3000/explore?preset=barnard
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` | Production build (standalone output for Docker) |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest unit tests (coordinates, stretch, modes, photometry, synthetic data, URL state, stats) |
| `npm run format:check` | Prettier check |

## Updating the data

The five preset targets (WISE 0855, Barnard's Star, Epsilon Indi B, R Draconis, RW Aurigae) show real
NASA SPHEREx observations from static files in `public/data/`. Every other spot uses the labelled
simulated sky. The app never calls IRSA at runtime.

To fetch or refresh the data (for example when IRSA publishes a new SPHEREx release), run the one-time
script from `client/` with Python 3.12 and a virtual environment:

```bash
python -m venv .venv-data
.venv-data/Scripts/python -m pip install astroquery astropy numpy pillow requests
.venv-data/Scripts/python scripts/fetch_spherex.py --release QR2,QR3
```

- `--release` takes any release names, for example `--release QR2,QR3,QR4` once QR4 exists.
- `--targets` limits the run to some presets, for example `--targets wise-0855,barnard`.
- `--per-detector` sets how many frames per detector to keep (default 8, spread over the observing period).
- Frames already on disk are skipped and new epochs are appended. Each target's `manifest.json`,
  `spectrum.json` and the top-level `public/data/index.json` are rebuilt from the files on disk.
- IRSA sometimes returns 503 or drops connections. The script retries with backoff and logs what it
  skipped; run it again to fill the gaps.

Data credit: NASA SPHEREx Quick Release spectral images, NASA/IPAC Infrared Science Archive (IRSA).
DOIs: 10.26131/IRSA652 (QR2), 10.26131/IRSA662 (QR3).

## Pages

| Route | What |
|---|---|
| `/` | Landing with a slow simulated demo |
| `/explore` | Viewer: search, presets, Blink / Side by side / Merge / Difference / Stack, light curve, advanced tools |
| `/embed` | Viewer and player only, for an iframe (frame-ancestors allowed) |
| `/projects`, `/projects/[slug]` | Gallery and overview |
| `/projects/[slug]/train` | Five practice fields with feedback |
| `/projects/[slug]/classify` | Batches of ten, keys 1–4, Enter for next |
| `/guide` | Field guide |
| `/me`, `/me/certificate` | Personal stats and certificate (PNG, print) |
| `/community` | Demo community stats |
| `/about`, `/login` | About and mock sign-in |
| `/dev/ui` | Temporary primitives page. Delete before demo |

## Docs

Product and build rules are in `docs/` (`brain.md`, `design.md`, `rules.md`, `architecture.md`).
When a decision changes, update the decision log in `docs/brain.md` in the same change.

## Known gaps (see the decision log)

- Epsilon Indi B and R Draconis have no verified coordinates yet, so their chips are disabled.
- The static data provider falls back to synthetic until the file format is decided.
- Spectrum uses one template for every pixel. The clicked pixel is not used yet.
- Light curve is measured at the field centre, so for moving targets it shows the object leaving the centre.
- Overlays (Gaia, WISE) are "Coming soon".
- Bangla strings added in Phases 3–6 are English placeholders marked `TODO bn`.
- The team section on `/about` is a placeholder.
- No Playwright smoke test yet; the browser checks were run by hand.
- `/dev/ui` is a temporary page. Delete it before demo.
