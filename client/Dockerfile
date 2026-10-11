# ==============================================================
# AstroBlink Client — Multi-stage Dockerfile
# Build context: this folder (client/)
# See docs/ARCHITECTURE.md §2.1
# ==============================================================

# ── Dependencies stage ────────────────────────────────────────
FROM node:22-alpine3.21 AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --ignore-scripts; else npm install --ignore-scripts; fi

# ── Build stage ───────────────────────────────────────────────
FROM node:22-alpine3.21 AS builder

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* vars are inlined at build time.
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

# Disable Next.js telemetry during build.
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── Dev stage (target for docker compose dev) ─────────────────
FROM node:22-alpine3.21 AS dev

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

EXPOSE 3000

CMD ["npm", "run", "dev"]

# ── Runtime stage (default) ───────────────────────────────────
FROM node:22-alpine3.21 AS runtime

# OCI labels
LABEL org.opencontainers.image.source="https://github.com/astroblink/AstroBlink" \
      org.opencontainers.image.title="astroblink-client" \
      org.opencontainers.image.description="AstroBlink Next.js frontend — blink comparator"

WORKDIR /app

# Non-root user (UID 10001).
RUN addgroup -g 10001 -S astroblink \
    && adduser -u 10001 -S -G astroblink -s /bin/false astroblink

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1

# Copy only production artifacts from builder.
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R astroblink:astroblink /app

# Health check using wget (available in Alpine busybox).
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:${PORT:-3000}/health || exit 1

USER 10001

EXPOSE 3000

# Runtime env vars (not build-time).
# API_INTERNAL_URL: used for SSR calls from container to API container.
# TILE_BASE_URL: browser-facing URL for tile images.
ENV PORT=3000

CMD ["node", "server.js"]
