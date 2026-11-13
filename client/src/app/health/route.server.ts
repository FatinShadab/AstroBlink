/**
 * Liveness probe used by the Docker HEALTHCHECK (client/Dockerfile).
 * Named route.server.ts so the static export skips it (pageExtensions in next.config.ts).
 */
export function GET() {
  return Response.json({ status: "ok" });
}
