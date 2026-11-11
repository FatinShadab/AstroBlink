# architecture.md — how the AstroBlink frontend is built

> Technical blueprint. `brain.md` says what and why, `design.md` says how it looks, `rules.md` says what is allowed.
> This phase is **frontend only**: everything runs in the browser or as static Next.js pages. No database, no custom server.

---

## 1. What works without a backend (and how)

| Feature | Works without backend? | How |
|---|---|---|
| Coordinate search & parsing | ✅ Fully | Pure TypeScript parser |
| 5 presets | ✅ Fully | Static config + synthetic or static data |
| Blink / side-by-side / merge / difference / stack | ✅ Fully | Canvas + Float32 math in the browser |
| Timeline player, zoom, pan | ✅ Fully | Client state |
| URL sharing & embed | ✅ Fully | URL query state + `/embed` route |
| Light curve | ✅ Simulated | Synthetic provider computes brightness per frame |
| Spectrum on click | ✅ Simulated | Synthetic provider returns a template spectrum for the clicked source |
| Glitch flags | ✅ Simulated | Synthetic provider injects cosmic rays/saturation and returns a flag mask |
| Projects, training, classify | ✅ Fully | Static project config + synthetic field queues with known answers for training |
| Batch progress, my stats, certificate | ✅ Fully (per browser) | `localStorage` via persisted store; certificate drawn on canvas |
| Community stats, agreement % | ⚠️ Demo only | Static JSON, always labelled "Demo data" |
| Login | ⚠️ Mock only | Name + email saved locally; no password, no server |
| Real SPHEREx images | ⚠️ Via static files | Teammate prepares real cutouts offline → drops binary files in `/public/data` |
| Live SPHEREx archive queries | ❌ Not this phase | Needs a server proxy (CORS, FITS parsing, file sizes). Planned as `ApiProvider` |
| Gaia / WISE overlay | ⚠️ Later (T6) | Aladin Lite (client-side JS library from CDS) can query catalogs from the browser |
| Real cross-user agreement, real community stats | ❌ Not this phase | Needs a database |

---

## 2. Tech stack

| Concern | Choice | Notes |
|---|---|---|
| Framework | **Next.js (latest stable), App Router** | `src/` directory, TypeScript |
| Language | **TypeScript** `strict` | |
| Styling | **Tailwind CSS v4** | Tokens defined CSS-first in `globals.css` with `@theme` |
| UI primitives | **shadcn/ui** (Radix under the hood) | Dialog, Tabs, Accordion, Tooltip, DropdownMenu, Slider, Switch, Toast. Restyled with our tokens |
| Icons | **lucide-react** | |
| URL state | **nuqs** | Type-safe query params for viewer state (App Router adapter) |
| Client state | **zustand** (+ `persist` middleware) | User, settings, classifications in `localStorage` |
| Charts | **Recharts** | Light curve, spectrum, stats. Loaded with `next/dynamic` |
| Class helpers | `clsx` + `tailwind-merge` → `cn()` | |
| Fonts | `next/font/google` | Space Grotesk, Inter, JetBrains Mono, Noto Sans Bengali |
| Tests | **Vitest** + Testing Library; **Playwright** (smoke) | |
| Sky overlay (T6) | **Aladin Lite** (CDS) | Loaded dynamically, only when the Overlays tab is opened |
| Hosting | **Vercel** | Preview deploy per branch |

Nothing else without approval (`rules.md` §9.4).

---

## 3. Folder structure

```
astroblink/
├── docs/                         brain.md · design.md · rules.md · architecture.md
├── public/
│   ├── data/                     static provider files (real cutouts, prepared offline)
│   │   └── fields/<fieldId>/field.json + frames/<frameId>.f32 (+ .flags.u8)
│   ├── demo/community.json       demo community stats (labelled in UI)
│   └── og.png, favicon.svg       AstroBlink marks only (no NASA logos)
├── src/
│   ├── app/
│   │   ├── layout.tsx            root: <html lang>, fonts, providers (nuqs, theme tokens)
│   │   ├── globals.css           Tailwind import + @theme tokens from design.md
│   │   ├── not-found.tsx
│   │   ├── (site)/               pages WITH header + footer
│   │   │   ├── layout.tsx        SiteHeader + <main> + SiteFooter
│   │   │   ├── page.tsx          landing  /
│   │   │   ├── explore/page.tsx
│   │   │   ├── projects/page.tsx
│   │   │   ├── projects/[slug]/page.tsx
│   │   │   ├── projects/[slug]/train/page.tsx
│   │   │   ├── projects/[slug]/classify/page.tsx
│   │   │   ├── guide/page.tsx
│   │   │   ├── me/page.tsx
│   │   │   ├── me/certificate/page.tsx
│   │   │   ├── community/page.tsx
│   │   │   ├── about/page.tsx
│   │   │   └── login/page.tsx
│   │   └── (bare)/               pages WITHOUT header/footer
│   │       ├── layout.tsx
│   │       └── embed/page.tsx
│   ├── components/
│   │   ├── ui/                   Button, Card, Chip, Badge, SegmentedControl, ProgressBar, KpiTile,
│   │   │                         Tabs, Accordion, Dialog, Tooltip, Toast, Skeleton, EmptyState, Banner
│   │   ├── layout/               SiteHeader, MobileMenuSheet, SiteFooter, PageSection, Container
│   │   ├── viewer/               SkyViewer, ViewerCanvasStack, ViewerToolbar, ModeSwitcher, ZoomControls,
│   │   │                         PlayerBar, Timeline, FrameMetaStrip, ViewerStates, Reticle, MergeLegend
│   │   ├── explore/              CoordinateSearch, FovSelect, PresetChips, ObjectCard, ShareButton
│   │   ├── analysis/             AdvancedToolsPanel, ImageTab, CompareTab, FlagsTab, SpectrumTab,
│   │   │                         OverlaysTab, ShareEmbedTab, LightCurveChart, SpectrumChart
│   │   ├── classify/             TaskHeader, AnswerButtons, BatchProgress, FeedbackCard, BatchComplete,
│   │   │                         FieldGuideDialog
│   │   ├── projects/             ProjectCard, ProjectFilters, ProjectHero, StepCards, ExampleCard
│   │   ├── stats/                ProfileCard, ActivityChart, ProjectBreakdown, RecentActivity,
│   │   │                         CommunityCharts, DemoDataBadge
│   │   ├── certificate/          CertificatePreview, drawCertificate.ts
│   │   ├── landing/              Hero, MiniBlinkDemo, HowItWorks, ProjectsPreview, StatsStrip, CtaBand
│   │   └── settings/             SettingsDialog, LanguageToggle
│   ├── lib/
│   │   ├── data/
│   │   │   ├── types.ts          all shared data types (§4)
│   │   │   ├── provider.ts       SkyDataProvider interface + getProvider()
│   │   │   ├── synthetic/        SyntheticProvider, generateField.ts, templates.ts, epochs.ts
│   │   │   ├── static/           StaticProvider
│   │   │   └── api/              ApiProvider (stub that throws "not available yet")
│   │   ├── sky/
│   │   │   ├── coords.ts         parse/format RA & Dec (sexagesimal + degrees) + tests
│   │   │   ├── detectors.ts      D1–D6 metadata
│   │   │   ├── stretch.ts        percentile clip + linear/log/asinh → Uint8ClampedArray
│   │   │   ├── imageMath.ts      difference, stack (mean), merge to RGB
│   │   │   ├── prng.ts           seeded PRNG (mulberry32) + gaussian
│   │   │   └── render.ts         Float32 → ImageData → offscreen canvas
│   │   ├── state/
│   │   │   ├── viewerParams.ts   nuqs parsers + defaults (URL state)
│   │   │   ├── useViewerUiStore.ts  zoom, pan, playing (not persisted)
│   │   │   └── useUserStore.ts   persisted: user, settings, classifications
│   │   ├── i18n/                 en.ts, bn.ts, useT.ts, format.ts (dates, numbers)
│   │   ├── a11y/                 useReducedMotion.ts (OS setting OR app setting)
│   │   └── utils/cn.ts
│   └── data/
│       ├── presets.ts            5 presets (§6)
│       ├── projects.ts           project definitions
│       └── fieldGuide.ts         example definitions for guide cards
├── tests/                        playwright smoke tests
└── next.config.ts                headers for /embed (frame-ancestors)
```

---

## 4. Core types (`src/lib/data/types.ts`)

```ts
export type Detector = 'D1' | 'D2' | 'D3' | 'D4' | 'D5' | 'D6';
export type ViewMode = 'blink' | 'side' | 'merge' | 'diff' | 'stack';
export type StretchKind = 'linear' | 'log' | 'asinh';
export type DataSourceKind = 'synthetic' | 'static' | 'api';

export interface SkyTarget {
  raDeg: number;        // 0 ≤ ra < 360
  decDeg: number;       // −90 ≤ dec ≤ 90
  fovArcmin: number;    // 2 | 5 | 10 | 15
  detector: Detector;
}

export interface FrameMeta {
  id: string;
  obsDate: string;          // ISO 8601
  detector: Detector;
  wavelengthUm: number;     // wavelength at the target pixel
  width: number;            // pixels
  height: number;
  pixelScaleArcsec: number; // ≈ 6.2 for SPHEREx
  hasFlags: boolean;
}

export interface FramePixels {
  frameId: string;
  width: number;
  height: number;
  data: Float32Array;       // row-major, NaN = no data
  flags?: Uint8Array;       // 0 = ok, >0 = glitch / unreliable
}

export interface LightCurvePoint { obsDate: string; flux: number; fluxErr: number; frameId: string }
export interface SpectrumPoint  { wavelengthUm: number; flux: number; fluxErr: number }

export interface FieldData {
  fieldId: string;
  target: SkyTarget;
  frames: FrameMeta[];      // sorted by obsDate ascending; length N ≥ 0 (never assume 2/3/4)
  lightCurve?: LightCurvePoint[];
  source: DataSourceKind;
  isSimulated: boolean;     // drives the "Simulated sky" badge
}

export type TaskType = 'motion' | 'variability' | 'glitch';
export type Answer = 'moved' | 'brightness' | 'no_change' | 'not_sure' | 'glitch' | 'real';

export interface Project {
  slug: string;
  titleKey: string;         // i18n key
  descriptionKey: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  taskType: TaskType;
  defaultDetector: Detector;
  fieldCount: number;
  trainingFieldIds: string[];
}

export interface QueueField {
  fieldId: string;
  target: SkyTarget;
  truth?: Answer;           // present only for training fields
  explanationKey?: string;  // training feedback text
  demoAgreement?: { answer: Answer; percent: number }; // labelled "Demo data"
}

export interface Classification {
  id: string;
  projectSlug: string;
  fieldId: string;
  answer: Answer;
  flaggedInteresting: boolean;
  isTraining: boolean;
  createdAt: string;
}
```

---

## 5. Data layer

### 5.1 The interface (`src/lib/data/provider.ts`)

```ts
export interface SkyDataProvider {
  readonly kind: DataSourceKind;
  getField(target: SkyTarget, signal?: AbortSignal): Promise<FieldData>;
  getFramePixels(frame: FrameMeta, signal?: AbortSignal): Promise<FramePixels>;
  getSpectrum(target: SkyTarget, pixel: { x: number; y: number }, signal?: AbortSignal): Promise<SpectrumPoint[]>;
  getProjectQueue(projectSlug: string, opts: { batchSize: number; offset: number }): Promise<QueueField[]>;
}

export function getProvider(): SkyDataProvider; // chooses by NEXT_PUBLIC_DATA_SOURCE (default 'synthetic')
```

**Components never call `fetch`.** They call hooks (`useField`, `useFramePixels`, `useSpectrum`) that call the provider, handle `AbortController`, loading and error states, and cache results in memory keyed by `ra|dec|fov|detector` and `frameId`.

### 5.2 SyntheticProvider (default)

Generates believable fields **deterministically** in the browser.

1. **Seed** = hash of `(round(ra, 4), round(dec, 4), detector)` → mulberry32 PRNG. Same input → same image.
2. **Size**: `side = round(fovArcmin × 60 / 6.2)` pixels (5′ ≈ 48 px, 15′ ≈ 145 px). Small and blocky on purpose — that is SPHEREx's real resolution; the viewer scales up with pixelated rendering.
3. **Visits**: first visit date = 2025-05-15 + (RA-dependent offset 0–180 days); then every ~182 days while `date ≤ today`. Result: about 3–4 frames today, more over time automatically.
4. **Background**: sky level + Gaussian noise (Box–Muller).
5. **Field stars**: count ∝ area; brightness from a power law; drawn as a Gaussian PSF (σ ≈ 0.8 px) at sub-pixel positions; per-detector brightness from a simple spectral template (star / brown dwarf / variable).
6. **Special objects** (presets and project fields): position at time *t* = start + proper motion × (t − t₀), converted to pixels (sub-pixel accurate). Variables multiply flux by a light-curve function (sinusoid with ~245-day period for R Draconis-like; random-walk dips for RW Aurigae-like).
7. **Glitches**: per frame, a few cosmic-ray hits (single hot pixels or 2–4 px streaks) and saturation around very bright stars; written into `flags`.
8. **Spectrum**: template spectrum for the clicked object type (brown dwarf templates show dips near 3.3 μm methane and broad water absorption), plus noise.
9. `isSimulated: true` always.

### 5.3 StaticProvider

Reads files prepared offline by a teammate (e.g. from real SPHEREx cutouts):
- `/public/data/fields/<fieldId>/field.json` → `FieldData` (with `isSimulated: false`).
- `/public/data/fields/<fieldId>/frames/<frameId>.f32` → raw little-endian Float32, `width × height` values.
- Optional `<frameId>.flags.u8` → Uint8 mask.
Frames **must already be aligned to the same pixel grid**. A preset can point to a static field ID; anything else falls back to synthetic.

### 5.4 ApiProvider (future)

Same interface. Expected backend contract:
- `GET /api/field?ra=&dec=&fov=&det=` → `FieldData` JSON
- `GET /api/frames/<frameId>.f32` and `.flags.u8` → binaries
- `GET /api/spectrum?ra=&dec=&x=&y=` → `SpectrumPoint[]`
Switching is one env change: `NEXT_PUBLIC_DATA_SOURCE=api`.

---

## 6. Presets (`src/data/presets.ts`)

```ts
export const PRESETS = [
  { id: 'barnard',  name: "Barnard's Star", kind: 'mover',    detector: 'D2', fovArcmin: 5,
    raDeg: /* TODO SIMBAD */ NaN, decDeg: /* TODO SIMBAD */ NaN,
    properMotionMasYr: { total: 10300, /* TODO direction from SIMBAD */ } },
  { id: 'eps-indi-b', name: 'Epsilon Indi B', kind: 'mover',  detector: 'D5', fovArcmin: 5,
    raDeg: NaN, decDeg: NaN, properMotionMasYr: { total: 4700 } },
  { id: 'wise-0855', name: 'WISE 0855', kind: 'mover',        detector: 'D6', fovArcmin: 5,
    ra: '08h55m10.831s', dec: '-07d14m42.53s',           // given by NASA
    properMotionMasYr: { total: 8100 } },
  { id: 'rw-aur',    name: 'RW Aurigae', kind: 'variable',    detector: 'D3', fovArcmin: 5,
    raDeg: NaN, decDeg: NaN, variability: 'irregular' },
  { id: 'r-dra',     name: 'R Draconis', kind: 'variable',    detector: 'D3', fovArcmin: 5,
    raDeg: NaN, decDeg: NaN, variability: { periodDays: 245 } },
] as const;
```
- Proper-motion totals are approximate; direction and exact coordinates **must be filled from SIMBAD** before demo (`rules.md` §9.3). The app must refuse to build a preset with `NaN` coordinates in production (throw in a test).
- Detector wavelength ranges (`detectors.ts`), approximate — verify against the SPHEREx Explanatory Supplement: D1 0.75–1.09 μm · D2 1.10–1.62 · D3 1.63–2.41 · D4 2.42–3.82 · D5 3.83–4.41 · D6 4.42–5.00.

---

## 7. State management

Three kinds of state, three homes. Never duplicate between them.

### 7.1 URL state (shareable) — nuqs, `src/lib/state/viewerParams.ts`

| Param | Type | Default | Meaning |
|---|---|---|---|
| `preset` | string | — | Preset id (fills ra/dec/fov/det if those are absent) |
| `ra` | number (deg) | — | Right ascension |
| `dec` | number (deg) | — | Declination |
| `fov` | 2 \| 5 \| 10 \| 15 | 5 | Field of view (arcmin) |
| `det` | D1…D6 | D2 | Detector |
| `mode` | blink \| side \| merge \| diff \| stack | blink | View mode |
| `f` | int | 0 | Current frame index |
| `a`, `b` | int | first, last | Compare frames |
| `st` | linear \| log \| asinh | asinh | Stretch |
| `fl` | 0 \| 1 | 0 | Show glitch flags |

- Use `history: 'replace'` and shallow updates.
- **Do not write `f` during autoplay** — only when the user pauses or steps. (Avoids hundreds of history writes.)
- The same params drive `/embed`.

### 7.2 Ephemeral UI state — `useViewerUiStore` (zustand, not persisted)

zoom, pan offset, isPlaying, hovered pixel, selected spectrum pixel, advanced panel active tab.

### 7.3 Persisted user state — `useUserStore` (zustand + persist, key `astroblink:v1`, `version: 1`)

```ts
{
  user: { name: string; email: string; createdAt: string } | null;
  settings: { lang: 'en' | 'bn'; reducedMotion: boolean; blinkFps: 0.5 | 1 | 2;
              colorblindMerge: boolean; advancedOpen: boolean };
  classifications: Classification[];
  trainingDone: Record<string, boolean>;   // by project slug
  batch: { projectSlug: string; offset: number; index: number; size: 10 } | null;
}
```
Guard against hydration mismatch: render persisted-dependent UI only after the store has hydrated (`useHasHydrated()` helper).

Derived stats (fields checked, projects joined, activity per day, agreement rate) are **computed selectors**, never stored.

---

## 8. Image pipeline (viewer)

```
provider.getFramePixels()  →  Float32Array (per frame, aligned)
          │
          ├── mode = blink/side → use frame(s) as-is
          ├── mode = diff       → imageMath.difference(B, A)        (Float32)
          ├── mode = stack      → imageMath.mean(selected)          (Float32)
          └── mode = merge      → stretch each, then RGB channels   (Uint8 RGBA)
          │
stretch.ts: percentile clip (0.5 % – 99.5 %, computed once per field so all frames share the same scale)
            → linear | log | asinh → Uint8ClampedArray
          │
render.ts:  ImageData at native size → OffscreenCanvas (cached per frameId+stretch)
          │
ViewerCanvasStack: drawImage onto visible canvas with zoom/pan transform,
                   imageSmoothingEnabled = false
Overlay canvas:    reticle, flag hatch (pattern), catalog marks, click marker
```

Key points:
- **Shared stretch across frames** — otherwise blinking shows fake brightness changes.
- Pre-render all frames before playback starts; show "Loading frame k of N".
- Playback loop uses `requestAnimationFrame` with a time accumulator (rate from settings, capped at 2/sec); stops on `visibilitychange` hidden.
- Reduced motion: cross-fade via two canvases and CSS opacity, no autoplay.
- Device-pixel-ratio aware canvas sizing; re-render on `ResizeObserver`.

---

## 9. Internationalisation

- Dictionaries: `src/lib/i18n/en.ts` (source of truth, `as const`) and `bn.ts` typed as `Record<keyof typeof en, string>` so missing keys fail type-check.
- `useT()` returns `t(key, vars?)`.
- Language preference stored in the user store **and** a `astroblink-lang` cookie so the root layout can render the correct `<html lang>` and font on first paint.
- Formatting helpers in `format.ts` use `Intl.DateTimeFormat` / `Intl.NumberFormat` with `en-GB` or `bn-BD`. Coordinates always formatted by `coords.ts` (Latin digits).

---

## 10. Special features

**Embed (`/embed`)** — `(bare)` layout, reads the same URL params, renders `SkyViewer` + `PlayerBar` only, plus "Open in AstroBlink ↗" linking to `/explore` with identical params. `next.config.ts` sets `Content-Security-Policy: frame-ancestors *` on `/embed` only.

**Share** — "Copy link" copies `window.location.href`; embed snippet:
```html
<iframe src="https://<domain>/embed?ra=133.795&dec=-7.245&fov=5&det=D6&mode=blink"
        width="600" height="400" style="border:0" title="AstroBlink sky viewer" loading="lazy"></iframe>
```

**Certificate** — `drawCertificate(ctx, data)` draws on a 2480×1754 canvas (A4 landscape at 300 dpi) using certificate tokens; `canvas.toBlob` → PNG download. "Print / Save as PDF" uses a print stylesheet that shows only the preview.

**Mock login** — writes `user` in the store; header switches to avatar menu. "Sign out" clears `user` (keeps classifications unless the user also chooses "Clear my data").

**Demo community data** — `/public/demo/community.json`, loaded on the client; every component that displays it renders `<DemoDataBadge />`.

**Gaia / WISE overlay (T6)** — `OverlaysTab` lazy-loads Aladin Lite only when opened. Until then the tab shows a disabled "Coming soon" state.

---

## 11. Rendering strategy per route

| Route | Rendering | Client components inside |
|---|---|---|
| `/`, `/about`, `/guide`, `/projects`, `/projects/[slug]` | Static (Server Components) | MiniBlinkDemo, ExampleCard mini viewers (dynamic, ssr: false) |
| `/explore`, `/embed` | Server shell + client viewer | SkyViewer, AdvancedToolsPanel, charts |
| `/projects/[slug]/train`, `/classify` | Server shell + client flow | Viewer, AnswerButtons, BatchProgress, FeedbackCard |
| `/me`, `/me/certificate`, `/community`, `/login` | Client (depend on localStorage / demo JSON) | everything |

Every route has `loading.tsx`; viewer routes have `error.tsx` with a "Try again" button.

---

## 12. Testing

| Level | Tool | What |
|---|---|---|
| Unit | Vitest | `coords` (incl. `-00d30m`, RA 24h wrap, invalid input), `stretch`, `imageMath`, synthetic determinism, epochs (frame count grows with date), store selectors |
| Component | Testing Library | AnswerButtons keyboard (1–4), PlayerBar controls, CoordinateSearch errors |
| Smoke | Playwright | For each preset: open `/explore?preset=<id>`, expect ≥ 2 frames rendered and zero console errors; open `/embed?preset=wise-0855` |

---

## 13. Environment variables

| Variable | Values | Default |
|---|---|---|
| `NEXT_PUBLIC_DATA_SOURCE` | `synthetic` \| `static` \| `api` | `synthetic` |
| `NEXT_PUBLIC_SITE_URL` | deployed origin | `http://localhost:3000` |

No secrets exist in this phase.
