/**
 * Typed API client for AstroBlink backend.
 *
 * Uses the types generated from contracts/openapi.yaml.
 * See src/lib/api/generated/types.ts (committed, generated via `npm run generate-types`).
 *
 * All fetch calls go to NEXT_PUBLIC_API_BASE_URL (browser)
 * or API_INTERNAL_URL (server-side rendering).
 */

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
    : process.env.API_INTERNAL_URL || "http://localhost:8000";

/**
 * Typed fetch wrapper with error handling.
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: { message: res.statusText } }));
    throw new Error(error?.error?.message || `API error: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

// ── Convenience methods (stubs — to be typed with generated types) ──

export const api = {
  health: () => apiFetch<{ status: string; db: string; redis: string }>("/health"),

  getNextSubject: () => apiFetch("/api/v1/subjects/next"),

  submitClassification: (body: unknown) =>
    apiFetch("/api/v1/classify", { method: "POST", body: JSON.stringify(body) }),

  fetchCutout: (body: unknown) =>
    apiFetch("/api/v1/cutouts/fetch", { method: "POST", body: JSON.stringify(body) }),

  listCandidates: (params?: Record<string, string>) => {
    const qs = params ? `?${new URLSearchParams(params)}` : "";
    return apiFetch(`/api/v1/candidates${qs}`);
  },
};
