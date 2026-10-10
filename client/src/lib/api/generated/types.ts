/**
 * AUTO-GENERATED from contracts/openapi.yaml via openapi-typescript.
 *
 * Regenerate: npm run generate-types
 *
 * This file is committed so client/ builds standalone without
 * access to contracts/. Do not edit manually.
 */

// ── Placeholder types until first real generation ──

/** GET /health response */
export interface HealthResponse {
  status: string;
  db: string;
  redis: string;
}

/** POST /api/v1/cutouts/fetch request */
export interface CutoutFetchRequest {
  ra: number;
  dec: number;
  size_deg?: number;
}

/** POST /api/v1/cutouts/fetch response */
export interface CutoutFetchResponse {
  job_id: string;
  status: "queued";
  ra: number;
  dec: number;
  size_deg: number;
  message?: string;
}

/** GET /api/v1/subjects/next response */
export interface SubjectResponse {
  id: string;
  ra_deg: number;
  dec_deg: number;
  size_deg: number;
  epochs: number[];
  tile_urls: Record<string, string>;
  wcs_urls?: Record<string, string>;
  classification_count?: number;
  retired?: boolean;
}

/** Mark within a classification */
export interface Mark {
  epoch: number;
  pixel_x: number;
  pixel_y: number;
  ra: number;
  dec: number;
}

/** POST /api/v1/classify request */
export interface ClassificationRequest {
  subject_id: string;
  category: ClassificationCategory;
  marks: Mark[];
  load_time_ms?: number;
}

/** POST /api/v1/classify response */
export interface ClassificationResponse {
  classification_id: string;
  subject_id: string;
  category: string;
  marks_count: number;
  subject_classification_count: number;
  subject_retired: boolean;
  badges_earned: string[];
  message?: string;
}

/** Classification category enum */
export type ClassificationCategory =
  | "asteroid_neo"
  | "comet"
  | "brown_dwarf"
  | "planet_x_candidate"
  | "artifact"
  | "nothing";

/** Candidate status enum */
export type CandidateStatus =
  | "new"
  | "under_review"
  | "confirmed"
  | "rejected";

/** Candidate response */
export interface CandidateResponse {
  id: string;
  subject_id: string;
  category: ClassificationCategory;
  status: CandidateStatus;
  n_classifications: number;
  mean_reliability: number;
  cluster_dispersion_arcsec?: number;
  motion_arcsec_per_epoch?: number;
  motion_pa_deg?: number;
  created_at: string;
  updated_at: string;
}

/** GET /api/v1/candidates response */
export interface CandidateListResponse {
  candidates: CandidateResponse[];
  count: number;
}

/** Error envelope */
export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; issue?: string }>;
  };
}
