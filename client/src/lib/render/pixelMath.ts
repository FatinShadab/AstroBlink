/**
 * Pure pixel math for the blink comparator: co-add, difference imaging,
 * stretch / tone transfer, and RGB composition. No DOM or canvas access, so
 * everything here is unit-testable and reusable for real tile data.
 */

import { clamp } from "@/lib/coords";

export type DisplayMode = "blink" | "coadd" | "diff";
export type StretchKind = "linear" | "log" | "asinh" | "zscale";

export interface StretchSettings {
  kind: StretchKind;
  invert: boolean;
  /** Additive shift applied after the transfer function, in [-0.5, 0.5]. */
  brightness: number;
  /** Multiplicative contrast around mid-grey, in [0.5, 3]. */
  contrast: number;
}

export const DEFAULT_STRETCH: StretchSettings = {
  kind: "zscale",
  invert: false,
  brightness: 0,
  contrast: 1,
};

export interface FrameStats {
  median: number;
  sigma: number;
  p05: number;
  p997: number;
  min: number;
  max: number;
}

const statsCache = new WeakMap<Float32Array, FrameStats>();

/** Median, robust sigma (MAD-based) and percentiles. Cached per array identity. */
export function computeStats(data: Float32Array): FrameStats {
  const cached = statsCache.get(data);
  if (cached) return cached;
  const n = data.length;
  if (n === 0) {
    const empty = { median: 0, sigma: 1, p05: 0, p997: 1, min: 0, max: 0 };
    statsCache.set(data, empty);
    return empty;
  }
  const sorted = Float32Array.from(data).sort();
  const median = sorted[Math.floor(n / 2)];
  const dev = new Float32Array(n);
  for (let i = 0; i < n; i++) dev[i] = Math.abs(sorted[i] - median);
  dev.sort();
  const sigma = Math.max(1e-6, 1.4826 * dev[Math.floor(n / 2)]);
  const stats: FrameStats = {
    median,
    sigma,
    p05: sorted[Math.floor(n * 0.005)],
    p997: sorted[Math.min(n - 1, Math.floor(n * 0.997))],
    min: sorted[0],
    max: sorted[n - 1],
  };
  statsCache.set(data, stats);
  return stats;
}

/** Display limits for a stretch. zscale uses median ± sigma; others use percentiles. */
export function displayLimits(stats: FrameStats, kind: StretchKind): { lo: number; hi: number } {
  if (kind === "zscale") {
    return { lo: stats.median - 2 * stats.sigma, hi: stats.median + 20 * stats.sigma };
  }
  const lo = stats.p05;
  const hi = Math.max(stats.p997, lo + 1e-6);
  return { lo, hi };
}

/** Transfer function on a normalized value t in [0, 1]. */
export function transfer(t: number, kind: StretchKind): number {
  const x = clamp(t, 0, 1);
  switch (kind) {
    case "log":
      return Math.log10(1 + 100 * x) / 2;
    case "asinh":
      return Math.asinh(10 * x) / Math.asinh(10);
    default:
      return x;
  }
}

/** Applies brightness, contrast and invert to a [0, 1] display value. */
export function applyTone(v01: number, s: StretchSettings): number {
  let v = (v01 - 0.5) * s.contrast + 0.5 + s.brightness;
  v = clamp(v, 0, 1);
  return s.invert ? 1 - v : v;
}

function toByte(v01: number): number {
  return Math.round(clamp(v01, 0, 1) * 255);
}

/** Single-channel display: stretch, tone, then grey RGBA. */
export function grayscaleRgba(
  values: Float32Array,
  s: StretchSettings,
  limits?: { lo: number; hi: number },
): Uint8ClampedArray {
  const { lo, hi } = limits ?? displayLimits(computeStats(values), s.kind);
  const span = Math.max(hi - lo, 1e-9);
  const out = new Uint8ClampedArray(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const t = (values[i] - lo) / span;
    const g = toByte(applyTone(transfer(t, s.kind), s));
    const o = i * 4;
    out[o] = g;
    out[o + 1] = g;
    out[o + 2] = g;
    out[o + 3] = 255;
  }
  return out;
}

/**
 * Difference-image display. Zero maps to neutral grey, positive residuals
 * brighten and negative residuals darken, so moving objects become dipoles
 * and variables become bright/dark residuals.
 */
export function signedRgba(values: Float32Array, s: StretchSettings): Uint8ClampedArray {
  const stats = computeStats(values);
  const absVals = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) absVals[i] = Math.abs(values[i] - stats.median);
  absVals.sort();
  // Noise-only residuals stay grey (±5σ spans the display); strong residuals still saturate.
  const limit = Math.max(5 * stats.sigma, absVals[Math.floor(absVals.length * 0.995)] ?? 1, 1e-6);

  const out = new Uint8ClampedArray(values.length * 4);
  for (let i = 0; i < values.length; i++) {
    const v = values[i] - stats.median;
    const mag = transfer(Math.abs(v) / limit, s.kind);
    const signed = 0.5 + 0.5 * Math.sign(v) * mag;
    const g = toByte(applyTone(signed, s));
    const o = i * 4;
    out[o] = g;
    out[o + 1] = g;
    out[o + 2] = g;
    out[o + 3] = 255;
  }
  return out;
}

/** False-colour composite: each array is stretched with its own limits, then mapped to R, G, B. */
export function composeRgbRgba(
  r: Float32Array,
  g: Float32Array,
  b: Float32Array,
  s: StretchSettings,
): Uint8ClampedArray {
  const chans = [r, g, b].map((arr) => {
    const { lo, hi } = displayLimits(computeStats(arr), s.kind);
    const span = Math.max(hi - lo, 1e-9);
    const out = new Uint8Array(arr.length);
    for (let i = 0; i < arr.length; i++) {
      out[i] = toByte(applyTone(transfer((arr[i] - lo) / span, s.kind), s));
    }
    return out;
  });
  const [cr, cg, cb] = chans;
  const out = new Uint8ClampedArray(r.length * 4);
  for (let i = 0; i < r.length; i++) {
    const o = i * 4;
    out[o] = cr[i];
    out[o + 1] = cg[i];
    out[o + 2] = cb[i];
    out[o + 3] = 255;
  }
  return out;
}

/** Mean of several equally-sized frames (co-add). */
export function coaddFrames(frames: Float32Array[]): Float32Array {
  if (frames.length === 0) return new Float32Array(0);
  const n = frames[0].length;
  const out = new Float32Array(n);
  for (const f of frames) {
    for (let i = 0; i < n; i++) out[i] += f[i];
  }
  const k = 1 / frames.length;
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

/** Pixel-wise a − b (difference imaging). */
export function subtractFrames(a: Float32Array, b: Float32Array): Float32Array {
  const n = Math.min(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = a[i] - b[i];
  return out;
}

/** Colour overlay for the SPHEREx bitmask (cosmic rays, saturation, stray light, dead/hot). */
export const MASK_COLORS: Array<{ bit: number; rgb: [number, number, number]; label: string }> = [
  { bit: 1, rgb: [232, 121, 249], label: "Cosmic ray hit" },
  { bit: 2, rgb: [239, 68, 68], label: "Detector saturation" },
  { bit: 4, rgb: [56, 189, 248], label: "Stray light" },
  { bit: 8, rgb: [163, 230, 53], label: "Dead / hot pixel" },
];

export function maskRgba(mask: Uint8Array, enabledBits = 0xf, alpha = 150): Uint8ClampedArray {
  const out = new Uint8ClampedArray(mask.length * 4);
  for (let i = 0; i < mask.length; i++) {
    const bits = mask[i] & enabledBits;
    if (!bits) continue;
    // Highest-priority flag wins for colour (saturation > cosmic ray > dead > stray).
    const pick =
      MASK_COLORS.find((m) => bits & m.bit && m.bit === 2) ??
      MASK_COLORS.find((m) => bits & m.bit) ??
      null;
    if (!pick) continue;
    const o = i * 4;
    out[o] = pick.rgb[0];
    out[o + 1] = pick.rgb[1];
    out[o + 2] = pick.rgb[2];
    out[o + 3] = alpha;
  }
  return out;
}

/** Reads one pixel of a size × size field, or NaN when out of bounds. */
export function pixelValue(values: Float32Array, size: number, x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  if (ix < 0 || iy < 0 || ix >= size || iy >= size) return Number.NaN;
  return values[iy * size + ix];
}
