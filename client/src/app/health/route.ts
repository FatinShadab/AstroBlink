/** Liveness probe used by the Docker HEALTHCHECK (client/Dockerfile). */
export function GET() {
  return Response.json({ status: "ok" });
}
