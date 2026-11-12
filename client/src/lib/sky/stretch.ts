/**
 * Percentile clip and stretch (architecture §8). The clip range is computed once per field
 * from all frames together, so blinking never shows fake brightness changes.
 */

export type StretchKind = "linear" | "log" | "asinh";

export interface ClipRange {
  lo: number;
  hi: number;
}

const MAX_SAMPLES = 200_000;

/**
 * Low/high percentile of the finite values across one or more frames.
 * NaN is ignored. Large inputs are sampled with a fixed stride so this stays fast.
 */
export function percentileRange(
  frames: readonly Float32Array[],
  loPct = 0.5,
  hiPct = 99.5,
): ClipRange {
  let total = 0;
  for (const f of frames) total += f.length;
  const stride = Math.max(1, Math.floor(total / MAX_SAMPLES));
  const samples: number[] = [];
  for (const f of frames) {
    for (let i = 0; i < f.length; i += stride) {
      const v = f[i];
      if (Number.isFinite(v)) samples.push(v);
    }
  }
  if (samples.length === 0) return { lo: 0, hi: 1 };
  samples.sort((a, b) => a - b);
  const at = (pct: number) =>
    samples[
      Math.min(samples.length - 1, Math.max(0, Math.round((pct / 100) * (samples.length - 1))))
    ];
  const lo = at(loPct);
  let hi = at(hiPct);
  if (hi <= lo) hi = lo + 1e-6;
  return { lo, hi };
}

/** Map a value to 0..1 for the chosen stretch. Inputs outside the range are clamped. */
export function stretchUnit(value: number, range: ClipRange, kind: StretchKind): number {
  const t = Math.min(1, Math.max(0, (value - range.lo) / (range.hi - range.lo)));
  switch (kind) {
    case "linear":
      return t;
    case "log":
      return Math.log1p(LOG_A * t) / Math.log1p(LOG_A);
    case "asinh":
      return Math.asinh(ASINH_A * t) / Math.asinh(ASINH_A);
  }
}

const LOG_A = 100;
const ASINH_A = 10;

/** Display adjustments from the Image tab: brightness shifts, contrast scales around mid-grey. */
export interface Adjust {
  brightness: number; // −0.5 … 0.5
  contrast: number; // 0.25 … 3
}

export const NO_ADJUST: Adjust = { brightness: 0, contrast: 1 };

/** Float32 frame → 8-bit grey. NaN pixels become black (no data). */
export function stretchToU8(
  data: Float32Array,
  range: ClipRange,
  kind: StretchKind,
  adjust: Adjust = NO_ADJUST,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data.length);
  for (let i = 0; i < data.length; i++) {
    const v = data[i];
    if (!Number.isFinite(v)) continue;
    const u = stretchUnit(v, range, kind);
    const adjusted = Math.min(
      1,
      Math.max(0, (u - 0.5) * adjust.contrast + 0.5 + adjust.brightness),
    );
    out[i] = Math.round(255 * adjusted);
  }
  return out;
}
