import { NextResponse } from "next/server";

/**
 * GET /health — Client health check.
 *
 * Docker HEALTHCHECK target. Returns 200 with status JSON.
 * Does not check API connectivity (that's the API's health endpoint).
 */
export async function GET() {
  return NextResponse.json({ status: "ok", service: "client" });
}
