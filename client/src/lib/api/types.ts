/**
 * Frontend view types layered on top of generated/types.ts.
 *
 * generated/types.ts mirrors the backend contract. Anything the contract does
 * not yet describe (spectra, overlays, the annotation categories used by the
 * citizen-science UI) lives here so the generated file stays untouched.
 */

import type { ClassificationRequest, ClassificationResponse, ClassificationCategory } from "./generated/types";

/** Annotation categories shown to citizen scientists. */
export type AnnotationCategory =
  | "fast_mover"
  | "slow_mover"
  | "variable_star"
  | "transient"
  | "detector_artifact";

export const ANNOTATION_CATEGORIES: Array<{ value: AnnotationCategory; label: string; hint: string }> = [
  { value: "fast_mover", label: "Fast Mover / Asteroid", hint: "Moves several pixels per epoch" },
  { value: "slow_mover", label: "Slow Mover / Brown Dwarf", hint: "Small, consistent proper motion" },
  { value: "variable_star", label: "Variable Star", hint: "Brightness changes, fixed position" },
  { value: "transient", label: "Transient / Supernova", hint: "Appears in one epoch only" },
  { value: "detector_artifact", label: "Detector Artifact", hint: "Cosmic ray, streak or hot pixel" },
];

/** Maps annotation categories onto the nearest backend category until the contract is extended. */
export const ANNOTATION_TO_CONTRACT: Record<AnnotationCategory, ClassificationCategory> = {
  fast_mover: "asteroid_neo",
  slow_mover: "brown_dwarf",
  variable_star: "planet_x_candidate",
  transient: "planet_x_candidate",
  detector_artifact: "artifact",
};

export interface ClassificationRequestView extends Omit<ClassificationRequest, "category"> {
  category: AnnotationCategory;
}

export interface SpectrumResponse {
  subject_id: string;
  epoch: number;
  ra: number;
  dec: number;
  pixel_x: number;
  pixel_y: number;
  wavelength_um: number[];
  flux_ujy: number[];
  sigma_ujy: number[];
  nearest_source: string | null;
}

export interface GaiaSourceView {
  id: string;
  x: number;
  y: number;
  g_mag: number;
  pm_angle_deg: number;
  pm_px_per_yr: number;
}

export interface WiseSourceView {
  id: string;
  label: string;
  year: number;
  x: number;
  y: number;
  current_x: number;
  current_y: number;
  in_frame: boolean;
}

export interface OverlaysResponse {
  gaia: GaiaSourceView[];
  wise: WiseSourceView[];
}

export interface EpochView {
  index: number;
  epoch: number;
  label: string;
  iso_date: string;
  mjd: number;
}

export interface BenchmarkView {
  id: string;
  name: string;
  description: string;
  ra: number;
  dec: number;
  default_fov_arcmin: number;
}

/** Local tagged candidate, persisted per viewer and exportable as JSON / CSV. */
export interface TaggedCandidate {
  id: string;
  subject_id: string;
  category: AnnotationCategory;
  notes: string;
  epoch: number;
  pixel_x: number;
  pixel_y: number;
  ra: number;
  dec: number;
  created_at: string;
  spectrum: SpectrumResponse | null;
  submit_result: ClassificationResponse | null;
}
