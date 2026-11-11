# design.md — AstroBlink design system & page layouts

> How AstroBlink looks and feels. Every colour, size and layout decision lives here.
> **Never hard-code a hex value, font size or spacing in a component.** Use the tokens below.
> Product context is in `brain.md`. Enforcement rules are in `rules.md`.

---

## 1. Design principles

1. **The image is the product.** The viewer gets the most space on every page that has one. No glass, no gradients, no text on top of the sky image except small, solid-backed controls in its corners.
2. **Theater mode, no sidebar.** Every page is a single vertical flow: header → page content stacked top to bottom → footer. Wide content spans the container; secondary content sits in card rows **below** the main content, never beside it in a permanent column.
3. **Quiet chrome, loud data.** UI surfaces are dark, low-contrast navy. Colour is reserved for data (overlays, charts), state (selected, error) and the one primary action per screen.
4. **Progressive disclosure.** Beginners see: question, image, player, answer buttons. Tools are one click away inside a tabbed panel.
5. **Honest and calm.** No fake urgency, no confetti storms, no red/green bias on answer buttons. Demo or simulated data is always labelled.
6. **Accessible by default.** WCAG 2.2 AA contrast, full keyboard use, reduced motion, flash-safe blinking, colour never the only signal.

---

## 2. Theme

- **Dark only** for the MVP ("Observatory" theme). Tokens are structured so a light theme can be added later by redefining variables.
- The **certificate** is the only light surface (it is meant to be printed).
- Page background is a deep navy-black, **not** pure black. The **viewer canvas** is pure black (`#000000`), so the sky image visually "sits in" the page.

---

## 3. Colour tokens

All ratios below were calculated against the WCAG 2.x formula. AA requires ≥ 4.5:1 for normal text, ≥ 3:1 for large text (≥ 24px, or ≥ 18.66px bold) and for UI component boundaries.

### 3.1 Surfaces

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#070A12` | Page background |
| `--surface-1` | `#0E1320` | Cards, panels, header (solid) |
| `--surface-2` | `#151B2C` | Raised elements: hover state, vote buttons, inputs |
| `--surface-3` | `#1B2236` | Pressed / active fills, selected tab background, tooltips |
| `--viewer-bg` | `#000000` | Inside the image viewer only |
| `--overlay-scrim` | `rgba(3, 5, 10, 0.72)` | Behind dialogs and the mobile menu |

### 3.2 Borders

| Token | Hex | Contrast on `--surface-1` | Use |
|---|---|---|---|
| `--border` | `#26304A` | 1.42 (decorative) | Card outlines, dividers — never the only boundary of an input |
| `--border-strong` | `#5B6886` | **3.33** ✅ | Input, select, chip and vote-button outlines (meets 3:1 for UI components) |
| `--focus-ring` | `#7AD8F5` | 11.45 ✅ | 2px focus outline + 2px offset on every focusable element |

### 3.3 Text

| Token | Hex | on `--bg` | on `--surface-1` | on `--surface-3` | Use |
|---|---|---|---|---|---|
| `--text-primary` | `#E8ECF5` | 16.72 | 15.67 | 13.36 | Headings, body text, labels |
| `--text-secondary` | `#A6B0C5` | 9.08 | 8.51 | 7.25 | Descriptions, helper text, axis labels |
| `--text-muted` | `#8792AB` | 6.34 | 5.94 | 5.07 | Captions, timestamps, placeholder text, disabled labels |

All three pass AA for normal text on every surface.

### 3.4 Brand & action colours

| Token | Hex | Text colour on top | Ratio | Use |
|---|---|---|---|---|
| `--primary` | `#4CC9F0` (signal cyan) | `--on-primary` `#04121A` | 9.87 ✅ | The one primary button per screen, selected states, links, progress fill, focus |
| `--primary-hover` | `#7AD8F5` | `#04121A` | — | Hover on primary |
| `--primary-pressed` | `#2BB3DE` | `#04121A` | 7.78 ✅ | Pressed on primary |
| `--primary-subtle` | `rgba(76, 201, 240, 0.12)` | `--text-primary` | — | Selected vote button fill, selected chip fill |
| `--accent` | `#FFB547` (infrared amber) | `--on-accent` `#1A1000` | 10.69 ✅ | Target crosshair, "new" highlights, star ratings of difficulty, spectrum molecule bands. **Never** for buttons |
| `--accent-subtle` | `rgba(255, 181, 71, 0.12)` | `--accent` text | — | "Simulated sky" / "Demo data" badges |

`--primary` as text on `--surface-1` = 9.64 ✅, so it is safe for links.

### 3.5 Semantic colours

| Token | Hex | on `--surface-1` | Use |
|---|---|---|---|
| `--success` | `#3DDC97` | 10.49 ✅ | Training "correct" feedback, saved states |
| `--warning` | `#FFC857` | 12.05 ✅ | Partial data, low frame count |
| `--danger` | `#FF6B6B` | 6.68 ✅ | Errors, invalid input. Text on danger fill: `#1A0505` (7.09 ✅) |
| `--*-subtle` | same hue at 12% alpha | — | Background of alert banners and badges; text uses the full colour |

Always pair semantic colour with an **icon and words** ("Correct", "Error: …"). Colour is never the only signal.

### 3.6 Data & overlay colours (colour-blind safe)

Based on the Okabe–Ito palette. Okabe–Ito blue `#0072B2` is **excluded** (only 3.58:1 on dark).

| Token | Hex | Use |
|---|---|---|
| `--data-1` | `#56B4E9` (sky) | Gaia catalog circles, series 1 in charts |
| `--data-2` | `#E69F00` (orange) | WISE catalog circles, series 2, difference-mode positive (colour variant) |
| `--data-3` | `#009E73` (bluish green) | Series 3 |
| `--data-4` | `#F0E442` (yellow) | Series 4 |
| `--data-5` | `#D55E00` (vermillion) | Series 5 |
| `--data-6` | `#CC79A7` (reddish purple) | **Glitch-flag hatching**, series 6 |

Overlay-specific:

| Token | Value | Use |
|---|---|---|
| `--reticle` | `#FFB547` | Target crosshair |
| `--flag-hatch` | `#CC79A7` at 60% opacity, 45° hatch, 4px spacing | Glitch / contamination pixels (pattern + colour) |
| Merge channels | Visit 1 → red channel, visit 2 → green channel, visit 3 → blue channel (pure additive RGB) | Still stars add to white; movers show a coloured trail |
| Merge (colour-blind mode) | First visit → magenta (R+B), last visit → green | Still stars white; mover shows magenta → green |
| Difference (default) | Grey ramp: 0 → mid-grey `#808080`, positive → white, negative → black | Classic astronomy look |
| Difference (colour variant) | Positive → `#E69F00`, negative → `#56B4E9`, zero → `#000000` | For users who find grey hard to read |

### 3.7 Certificate (light) tokens

| Token | Hex | Ratio on paper |
|---|---|---|
| `--cert-paper` | `#FBF8F1` | — |
| `--cert-ink` | `#0B1220` | 17.65 ✅ |
| `--cert-muted` | `#4A5568` | 7.10 ✅ |
| `--cert-accent` | `#8A5A00` (deep amber) | 5.59 ✅ |

---

## 4. Typography

### 4.1 Families (load with `next/font/google`)

| Role | Font | Fallback | Why |
|---|---|---|---|
| Display & headings | **Space Grotesk** (500, 600) | `system-ui` | Technical, slightly futuristic, very readable |
| Body & UI | **Inter** (400, 500, 600) | `system-ui` | Excellent small-size legibility |
| Numbers, coordinates, code | **JetBrains Mono** (400, 500) | `ui-monospace` | Aligned digits; coordinates must never jump while typing |
| Bangla | **Noto Sans Bengali** (400, 500, 600) | — | Complete Bangla coverage; used for all text when language = বাংলা |

Enable `font-variant-numeric: tabular-nums` on stats, timers, frame counters and table numbers.

### 4.2 Type scale

| Token | Size / line height | Weight | Font | Use |
|---|---|---|---|---|
| `display` | 56 / 64 (mobile 36 / 44) | 600 | Space Grotesk | Landing hero headline only |
| `h1` | 40 / 48 (mobile 30 / 38) | 600 | Space Grotesk | Page titles |
| `h2` | 30 / 38 (mobile 24 / 32) | 600 | Space Grotesk | Section titles, classify question |
| `h3` | 22 / 30 | 500 | Space Grotesk | Card titles |
| `h4` | 18 / 26 | 500 | Inter | Small card titles, panel headings |
| `body-lg` | 18 / 28 | 400 | Inter | Hero subtitle, explainer text |
| `body` | 16 / 24 | 400 | Inter | Default text |
| `body-sm` | 14 / 20 | 400 | Inter | Helper text, table text, card meta |
| `caption` | 12 / 16 | 500 | Inter | Badges, axis labels, timestamps. Minimum size anywhere |
| `mono` | 14 / 20 | 400 | JetBrains Mono | Coordinates, frame counter, pixel readout |

Rules:
- Bangla text: increase line height by ~10% (e.g. body 16 / 26) — Bangla glyphs have taller stacks.
- Max line length for reading text: **68 characters** (`max-width: 68ch`).
- **Sentence case** everywhere ("Hunt for moving stars", not "Hunt For Moving Stars"). No ALL CAPS except 2–4 letter abbreviations (RA, FoV, D1).
- Never below 12px. Never pure white (`#FFFFFF`) text — use `--text-primary`.

---

## 5. Spacing, radius, elevation

**Spacing scale (4px base):** `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96`.

| Context | Value |
|---|---|
| Inside small controls (chip, badge) | 4–8 vertical, 12 horizontal |
| Inside cards | 24 desktop, 16 mobile |
| Gap between cards in a row | 24 desktop, 16 mobile |
| Gap between page sections | 64 desktop, 40 mobile |
| Gap between heading and its content | 12–16 |

**Radius:** `--radius-sm: 8px` (inputs, small buttons) · `--radius-md: 12px` (cards, panels, viewer) · `--radius-lg: 16px` (hero cards, dialogs) · `--radius-full: 9999px` (chips, badges, progress bars, avatar).

**Elevation:** use **borders, not shadows**. Only floating layers (menus, popovers, dialogs, toasts) get `0 12px 32px rgba(0, 0, 0, 0.45)`.

---

## 6. Glassmorphism — strict rules

Glass is a flavour, not a layout system.

**Allowed only on:**
1. The **site header** once the page is scrolled (`background: rgba(14, 19, 32, 0.72)`, `backdrop-filter: blur(12px)`, bottom border `rgba(255,255,255,0.06)`).
2. The **login card** and the **landing hero text card** over the decorative starfield.
3. **Dialogs** (over the scrim).

**Never on:** the viewer, anything over the viewer, chart cards, vote buttons, dense text cards.

**Fallback:** if `backdrop-filter` is unsupported, use solid `--surface-1`. Max blur 12px (performance).

---

## 7. Layout system — no sidebar

### 7.1 Breakpoints & grid

| Name | Min width | Columns | Gutter | Side margin |
|---|---|---|---|---|
| mobile | 0 | 4 | 16 | 16 |
| `sm` | 640 | 8 | 16 | 24 |
| `md` | 768 | 8 | 24 | 24 |
| `lg` | 1024 | 12 | 24 | 32 |
| `xl` | 1280 | 12 | 24 | auto (centred) |

**Containers:**
- `container-wide` max-width **1440px** — viewer pages (explore, classify, training, embed).
- `container` max-width **1200px** — landing, gallery, stats, guide.
- `container-read` max-width **720px** — about page, long text.

### 7.2 Page skeleton (every page)

```
┌──────────────────────────────────────────────────────────────┐
│ SITE HEADER (sticky, 64px desktop / 56px mobile)             │
├──────────────────────────────────────────────────────────────┤
│ PAGE CONTENT — sections stacked vertically, full width       │
│   section → section → section                                │
│ (no permanent left or right column on any page)              │
├──────────────────────────────────────────────────────────────┤
│ FOOTER                                                       │
└──────────────────────────────────────────────────────────────┘
```

### 7.3 Site header

```
┌───────────────────────────────────────────────────────────────────────────┐
│ [◎ AstroBlink]   Explore  Projects  Field guide  About     [EN|বাং] [⚙] [Sign in] │
└───────────────────────────────────────────────────────────────────────────┘
```
- Left: logo mark + wordmark (Space Grotesk 600, 20px). Links to `/`.
- Centre-left: 4 nav links (`body-sm` 500). Active link: `--text-primary` + 2px `--primary` underline 6px below text. Inactive: `--text-secondary`.
- Right: language toggle (segmented, 2 options), settings icon button (opens Settings dialog), then **Sign in** (secondary button) or avatar menu (My stats, Certificate, Sign out).
- **Mobile (< 768):** logo left, menu icon right. The menu opens as a **full-width sheet that drops down from the header** (not a side drawer), listing links vertically with 56px rows, plus language and settings at the bottom.

### 7.4 Footer

Three short columns on desktop, stacked on mobile: (1) logo + one-line mission, (2) links (Explore, Projects, Field guide, About, Embed), (3) credit line: **"Built with NASA SPHEREx data from IRSA/IPAC. AstroBlink is a NASA Space Apps Challenge project and is not endorsed by NASA."** `caption` size, `--text-muted`.

---

## 8. Page layouts (desktop wireframes + mobile notes)

Column spans refer to the 12-column grid at `lg`+.

### 8.1 Landing `/`

```
HEADER
┌─────────────────────────────── HERO (container, 64px top padding) ──────────────────────────────┐
│ ┌──── span 7 ─────────────────────────────┐  ┌──── span 5 ────────────────────────────┐        │
│ │ Badge: "NASA Space Apps 2026"           │  │  Mini live demo card (radius-lg)       │        │
│ │ display: "Watch the sky change."        │  │  ┌──────────── viewer-bg ──────────┐  │        │
│ │ body-lg: Spot moving stars and new      │  │  │  merged colour-trail animation  │  │        │
│ │ worlds in NASA SPHEREx infrared images. │  │  │  (slow, ≤1 change/sec)          │  │        │
│ │ [Try it now ▶] (primary, lg)            │  │  └──────────────────────────────────┘  │        │
│ │ [Join a project] (secondary, lg)        │  │  caption: "Simulated example"         │        │
│ │ caption: Free · No sign-up needed       │  └────────────────────────────────────────┘        │
│ └─────────────────────────────────────────┘                                                    │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
SECTION "How it works"  — h2 centred, then 3 cards (span 4 each)
  [1 Choose a spot]  [2 Watch it blink]  [3 Report what you see]
  each: 40px icon in --primary-subtle circle · h3 · body-sm (2 lines)
SECTION "Projects" — h2 left + "See all projects →" link right; 3 ProjectCards (span 4 each)
SECTION "Our community" — 4 KPI tiles (span 3 each) + "Demo data" badge next to h2
SECTION "What is SPHEREx?" — span 6 text (h2, 2 short paragraphs, link to About) | span 6 simulated sky image card
SECTION final CTA band — surface-1 card, centred h2 "Ready to look?" + [Try it now] primary
FOOTER
```
Mobile: hero stacks (text first, demo card second), all card rows become 1 column; KPI tiles become 2×2.
Decorative starfield (CSS dots at 3–6% opacity) appears **only** behind the hero.

### 8.2 Explore `/explore` (the core viewer)

```
HEADER
container-wide
┌─ Search row ───────────────────────────────────────────────────────────────────────────────────┐
│ [🔍 RA, Dec — e.g. 08h55m10.8s -07d14m42s ............ span 8 ] [FoV ▾ span 2] [Share span 2]  │
│ helper/error text under input (body-sm)                                                         │
├─ Preset chips row (horizontal scroll on mobile) ───────────────────────────────────────────────┤
│ (Barnard's Star) (Epsilon Indi B) (WISE 0855) (RW Aurigae) (R Draconis)                        │
├─ Viewer toolbar (48px) ────────────────────────────────────────────────────────────────────────┤
│ [Blink | Side by side | Merge | Difference | Stack]                     [−] [+] [⤢ fit] [⛶]     │
├─ VIEWER (full width, radius-md, viewer-bg) ─────────────────────────────────────────────────────┤
│                                                                                                  │
│                         sky image, centred, height = min(68vh, 720px)                           │
│                         reticle on target                                                        │
│  [Simulated sky] badge top-left (solid surface, not glass)                     frame 2 / 4  top-right │
├─ Player bar (64px, surface-1, attached to viewer bottom) ──────────────────────────────────────┤
│ [⏮] [▶] [⏭]   ●────────●────────●────────○   May 2025 · Nov 2025 · May 2026 · Nov 2026  [1×▾]  │
├─ Frame meta strip (body-sm, text-secondary) ───────────────────────────────────────────────────┤
│ 14 May 2025 · Detector D2 (1.1–1.6 μm) · FoV 5′ · RA 269.452° Dec +4.693°                      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
CARD ROW (24px gap)
┌─ Object card (span 4) ─────────────┐ ┌─ Light curve card (span 8) ────────────────────────────┐
│ h3 Barnard's Star                  │ │ h4 Brightness over time   (i)                         │
│ badge: Fast-moving star            │ │ chart: x = date, y = relative brightness              │
│ body-sm: 2–3 sentence explainer    │ │ points + error bars, current frame highlighted         │
│ "What to look for" bullet (1 line) │ │ caption: "Higher = brighter"                           │
└────────────────────────────────────┘ └────────────────────────────────────────────────────────┘
ADVANCED TOOLS PANEL (full width card, collapsed by default on first visit, remembers state)
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ h4 Advanced tools                                                        [Show ▾ / Hide ▴]   │
│ Tabs: Image · Compare · Glitch flags · Spectrum · Overlays · Share & embed                  │
│ ── tab content in a 12-col grid, controls left (span 4), preview/help right (span 8) ──      │
└──────────────────────────────────────────────────────────────────────────────────────────────┘
FOOTER
```

**Advanced tools tab contents**

| Tab | Controls |
|---|---|
| Image | Detector segmented control D1–D6 (each with μm range under label) · Stretch: Linear / Log / Asinh · Brightness slider · Contrast slider · Reset |
| Compare | Pick frames A and B (two selects) for side-by-side & difference · Difference style: Grey / Colour · Stack: frames to include (checkbox list) |
| Glitch flags | Toggle "Show glitch flags" · Legend (hatch swatch + "Unreliable pixel") · Count of flagged pixels in view |
| Spectrum | Instruction "Click any star in the image" · Spectrum chart (wavelength vs brightness) with molecule bands H₂O 3.0 μm, CH₄ 3.3 μm, CO₂ 4.27 μm, CO 4.67 μm · Export CSV |
| Overlays | Toggles: Gaia stars, WISE sources (later phase; show "Coming soon" disabled state now) |
| Share & embed | Copy link button · Embed snippet in mono code box + Copy · Download current frame PNG |

Mobile explore: search and FoV stack; Share becomes an icon in the toolbar; viewer height = `min(60vh, 100vw)`; mode control becomes a horizontally scrollable segmented control; card row stacks (object card first); tabs scroll horizontally.

### 8.3 Projects gallery `/projects`

```
container
h1 "Projects"  + body-lg "Pick a mission. No experience needed."
Filter chips: (All) (Beginner) (Intermediate) (Advanced)
Grid: 3 columns (lg), 2 (md), 1 (mobile), gap 24
┌─ ProjectCard ───────────────────────────┐
│ ┌─ thumbnail 16:9, viewer-bg ─────────┐ │
│ │ [Beginner] badge top-left           │ │
│ └─────────────────────────────────────┘ │
│ h3  Hunt for moving stars               │
│ body-sm 2 lines (clamp)                 │
│ meta row: ◎ "Did it move?" · 120 fields │
│ your progress: ▓▓▓░░░░ 30%  (if any)    │
│ [Start] primary  or [Continue]          │
└─────────────────────────────────────────┘
```
Whole card is not one giant link — the button is the action (clear focus target); title also links.

### 8.4 Project overview `/projects/[slug]`

```
container
back link "← All projects"
Hero card (radius-lg): span 5 thumbnail (looping slow blink) | span 7: badge, h1, body-lg, meta, [Start training] primary, [Skip to classify] tertiary (only if training done)
Section "What you'll do": 3 step cards (span 4): Practise → Look → Answer
Section "What to look for": 3 example cards (span 4) each with mini viewer + label (e.g. "Real mover", "Glitch", "Nothing changed")
```

### 8.5 Training `/projects/[slug]/train` and Classify `/projects/[slug]/classify`

Same layout. Training adds a **"Practice"** badge and shows feedback after each answer.

```
HEADER
container-wide
┌─ Task header ─────────────────────────────────────────────────────────────────────────────┐
│ ← Hunt for moving stars                                              [Practice] badge      │
│ h2 (centred): "Did anything move between pictures?"                                        │
│ body-sm centred: "Watch the blinking image. Use the field guide if you're unsure." [Field guide] │
├─ Viewer toolbar: [Blink | Side by side | Merge]  (difference/stack live in Tools)  zoom ───┤
├─ VIEWER (height min(60vh, 640px)) ───────────────────────────────────────────────────────┤
├─ Player bar ─────────────────────────────────────────────────────────────────────────────┤
└──────────────────────────────────────────────────────────────────────────────────────────┘
┌─ Answer card (container 960 centred) ────────────────────────────────────────────────────┐
│  [ ↗ Yes, something moved (1) ] [ ○ No change (2) ] [ ? Not sure (3) ] [ ⚠ Looks like a glitch (4) ] │
│  (buttons shown here are for a "motion" project — see table below for other task types)  │
│  (4 equal buttons in a row on lg; 2×2 grid on mobile; min height 64)                     │
│  [☆ Flag as interesting]  tertiary, right-aligned under buttons                          │
├─ Batch progress (directly under the answer card) ────────────────────────────────────────┤
│  Field 3 of 10   ▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░   30%                                     │
└──────────────────────────────────────────────────────────────────────────────────────────┘
After answering → Feedback card slides in UNDER the progress bar (height animates, no layout jump of the viewer):
  Classify: "Thanks! 78% of volunteers also said Yes."  (Demo data badge) [Next field →] primary (Enter)
  Training: ✓ "Correct — this is Barnard's Star, it really moves." / ✕ "Not quite — …" + [Next →]
Collapsed "Tools" accordion (full width): Difference · Stack · Glitch flags · Stretch
```

The project's question sets which buttons show:

| Project task type | Buttons |
|---|---|
| Motion | Yes, something moved · No change · Not sure · Looks like a glitch |
| Variability | Brightness changed · No change · Not sure · Looks like a glitch |
| Glitch patrol | Real object · Glitch · Not sure |

**Answer buttons are neutral** (surface-2, border-strong, icon + text + key hint). Selected = 2px `--primary` border + `--primary-subtle` fill. Never green "Yes" / red "No" (biases answers).

**Batch complete screen** (replaces viewer area): h2 "Batch complete!", 3 KPI tiles (fields checked, this session; total; flagged), buttons [Do 10 more] primary, [See my stats] secondary. A gentle break suggestion appears after 2 consecutive batches: "Great work. Rest your eyes for a minute?"

### 8.6 Field guide `/guide`

h1 + intro, then a 3/2/1-column grid of **ExampleCards**: mini viewer (looping, slow), h4 label ("A real mover", "A variable star", "Cosmic-ray glitch", "Bright-star spikes", "Nothing changed"), body-sm explanation, "How to tell" one-liner. Also opens as a **dialog** from classify pages.

### 8.7 Login `/login` (optional, mocked)

Centred glass card 420px wide over the decorative starfield.
h2 "Sign in to keep your progress" · inputs: Display name, Email · [Continue] primary · divider "or" · [Continue as guest] secondary · caption "Demo sign-in: nothing is sent anywhere; your progress is stored in this browser."

### 8.8 My stats `/me`

```
container
Profile card (full width): avatar initials circle (56px) · h2 name · caption "Contributing since 12 Nov 2026" · [Get certificate] primary right
KPI row: 4 tiles (span 3): Fields checked · Projects joined · Interesting flags · Agreement rate*
Row: Activity chart card (span 8, bar chart per day, last 14 days) | Projects breakdown card (span 4, horizontal bars)
Recent activity card (full width): table — date · project · your answer · (agreement after vote)
caption: *Agreement uses demo community data.
```

### 8.9 Community `/community`

h1 + **Demo data** badge (always visible). KPI row (4 tiles) · Line chart card full width "Classifications over time" · Row: "By project" bar chart (span 6) | "Volunteers by month" bar chart (span 6). **No individual leaderboard.**

### 8.10 Certificate `/me/certificate`

Centred preview (max 960px wide, A4 landscape ratio 1.414:1, light tokens) · action row below: [Download PNG] primary · [Print / Save as PDF] secondary · [Back to my stats] tertiary.
Certificate content: AstroBlink logo · "Certificate of contribution" (Space Grotesk 600) · name (h1 size) · "has checked **N** fields of the sky in AstroBlink projects" · project list · date · line "Built with NASA SPHEREx data. Not an official NASA certificate." No NASA logo, no NASA seal.

### 8.11 About `/about`

`container-read`. Sections: What is AstroBlink · What is SPHEREx · How blinking finds new objects (Pluto story) · About our data (synthetic vs real, labelled honestly) · Credits & acknowledgements · Team.

### 8.12 Embed `/embed`

No site header/footer. Compact bar (40px): logo mark + "Open in AstroBlink ↗". Then viewer + player bar only. Must fit 600×400 iframe.

---

## 9. Component specifications

### 9.1 Buttons

| Size | Height | Padding X | Font |
|---|---|---|---|
| sm | 32 | 12 | body-sm 500 |
| md (default) | 40 | 16 | body 500 |
| lg | 48 | 24 | body 600 |
| answer | min 64 | 16 | body 600 + 20px icon |

| Variant | Fill | Text | Border | Hover | Use |
|---|---|---|---|---|---|
| primary | `--primary` | `--on-primary` | none | `--primary-hover` | One per screen section |
| secondary | `--surface-2` | `--text-primary` | `--border-strong` | fill `--surface-3` | Alternatives |
| tertiary / ghost | transparent | `--primary` | none | `--primary-subtle` fill | Low-emphasis actions, links-as-buttons |
| danger | `--danger` | `#1A0505` | none | 90% opacity | Destructive (sign out confirm) |
| icon | transparent, 40×40 | `--text-secondary` | none | `--surface-2` | Toolbar, header. Always `aria-label` |

Disabled: 40% opacity, `cursor: not-allowed`, no hover. Minimum touch target 44×44 everywhere.

### 9.2 Inputs

Height 44 · fill `--surface-2` · 1px `--border-strong` · radius-sm · text `--text-primary` · placeholder `--text-muted`.
Focus: border `--primary` + focus ring. Error: border `--danger`, helper text in `--danger` with ⚠ icon, `aria-invalid`, `aria-describedby`.
**Coordinate input** uses JetBrains Mono, validates on blur and on Enter, shows parsed result under the field: "RA 133.795° · Dec −7.245°" in `--text-muted`.

### 9.3 Chips (presets, filters)

Height 36 · radius-full · padding 0 16 · fill `--surface-2` · border `--border-strong` · body-sm 500.
Selected: fill `--primary-subtle`, border `--primary`, text `--text-primary`, leading ✓ icon.

### 9.4 Segmented control (view modes, detector, language)

Container `--surface-2`, radius-sm, 4px padding. Segments 36 high. Active segment `--surface-3` fill + `--text-primary` + 2px bottom bar `--primary`. Inactive `--text-secondary`. Arrow keys move between segments (`role="radiogroup"`).

### 9.5 Cards

Fill `--surface-1` · 1px `--border` · radius-md · padding 24 (16 mobile).
Anatomy top→bottom: optional media → badge row → title (h3/h4) → body (body-sm, `--text-secondary`) → meta row (caption, `--text-muted`) → actions (right-aligned or full-width on mobile).
Hover (interactive cards only): border `--border-strong`, no lift, no shadow.

### 9.6 KPI tile

Card with: caption label (`--text-secondary`) → value (Space Grotesk 600, 32px, tabular) → optional delta line (caption). Height ~120. No icons larger than 20px.

### 9.7 Progress bar (batch)

Track 8px high, radius-full, `--surface-3`. Fill `--primary`, animates width 250ms. Label above-left "Field 3 of 10" (body-sm 500), percent above-right (caption, tabular). `role="progressbar"` with `aria-valuenow/min/max`. **Always starts at 0 for a new batch.**

### 9.8 Badges

Height 22 · radius-full · caption 500 · padding 0 8.
- Simulated sky / Demo data / Coming soon → `--accent-subtle` fill + `--accent` text.
- Difficulty: Beginner → `--success` subtle, Intermediate → `--warning` subtle, Advanced → `--primary` subtle (with text label, never colour alone).
- Practice → `--primary-subtle` + `--primary`.

### 9.9 Tabs & accordion

Tabs: 44 high, body-sm 500, active = `--text-primary` + 2px `--primary` underline; inactive `--text-secondary`. Scroll horizontally on mobile with fade edge.
Accordion header: 56 high, h4, chevron rotates 180° on open.

### 9.10 Dialogs, toasts, tooltips

Dialog: max-width 560, radius-lg, glass allowed, scrim `--overlay-scrim`, focus trapped, Esc closes.
Toast: bottom-centre, surface-3, radius-md, auto-hide 4s, `aria-live="polite"`.
Tooltip: surface-3, caption, max-width 240, appears after 400ms hover or on focus. Use tooltips to define jargon in the advanced panel (e.g. hover "Asinh" → "A stretch that shows faint and bright objects at the same time").

### 9.11 States (design all of them)

| State | Design |
|---|---|
| Loading viewer | Viewer shows skeleton shimmer (respect reduced motion: static) + "Loading frame 2 of 4…" centred, body-sm |
| Empty search | Viewer shows illustration-free empty state: h4 "Pick a spot in the sky" + body-sm + preset chips repeated |
| No data | "SPHEREx hasn't observed this spot yet" + [Try a preset] |
| Few frames (1–2) | Warning banner above viewer: "Only 2 observations here — motion may be hard to see." |
| Invalid coordinates | Inline error under input with example of a valid format |
| Error | Danger banner: what happened + [Try again] |
| Offline | Toast: "You're offline. Simulated sky still works." |

---

## 10. The viewer — detailed spec

**Structure:** three stacked `<canvas>` layers inside a container with `--viewer-bg` and radius-md:
1. **Image layer** — the sky pixels.
2. **Overlay layer** — reticle, glitch hatching, catalog circles, spectrum click marker.
3. **Interaction layer** — pointer events for pan, zoom, click.

**Sizing:** square images centred inside a 16:9-ish container. Desktop height `min(68vh, 720px)`; classify `min(60vh, 640px)`; mobile `min(60vh, 100vw − 32px)`.
**Pixel rendering:** `image-rendering: pixelated` when zoom ≥ 2× (astronomy pixels must not be smoothed).

**Reticle:** `--reticle`, four 10px ticks with a **12px gap at centre** (never covers the object), 1.5px stroke. Optional 1-ring circle showing 10″ radius.

**Corner controls inside viewer:** small solid chips (`--surface-1` at 90% opacity, no blur): top-left data badge, top-right frame counter, bottom-right zoom level. 12px from edges.

**Modes**

| Mode | Behaviour |
|---|---|
| Blink (default) | Plays frames in time order. Default 1 frame/sec, user range 0.5–2 frames/sec. **Hard cap 2/sec.** Loops. Pauses when tab hidden |
| Reduced motion | Blink becomes a 600ms cross-fade, max 1 change/sec, and does **not** autoplay |
| Side by side | Two equal panes (A = first frame, B = latest by default), synced pan/zoom/cursor crosshair. Stacks vertically on mobile |
| Merge | Single image. Up to 3 chosen frames mapped to R, G, B channels (default first, middle, last). Legend chip shows which date = which colour. Colour-blind mode: magenta/green, 2 frames |
| Difference | Frame B − frame A on float data (never on stretched 8-bit pixels). Grey or colour style. Legend: "Bright = appeared, dark = disappeared" |
| Stack | Mean of selected frames on float data, then stretched |

**Player bar:** prev / play-pause / next (40×40 icon buttons) · timeline track with one dot per frame positioned **by date**, labels under dots (caption, abbreviated "May ’25"), current dot `--primary` 12px, others `--border-strong` 8px · speed menu (0.5×, 1×, 2×). Clicking a dot jumps to that frame.

**Keyboard (viewer focused):** `Space` play/pause · `←/→` previous/next frame · `B S M D K` modes (Blink, Side, Merge, Difference, stacK) · `+/−` zoom · `0` fit · `F` glitch flags · `?` shortcut help. On classify pages `1–4` answer, `Enter` next.

---

## 11. Charts

| Chart | Type | x | y | Style |
|---|---|---|---|---|
| Light curve | Points + error bars, thin dashed connector | Date | Relative brightness (higher = brighter) | Points `--data-1`, current frame point ringed `--accent` |
| Spectrum | Line + points | Wavelength 0.75–5.0 μm | Relative brightness | Line `--data-1`; molecule bands as vertical shaded regions `--accent-subtle` with caption labels at top |
| Activity | Bars | Day | Fields checked | `--primary` |
| Projects breakdown | Horizontal bars | Count | Project | `--data-1…6` + labels on bars |
| Community over time | Line | Month | Classifications | `--data-1`, area fill 10% |

Common: background transparent on `--surface-1` card · gridlines `--border` 1px horizontal only · axis text caption `--text-secondary` · tooltips styled as §9.10 · every chart has a text summary for screen readers (`aria-label` or visually hidden paragraph) · no pie charts · no 3D.

---

## 12. Motion

| Token | Duration | Use |
|---|---|---|
| `--dur-fast` | 150ms | Hover, press, colour changes |
| `--dur-base` | 250ms | Panels opening, progress fill, tab switch |
| `--dur-slow` | 400ms | Feedback card reveal, page section fade-in |

Easing: `cubic-bezier(0.2, 0, 0, 1)` (standard decelerate). No bounces, no parallax, no confetti. Only animate `opacity` and `transform` (plus progress width). Everything respects `prefers-reduced-motion` **and** the in-app Reduced motion setting (either one turns motion down).

---

## 13. Iconography & imagery

- Icon set: **lucide-react**, stroke 1.75, sizes 16 (inline), 20 (buttons), 24 (feature cards max).
- Icons always paired with text, except toolbar icon buttons, which need `aria-label` + tooltip.
- Imagery: only sky images (real or simulated) and simple geometric marks. No stock photos, no astronaut illustrations, no NASA logos or mission patches.

---

## 14. Writing & text guidelines

**Voice:** friendly guide, plain words, short sentences. Talk to the user ("you"), not about "the user".

| Do | Don't |
|---|---|
| "Did anything move between pictures?" | "Indicate whether proper motion is detected" |
| "Try it now" | "Launch application" |
| "SPHEREx hasn't observed this spot yet" | "Error 404: no data" |
| "Only 2 observations here — motion may be hard to see." | "Insufficient epochs" |
| "Brightness over time" (chart title) with tooltip "light curve" | "Light curve" alone on beginner screens |

- Buttons start with a verb ("Start training", "Copy link"). Max 3 words where possible.
- Jargon is allowed in the Advanced tools panel **with a tooltip definition**.
- Numbers: always with units (5′, 1.42 μm, 14 May 2025). Dates as `D MMM YYYY`. Coordinates in mono: `08h55m10.8s −07°14′42.5″` and degrees `133.795°, −7.245°`. Use a real minus sign (−) in display.
- Bangla mode: translate all UI strings; keep coordinates, units and object names in Latin script; counts may use Bangla digits via `Intl.NumberFormat('bn-BD')`.
- Never claim certainty we don't have: say "possible mover", never "new planet discovered".

---

## 15. Accessibility checklist (design side)

- Contrast: all tokens above meet AA; do not introduce new colours without checking.
- Focus visible on everything (`--focus-ring`, 2px, offset 2px).
- Colour never the only signal: overlays use pattern + legend; states use icon + text.
- Flash safety: blink ≤ 2 changes/sec, reduced-motion cross-fade, no full-screen flashes.
- Target size ≥ 44×44.
- Every image/canvas has a text alternative describing the current frame ("Frame 2 of 4, 14 Nov 2025, detector D2").
- Headings in order (one h1 per page).
- Language attribute switches to `bn` in Bangla mode.
