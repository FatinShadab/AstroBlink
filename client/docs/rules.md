# rules.md — non-negotiable rules for humans and AI agents

> These rules override convenience. If a task seems to need breaking a rule, stop and ask the team instead.
> Read `brain.md` (why), `design.md` (look), `architecture.md` (code structure) before writing code.

Rules are tagged **MUST** (never break), **SHOULD** (break only with a written reason in the PR / commit message).

---

## 1. Scope rules

1. **MUST** — Frontend only. No database, no custom server, no real authentication, no API keys, no secrets in the repo.
2. **MUST** — No sidebar on any page. Layouts are vertical "theater mode" (see `design.md` §7). Mobile navigation is a top drop-down sheet, not a side drawer.
3. **MUST** — The Explore viewer and the 5 presets work at all times. Never merge a change that breaks them.
4. **MUST** — Follow the build tiers in `brain.md` §9. Don't start a tier until the previous one is demo-able.
5. **MUST** — All data access goes through the `SkyDataProvider` interface (`architecture.md` §5). Components never fetch data directly.
6. **SHOULD** — Prefer existing, well-maintained libraries over hand-writing complex UI (dialogs, tabs, menus).

## 2. Honesty & ethics rules

1. **MUST** — Label simulated data: the viewer shows a "Simulated sky" badge whenever the synthetic provider is active.
2. **MUST** — Label demo numbers: community stats, agreement percentages and any number not produced by this user's own actions show a "Demo data" badge.
3. **MUST** — Branding is **AstroBlink**. Never "NASA AstroBlink". No NASA logo, meatball, worm, seal or mission patch anywhere (UI, favicon, certificate).
4. **MUST** — Credit data in the footer and About page: "Built with NASA SPHEREx data from IRSA/IPAC. AstroBlink is a NASA Space Apps Challenge project and is not endorsed by NASA."
5. **MUST** — Certificates say "Certificate of contribution" and "Not an official NASA certificate."
6. **MUST** — Show community agreement **only after** the user has answered.
7. **MUST** — No dark patterns: no progress bar that starts above 0, no never-ending progress, no fake scarcity or countdowns, no guilt-trip copy ("Are you sure you want to stop helping science?").
8. **MUST** — No individual leaderboards. Community stats are aggregate only.
9. **MUST** — Never claim discoveries. Use "possible mover" / "flagged as interesting", never "new planet found".

## 3. Accessibility & safety rules

1. **MUST** — WCAG 2.2 AA. Use only the colour tokens in `design.md` (all are contrast-checked).
2. **MUST** — Flash safety: blink rate hard-capped at **2 frame changes per second**; default 1. No full-screen flashing anything.
3. **MUST** — Respect `prefers-reduced-motion` **and** the in-app Reduced motion setting: no autoplay, cross-fade instead of hard blink, no animated decorations.
4. **MUST** — Every interactive element is keyboard reachable, has a visible focus ring, and has an accessible name.
5. **MUST** — Colour is never the only signal (overlays use patterns + legends; states use icons + words).
6. **MUST** — Canvases have a text alternative that updates with the frame (`aria-label` on the viewer region, plus `aria-live="polite"` frame announcements that only fire on user-initiated changes, not every autoplay tick).
7. **MUST** — Minimum touch target 44×44px.
8. **SHOULD** — Test each page with keyboard only and with a screen reader (NVDA or VoiceOver) once before demo.

## 4. Code rules

### 4.1 Language & style
1. **MUST** — TypeScript with `strict: true`. No `any` (use `unknown` + narrowing). No `@ts-ignore` without a comment explaining why.
2. **MUST** — ESLint + Prettier pass with zero errors before commit.
3. **MUST** — Function components only. Named exports for components (`export function ProjectCard`), default exports only where Next.js requires them (`page.tsx`, `layout.tsx`).
4. **SHOULD** — Components under ~200 lines. Split when larger.
5. **SHOULD** — One component per file; file name = component name in PascalCase (`PlayerBar.tsx`). Hooks in `useCamelCase.ts`. Utilities in `camelCase.ts`.

### 4.2 Next.js
1. **MUST** — App Router (`src/app`). Server Components by default; add `"use client"` only where needed (state, effects, browser APIs, canvas).
2. **MUST** — Canvas, `localStorage`, `window` and Recharts are only used in Client Components. Heavy client-only pieces (viewer, charts, Aladin) are loaded with `next/dynamic` and `ssr: false`.
3. **MUST** — Read URL state with the URL-state hook (`architecture.md` §7). Never mirror URL state into separate React state.
4. **MUST** — Fonts through `next/font`. Images through `next/image` except sky frames drawn to canvas.
5. **SHOULD** — Each route has `loading.tsx` and, where data can fail, `error.tsx`.

### 4.3 Styling
1. **MUST** — Tailwind CSS using the design tokens defined in `src/app/globals.css` (`@theme`). **No raw hex values** in components. No inline `style={{}}` except for dynamic values (e.g. progress width, canvas size).
2. **MUST** — No glassmorphism outside the 3 allowed places (`design.md` §6). Never over the viewer.
3. **MUST** — Sentence case for all UI text.
4. **SHOULD** — Use `cn()` (clsx + tailwind-merge) for conditional classes.

### 4.4 Text & i18n
1. **MUST** — No hard-coded user-facing strings in components. All strings come from `src/lib/i18n/en.ts` and `bn.ts` via `useT()`.
2. **MUST** — When adding an English string, add the Bangla key too (a placeholder copy of English is acceptable, marked `// TODO bn`).
3. **MUST** — Coordinates, units and astronomical object names stay in Latin script in both languages.

### 4.5 Image math
1. **MUST** — Difference, stack and merge operate on **Float32 pixel data**, never on stretched 8-bit pixels.
2. **MUST** — Frames are assumed aligned to the same pixel grid by the provider. The viewer never tries to re-project.
3. **MUST** — Coordinate parsing lives in one module (`src/lib/sky/coords.ts`) with unit tests, including negative declinations like `-00d30m00s`.

### 4.6 Performance budgets
1. **SHOULD** — Landing page first-load JS ≤ 150 KB gzip. Viewer route ≤ 300 KB gzip excluding sky images.
2. **SHOULD** — LCP < 2.5s on a mid-range phone over 4G for the landing page.
3. **MUST** — Preload all frames before blink playback starts; never fetch during playback.
4. **MUST** — Pause animation loops when the tab is hidden (`visibilitychange`).

## 5. Data & privacy rules

1. **MUST** — Mock login stores only display name and email in `localStorage`, under the `astroblink:v1` key namespace. Show that it is local-only.
2. **MUST** — No analytics, trackers or third-party cookies in this phase.
3. **MUST** — Never send user data anywhere. There is nowhere to send it.
4. **MUST** — Version the persisted store (`version: 1`) and write a migration when its shape changes.

## 6. Testing rules

1. **MUST** — Unit tests (Vitest) for: coordinate parser/formatter, stretch functions, image math (difference, stack, merge), synthetic generator determinism (same seed → same pixels), store reducers.
2. **SHOULD** — One Playwright smoke test that opens `/explore?preset=<id>` for each of the 5 presets and checks the viewer renders N > 1 frames without console errors.
3. **MUST** — Before every demo: run the 5-preset check manually on the deployed URL.

## 7. Git & workflow rules

1. **MUST** — Branch per feature: `feat/viewer-blink`, `fix/coords-negative-dec`.
2. **MUST** — Conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`.
3. **MUST** — `main` is always deployable.
4. **MUST** — When a product or design decision changes, update `brain.md` (Decision log) or `design.md` in the same PR.

## 8. Definition of done (every feature)

- [ ] Matches `design.md` (tokens, spacing, layout, states).
- [ ] Works at 360px, 768px, 1280px, 1440px widths.
- [ ] Keyboard and screen-reader accessible; focus visible.
- [ ] Reduced motion respected.
- [ ] All strings in i18n files (EN + BN keys).
- [ ] Loading, empty and error states implemented.
- [ ] No TypeScript, ESLint or console errors.
- [ ] Tests added where rules §6 require them.
- [ ] 5 presets still work.

## 9. Rules for AI coding agents specifically

1. **MUST** — Read all four docs before the first change in a session.
2. **MUST** — Work one tier / one feature at a time. After each, list what changed and how to verify it.
3. **MUST** — Do not invent astronomy facts or numbers. If a value is unknown (e.g. exact preset coordinates), leave a clearly marked `TODO` and tell the team.
4. **MUST** — Do not add dependencies outside `architecture.md` §2 without explaining why and getting approval.
5. **MUST** — Do not delete or rewrite these docs. Propose changes; update the Decision log when a change is agreed.
6. **MUST** — If a rule conflicts with a request, follow the rule and say which rule blocked the request.
