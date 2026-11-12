import type { SpectrumPoint } from "../types";
import { gaussian, hashSeed, mulberry32 } from "@/lib/sky/prng";

/**
 * Simulated spectrum template (architecture §5.2 step 8). Shape only: a gentle continuum,
 * a broad water dip near 2.7 μm and a methane dip near 3.3 μm. Not a fitted model.
 */
const WAVE_MIN_UM = 0.75;
const WAVE_MAX_UM = 5.0;
const STEP_UM = 0.05;

function dip(wave: number, centre: number, width: number, depth: number): number {
  return depth * Math.exp(-((wave - centre) ** 2) / (2 * width * width));
}

export function spectrumTemplate(seedKey: string): SpectrumPoint[] {
  const rng = mulberry32(hashSeed(seedKey, "spectrum"));
  const points: SpectrumPoint[] = [];
  for (let w = WAVE_MIN_UM; w <= WAVE_MAX_UM + 1e-9; w += STEP_UM) {
    const wave = Math.round(w * 100) / 100;
    const continuum = 1 + (0.2 * (wave - 2.5)) / 2.5;
    const shape = continuum - dip(wave, 2.7, 0.3, 0.15) - dip(wave, 3.3, 0.1, 0.3);
    const err = 0.02;
    points.push({
      wavelengthUm: wave,
      flux: Math.max(0.01, shape + err * gaussian(rng)),
      fluxErr: err,
    });
  }
  return points;
}
