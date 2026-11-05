/**
 * Typed API client for AstroBlink.
 *
 * Every UI call goes through `api`. When NEXT_PUBLIC_USE_MOCK_DATA is not
 * "false" (the default), operations are served by the SPHEREx mock engine via
 * mockService.ts. Set NEXT_PUBLIC_USE_MOCK_DATA=false to route the operations
 * the backend contract already defines to the real API.
 *
 * Browser requests go to NEXT_PUBLIC_API_BASE_URL; server-side rendering uses
 * API_INTERNAL_URL.
 */

import type {
  CandidateListResponse,
  ClassificationResponse,
  SubjectResponse,
} from "./generated/types";
import type { BenchmarkView, ClassificationRequestView, EpochView, OverlaysResponse, SpectrumResponse } from "./types";
import * as mock from "./mockService";
import type { ViewParams } from "./mockService";
import type { BandKey, Frame } from "@/lib/mock/spherexMockEngine";

export const USE_MOCK_DATA = process.env.NEXT_PUBLIC_USE_MOCK_DATA !== "false";

const API_BASE =
  typeof window !== "undefined"
    ? process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000"
    : process.env.API_INTERNAL_URL || "http://localhost:8000";

/**
 * Typed fetch wrapper with error handling.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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

const NOT_SERVED = (what: string) =>
  new Error(`${what} is not served by the backend yet. Set NEXT_PUBLIC_USE_MOCK_DATA=true to use mock data.`);

export const api = {
  health: () => apiFetch<{ status: string; db: string; redis: string }>("/health"),

  getSubject: (p: ViewParams): Promise<SubjectResponse> =>
    USE_MOCK_DATA ? mock.getSubject(p) : Promise.reject(NOT_SERVED("Subject lookup by coordinates")),

  getNextSubject: (fovArcmin?: number): Promise<SubjectResponse> =>
    USE_MOCK_DATA ? mock.getNextSubject(fovArcmin) : apiFetch<SubjectResponse>("/api/v1/subjects/next"),

  getEpochs: (): EpochView[] => mock.listEpochs(),

  listBenchmarks: (): BenchmarkView[] => mock.listBenchmarks(),

  resolveTarget: (name: string): Promise<BenchmarkView | null> =>
    USE_MOCK_DATA ? mock.resolveTarget(name) : Promise.reject(NOT_SERVED("Name resolution")),

  getOverlays: (p: ViewParams, epochIndex: number): Promise<OverlaysResponse> =>
    USE_MOCK_DATA ? mock.getOverlays(p, epochIndex) : Promise.reject(NOT_SERVED("Catalog overlays")),

  getSpectrum: (p: ViewParams, epochIndex: number, x: number, y: number): Promise<SpectrumResponse> =>
    USE_MOCK_DATA ? mock.getSpectrum(p, epochIndex, x, y) : Promise.reject(NOT_SERVED("Spectrophotometry")),

  getFrame: (p: ViewParams, epochIndex: number, band: BandKey): Promise<Frame | null> =>
    USE_MOCK_DATA ? mock.getFrame(p, epochIndex, band) : Promise.resolve(null),

  submitClassification: (body: ClassificationRequestView): Promise<ClassificationResponse> =>
    USE_MOCK_DATA
      ? mock.submitClassification(body)
      : apiFetch<ClassificationResponse>("/api/v1/classify", {
          method: "POST",
          body: JSON.stringify({ ...body, category: body.category }),
        }),

  listCandidates: (): Promise<CandidateListResponse> =>
    USE_MOCK_DATA ? mock.listCandidates() : apiFetch<CandidateListResponse>("/api/v1/candidates"),
};
