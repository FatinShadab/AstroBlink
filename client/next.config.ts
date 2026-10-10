import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment.
  // Produces a minimal server.js that doesn't require node_modules.
  output: "standalone",

  // Strict mode for catching React issues early.
  reactStrictMode: true,

  // Runtime env vars (not build-time) — available in server components.
  // NEXT_PUBLIC_* vars are inlined at build time (see Dockerfile ARG).
  env: {
    API_INTERNAL_URL: process.env.API_INTERNAL_URL || "http://localhost:8000",
    TILE_BASE_URL:
      process.env.TILE_BASE_URL || "http://localhost:9000/astroblink-tiles",
  },
};

export default nextConfig;
