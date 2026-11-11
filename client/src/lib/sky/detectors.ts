import type { Detector } from "@/lib/data/types";

export interface DetectorInfo {
  id: Detector;
  /** Approximate wavelength range in μm (architecture §6: verify against the SPHEREx supplement). */
  minUm: number;
  maxUm: number;
}

export const DETECTORS: readonly DetectorInfo[] = [
  { id: "D1", minUm: 0.75, maxUm: 1.09 },
  { id: "D2", minUm: 1.1, maxUm: 1.62 },
  { id: "D3", minUm: 1.63, maxUm: 2.41 },
  { id: "D4", minUm: 2.42, maxUm: 3.82 },
  { id: "D5", minUm: 3.83, maxUm: 4.41 },
  { id: "D6", minUm: 4.42, maxUm: 5.0 },
];

export const DETECTOR_IDS = DETECTORS.map((d) => d.id) as Detector[];

export function detectorInfo(id: Detector): DetectorInfo {
  const found = DETECTORS.find((d) => d.id === id);
  if (!found) throw new Error(`Unknown detector ${id}`);
  return found;
}

/** Mid-band wavelength used as "the wavelength at the target pixel". */
export function midWavelengthUm(id: Detector): number {
  const { minUm, maxUm } = detectorInfo(id);
  return Math.round(((minUm + maxUm) / 2) * 100) / 100;
}
