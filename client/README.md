# AstroBlink Client

Next.js frontend for the AstroBlink citizen-science blink comparator.

**Owners:** Role 3 (Frontend Canvas Dev), Role 4 (UI/UX & Gamification Lead)

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page |
| `/classify` | Blink comparator — mark moving objects |
| `/tutorial` | Interactive onboarding tutorial |
| `/discoveries` | Discovery feed / candidate gallery |
| `/health` | Health check (API route, not visible) |

## Development (standalone)

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
# http://localhost:3000
```

## Type Generation

TypeScript API types are generated from `contracts/openapi.yaml`:

```bash
npm run generate-types
# Outputs to src/lib/api/generated/types.ts (committed)
```

## Testing

```bash
npm test          # vitest run
npm run test:watch  # vitest (watch mode)
```

## Docker

```bash
# Standalone build (requires NEXT_PUBLIC_API_BASE_URL)
docker build -t astroblink-client . --build-arg NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# Or via compose from repo root
make up
```
