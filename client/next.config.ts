import type { NextConfig } from "next";

/**
 * NEXT_OUTPUT=export builds a fully static site into out/ (Cloudflare Pages, `npm run build:static`).
 * The default stays the standalone server output for the Docker runtime stage (client/Dockerfile).
 */
const staticExport = process.env.NEXT_OUTPUT === "export";

const nextConfig: NextConfig = {
  output: staticExport ? "export" : "standalone",
  // Files named *.server.ts (the /health probe) are routes only in the server build; a static export
  // has no server to answer them, so there they are left out.
  pageExtensions: staticExport ? ["tsx", "ts"] : ["tsx", "ts", "server.ts"],
  // Partial prerendering needs a server, so both are off in the static export (Next refuses otherwise).
  cacheComponents: !staticExport,
  partialPrefetching: !staticExport,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(staticExport
    ? {
        // No image optimisation server in a static export. The /embed header lives in public/_headers.
        images: { unoptimized: true },
      }
    : {
        async headers() {
          return [
            {
              // Embeds may be framed by any site (architecture §10, brain Phase 3 acceptance).
              source: "/embed",
              headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
            },
          ];
        },
      }),
};

export default nextConfig;
