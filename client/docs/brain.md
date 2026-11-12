# brain.md — AstroBlink project memory

> Read this file first, every session. It is the single source of truth for **what** we are building and **why**.
> `design.md` = how it looks · `rules.md` = what you must/must not do · `architecture.md` = how the code is organised.
> When a decision changes, update the **Decision log** at the bottom of this file in the same commit.

---

## 1. One-line summary

**AstroBlink** is a public web tool where anyone types a sky position (RA/Dec) or clicks a preset, and sees a series of NASA SPHEREx infrared images of that patch played like a short video, so moving or changing objects are easy to spot. A light citizen-science layer (projects, training, classification, stats, certificate) sits on top.

Built for **NASA Space Apps Challenge 2026 — SPHEREx sky blinker challenge**.
Our team builds the **frontend only** (Next.js). There is **no backend** in this phase.

---

## 2. The challenge in plain words

| What NASA asked | What it means for us |
|---|---|
| Public-facing web tool | No login wall. Anyone with the link can use the viewer instantly |
| User enters RA and Dec | Coordinate search box that accepts both common formats |
| Show a **series** of images "like a little video" | Blink player with play/pause and a timeline — not just two pictures |
| Test on 5 targets | 5 one-click preset chips that always work |
| *(optional)* Easy to update with new data | Data comes through one swappable "data provider" |
| *(optional)* Use the 102 bands / 6 detectors creatively | Detector selector, stacking, spectrum chart |
| *(optional)* Add or subtract images | Stack mode and difference mode |
| *(optional)* Choose field of view | FoV selector |
| *(optional)* Overlay Gaia / WISE | Catalog overlay (later phase) |
| *(optional)* Coordinates in URL / embeddable | URL is the source of truth; `/embed` route |
| *(optional)* Show contamination flags | Glitch flag overlay |

The **core** is small: search → series of images → blink. Everything else is a bonus. **Never let a bonus feature break the core.**

---

## 3. Glossary for non-astronomers

| Term | Plain meaning |
|---|---|
| **SPHEREx** | NASA infrared space telescope, launched March 2025. Maps the whole sky about every 6 months |
| **RA (Right Ascension)** | Sky "longitude". Written as `08h55m10.8s` or in degrees `133.795` |
| **Dec (Declination)** | Sky "latitude". Written as `-07d14m42.5s` or `-7.245`. Can be negative |
| **Visit / epoch** | One time SPHEREx looked at a spot. Visits are ~6 months apart. Today most spots have ~3–4 |
| **Frame** | One picture shown in our viewer, normally one per visit |
| **Detector (D1–D6)** | SPHEREx has 6 sensors, each sees a different range of infrared "colours" (wavelengths) |
| **Band / wavelength** | A specific infrared colour, measured in micrometres (μm), from 0.75 to 5.0 μm |
| **Proper motion** | How fast a star slowly drifts across the sky, in arcseconds per year |
| **Arcminute / arcsecond** | Sky angle units. 1° = 60′ (arcmin), 1′ = 60″ (arcsec). One SPHEREx pixel ≈ 6.2″ |
| **Field of view (FoV)** | How big a patch of sky we show, e.g. 5′ × 5′ |
| **Brown dwarf** | Object too big to be a planet, too small to shine like a star. Cold, faint, glows in infrared |
| **Variable star** | Star whose brightness changes over time |
| **Light curve** | Chart of brightness over time — how we show variable stars |
| **Spectrum** | Chart of brightness vs wavelength — reveals molecules like water or methane |
| **Glitch / contamination** | Fake signal: cosmic-ray hit, broken pixel, overloaded bright star |
| **Stretch** | How pixel values are mapped to screen brightness (linear / log / asinh) |
| **Difference image** | New frame minus old frame: still stars vanish, movers show as a dark+bright pair |
| **Stack** | Adding frames together so faint things become visible |

---

## 4. Who uses AstroBlink

We serve four mindsets on **one interface** through **progressive disclosure** (simple first, depth on request).

| Persona | Says | Needs | Where they live in the UI |
|---|---|---|---|
| **Contributor** | "I don't know astronomy, I just want to help." | Big clear question, 3–4 big answer buttons, short sessions | Project → training → classify page |
| **Learner** | "Teach me how to spot things." | Presets, explainer cards, field guide, feedback on practice | Landing, presets, training round, field guide |
| **Analyst** | "I want to check this properly." | Side-by-side, difference, stack, flags, stretch, zoom | Explore page + "Advanced tools" panel |
| **Advanced user / judge** | "Show me the science and that it works." | 5 presets working, spectrum, light curve, detector choice, URL share, embed | Explore page, advanced tools, `/embed` |

**Judges are a persona too.** They will click the 5 presets within the first minute. These must load fast and look correct, every time.

---

## 5. The 5 test targets (presets)

| Preset | What it tests | What the user should see | Default view |
|---|---|---|---|
| **Barnard's Star** | Fastest-moving star in the sky (~10.3″/yr) | A bright star shifting slightly between visits (~1–2 px per 6 months) | Blink, zoomed in, detector D2 |
| **Epsilon Indi B** | Faint brown-dwarf pair near a bright star | One faint dot drifting (the pair is far closer than one pixel, so it looks like one dot) | Blink, D5 |
| **WISE 0855** | Very cold, very faint, fast brown dwarf. RA `08h55m10.831s`, Dec `-07d14m42.53s` | Almost invisible at short wavelengths, visible at long ones; drifts ~8″/yr | Blink, D6, FoV ≥ 5′ (coordinates may be from an older epoch) |
| **RW Aurigae** | Irregular brightness changes (young star) | Same position, brightness changes; light curve shown | Blink + light curve open |
| **R Draconis** | Regular pulsation (Mira-type variable, ~245-day period) | Same position, brightness changes; light curve shown | Blink + light curve open |

Exact coordinates for every preset live in `src/data/presets.ts` (except WISE 0855, which NASA gave us). Fill them from SIMBAD before demo day.

---

## 6. Product scope

### In scope (this phase — frontend only)

1. **Explore viewer** (the core): coordinate search, presets, blink / side-by-side / merge / difference / stack, timeline player, zoom, frame info, light curve.
2. **Advanced tools panel**: detector, stretch, FoV, glitch flags, spectrum, share & embed. Gaia/WISE overlay is later.
3. **Citizen-science layer**: landing page, project gallery, project overview, training round, classify page with batch progress, field guide.
4. **Personal layer**: optional mock login, my stats, community stats (demo data), certificate.
5. **About page**, settings (language EN/বাংলা, reduced motion, blink speed, colour-blind merge).
6. **Embed route** `/embed`.

### Out of scope (this phase)

- Any real backend, database, or real authentication.
- Fetching or parsing real FITS files in the browser.
- Real community statistics or real cross-user agreement.
- Leaderboards that rank individuals.
- Comments / forum / chat.
- Sidebars of any kind (see Decision log).

### Data in this phase

- **Synthetic provider (default):** generates realistic-looking star fields in the browser, including a mover per moving-target preset, a variable star for variable presets, noise and glitches. Lets the whole app work offline.
- **Static provider:** reads pre-made PNG frames + JSON from `/public/data/` (a teammate can prepare real SPHEREx cutouts offline and drop them in).
- **API provider (future):** same interface, talks to a real backend later.
- Anything simulated or demo is **always labelled** in the UI ("Simulated sky", "Demo data").

---

## 7. Core product principles

1. **The image is the product.** It gets the most space. Nothing decorative sits on top of it.
2. **Works without login, works from a URL.** Every viewer state can be shared as a link.
3. **Simple first, depth on request.** Beginners see question + image + buttons. Tools are one click away, never in the face.
4. **Honest by design.** No fake progress, no fake endorsement, demo data labelled, agreement shown only after voting.
5. **Safe to watch.** Blinking never exceeds 2 frame changes per second; reduced-motion mode cross-fades instead.
6. **No sidebar.** Vertical, "theater mode" layouts only. Content flows top to bottom.
7. **Bilingual-ready.** Every user-facing string goes through i18n (English + বাংলা).

---

## 8. Key user journeys

**J1 — Judge / curious visitor (most important)**
Landing → "Try it now" → `/explore?preset=barnard` → blink plays automatically (respecting reduced motion) → clicks other presets → opens Advanced tools → copies share link.

**J2 — New contributor**
Landing → "Join a project" → project gallery → picks "Hunt for moving stars" → project overview → training round (5 practice fields with known answers + feedback) → classify batch of 10 with progress bar → batch complete screen → "Do 10 more" or "See my stats".

**J3 — Returning contributor**
Header → "My stats" → sees progress and charts → "Get certificate" → downloads PNG / prints PDF.

**J4 — Analyst**
`/explore` → types coordinates → switches to difference mode → toggles glitch flags → changes detector → clicks a star to see spectrum → shares URL.

**J5 — Teacher / blogger**
Explore → Share → copies `<iframe>` → `/embed?...` shows viewer + player only.

---

## 9. Build priority (do not reorder)

| Tier | What | Why |
|---|---|---|
| **T1** | Explore viewer: search, 5 presets, blink + timeline player, zoom, frame info, synthetic provider, URL sync | This is what NASA asked for and what judges test first |
| **T2** | Side-by-side, merge (colour per visit), difference, stack, light curve, stretch, detector, FoV, glitch flags | Strong differentiators that directly support discovery |
| **T3** | Project gallery, project overview, training round, classify page + batch progress, field guide | Citizen-science value |
| **T4** | Landing page, about page, settings, language toggle, embed route, share | Polish and reach |
| **T5** | My stats, community stats (demo), certificate, spectrum chart | Motivation and bonus science |
| **T6** | Mock login, Gaia/WISE overlay (Aladin Lite), GIF export | Last — only if everything above is solid |

If time runs out, stop at the end of a tier. Every tier must leave the app **working and demo-able**.

---

## 10. Open questions (resolve and move to Decision log)

- Who prepares real SPHEREx cutouts as PNG for the static provider, and when?
- Final exact coordinates for Barnard's Star, Epsilon Indi B, RW Aurigae, R Draconis (from SIMBAD).
- Team name and credits for the About page.
- Do we deploy on Vercel? (Assumed yes.)

---

## 11. Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-11-12 | Frontend only, Next.js App Router + TypeScript | Team scope; backend handled separately or later |
| 2026-11-12 | **No sidebar anywhere.** Use top navigation + vertical "theater mode" layout | Gives the image maximum width, simpler responsive behaviour, fewer layout states. Advanced tools go into a tabbed panel **below** the viewer |
| 2026-11-12 | Synthetic data provider is the default | App must work with zero backend and zero downloaded data |
| 2026-11-12 | Login is optional and mocked (localStorage) | Challenge says "public-facing"; login walls block judges and break embeds |
| 2026-11-12 | Series of N frames, never hard-coded to 2, 3 or 4 | SPHEREx revisits every ~6 months, so frame count keeps growing |
| 2026-11-12 | Agreement % shown only after the user votes | Avoids conformity bias and keeps crowd judgements independent |
| 2026-11-12 | No "endowed" or never-ending progress bars | Fake progress feels manipulative; batch progress ("3 of 10") is honest and motivating |
| 2026-11-12 | Branding is "AstroBlink", never "NASA AstroBlink"; no NASA logo | NASA restricts use of its name and insignia; we credit data instead ("Built with NASA SPHEREx data") |
| 2026-11-12 | Max blink rate 2 frames/second, default 1 | Photosensitive safety (WCAG: no more than 3 flashes per second) |
| 2026-11-12 | Dark theme only for MVP; certificate is light | Astronomy images need a dark surround; one theme halves design work |
| 2026-11-12 | Frontend app lives in `AstroBlink/client` (branch `Shahriar-Frontend`) and replaces the previous Next 15 client | Team decision. Old client code stays in git history |
| 2026-11-12 | Preset coordinates: Barnard's Star and RW Aurigae filled from web sources that cite SIMBAD; Epsilon Indi B and R Draconis stay pending (chip disabled) | Filling values from SIMBAD is required (rules §9.3). Confirm the filled values in SIMBAD before demo |
| 2026-11-12 | Static data provider falls back to synthetic until the file format is chosen | Brain §6 says PNG, architecture §5.3 says Float32. Rules §4.5 needs Float32, so the architecture version is the proposal. Needs a team decision |
| 2026-11-12 | Touch targets meet 44×44 with an invisible hit area; visible sizes follow design §9 | Rules §3.7 and design §9.1 conflict on sizes. This keeps both |
| 2026-11-12 | Difference style is a URL parameter `ds` (grey or colour) | Architecture §7.1 does not list it; added in Phase 3 so the view is shareable |
| 2026-11-12 | Glitch-patrol truth is computed from the synthetic data (flag in the central 5×5 aperture = glitch) | Keeps training answers verifiable without inventing labels |
| 2026-11-12 | Community numbers in `public/demo/community.json` are placeholders and always labelled Demo data | No real volunteer data exists yet (rules §2.2) |
| 2026-11-12 | Agreement is recorded when a volunteer answers, and shown only after answering | Rules §2.6. Stats then compute the rate without storing totals |
| 2026-11-12 | Mock sign-in stores name and email in this browser only; "Clear my data" asks first | Rules §5.1 and §8 (confirm permanent deletion) |
| 2026-11-12 | `/embed` sends `Content-Security-Policy: frame-ancestors *`, nothing else | Architecture §10: the embed route may be framed; the rest of the site may not |
| 2026-11-12 | Landing planet is a 3D Earth model (`public/models/earth.glb`, CC-BY-4.0, Stéphane Agullo via Sketchfab), shown with `<model-viewer>` 3.5.0 from jsDelivr | Requested by the project owner. Overrides design §13 (sky imagery and geometric marks only). CC-BY requires the credit on the about page. The file is 44 MB; compress the textures before public release |
