/** Shared data types (architecture §4). */

export type Detector = "D1" | "D2" | "D3" | "D4" | "D5" | "D6";
export type ViewMode = "blink" | "side" | "merge" | "diff" | "stack";
export type StretchKind = "linear" | "log" | "asinh";
export type DataSourceKind = "synthetic" | "static" | "api";

export interface SkyTarget {
  raDeg: number; // 0 ≤ ra < 360
  decDeg: number; // −90 ≤ dec ≤ 90
  fovArcmin: number; // 2 | 5 | 10 | 15
  detector: Detector;
}

export interface FrameMeta {
  id: string;
  obsDate: string; // ISO 8601 (YYYY-MM-DD)
  detector: Detector;
  wavelengthUm: number; // wavelength at the target pixel
  width: number;
  height: number;
  pixelScaleArcsec: number; // ≈ 6.2 for SPHEREx
  hasFlags: boolean;
}

export interface FramePixels {
  frameId: string;
  width: number;
  height: number;
  data: Float32Array; // row-major, NaN = no data
  flags?: Uint8Array; // 0 = ok, >0 = glitch / unreliable
}

export interface LightCurvePoint {
  obsDate: string;
  flux: number;
  fluxErr: number;
  frameId: string;
}
export interface SpectrumPoint {
  wavelengthUm: number;
  flux: number;
  fluxErr: number;
}

export interface FieldData {
  fieldId: string;
  target: SkyTarget;
  frames: FrameMeta[]; // sorted by obsDate ascending; length N ≥ 0
  lightCurve?: LightCurvePoint[];
  source: DataSourceKind;
  isSimulated: boolean; // drives the "Simulated sky" badge
}

export type TaskType = "motion" | "variability" | "glitch";
export type Answer = "moved" | "brightness" | "no_change" | "not_sure" | "glitch" | "real";

export interface Project {
  slug: string;
  titleKey: string;
  descriptionKey: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  taskType: TaskType;
  defaultDetector: Detector;
  fieldCount: number;
  trainingFieldIds: string[];
}

export interface QueueField {
  fieldId: string;
  target: SkyTarget;
  truth?: Answer;
  explanationKey?: string;
  demoAgreement?: { answer: Answer; percent: number };
}

export interface Classification {
  id: string;
  projectSlug: string;
  fieldId: string;
  answer: Answer;
  flaggedInteresting: boolean;
  isTraining: boolean;
  createdAt: string;
}
