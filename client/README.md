# AstroBlink client

Next.js (App Router) frontend for AstroBlink. Phase 2 adds the Explore viewer: coordinate search, five test
targets, blink playback with a 2-frames-per-second cap, reduced-motion cross-fade, and URL-shareable state.

All sky data comes from a `SkyDataProvider`. The default source is synthetic and labelled "Simulated sky".

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
| `npm test` | Vitest unit tests (coordinates, stretch, image maths, synthetic determinism, URL state) |
| `npm run format:check` | Prettier check |

## Docs

Product and build rules are in `docs/` (`brain.md`, `design.md`, `rules.md`, `architecture.md`).
When a decision changes, update the decision log in `docs/brain.md` in the same change.

## Known gaps (see decision log)

- Epsilon Indi B and R Draconis have no verified coordinates yet, so their chips are disabled.
- The static data provider falls back to synthetic until the file format is decided.
- `/dev/ui` is a temporary primitives page. Delete it before demo.
- Only Blink mode works. Side by side, merge, difference, stack and light curves arrive in Phase 3.
