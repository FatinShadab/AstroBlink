/**
 * Pixel maths for the view modes (design §10, architecture §8). Difference and stack run on Float32
 * data; merge and the overlays work on the stretched 8-bit frames (rules §4.5.1).
 */
import { percentileRange } from "./stretch";

export type RGB = readonly [number, number, number];
export type DiffStyle = "grey" | "colour";

/** Channels to RGBA. Each input is an 8-bit grey frame of the same size. */
export function mergeRgba(
  red: Uint8ClampedArray,
  green: Uint8ClampedArray,
  blue: Uint8ClampedArray,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(red.length * 4);
  for (let i = 0, j = 0; i < red.length; i++, j += 4) {
    out[j] = red[i];
    out[j + 1] = green[i];
    out[j + 2] = blue[i];
    out[j + 3] = 255;
  }
  return out;
}

/** Symmetric scale for a difference image: the 99.5th percentile of |difference|. */
export function differenceScale(diff: Float32Array): number {
  const abs = new Float32Array(diff.length);
  for (let i = 0; i < diff.length; i++) abs[i] = Math.abs(diff[i]);
  const { hi } = percentileRange([abs], 0, 99.5);
  return hi > 1e-6 ? hi : 1;
}

/**
 * Difference image to RGBA. Grey: 0 → mid-grey, positive → white, negative → black.
 * Colour: positive → `pos`, negative → `neg`, zero → black. NaN is black.
 */
export function diffToRgba(
  diff: Float32Array,
  style: DiffStyle,
  scale: number,
  pos: RGB,
  neg: RGB,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(diff.length * 4);
  for (let i = 0, j = 0; i < diff.length; i++, j += 4) {
    const v = diff[i];
    if (!Number.isFinite(v)) {
      out[j + 3] = 255;
      continue;
    }
    const t = Math.max(-1, Math.min(1, v / scale));
    if (style === "grey") {
      const g = Math.round(128 + 127 * t);
      out[j] = g;
      out[j + 1] = g;
      out[j + 2] = g;
    } else {
      const m = Math.abs(t);
      const c = t >= 0 ? pos : neg;
      out[j] = Math.round(c[0] * m);
      out[j + 1] = Math.round(c[1] * m);
      out[j + 2] = Math.round(c[2] * m);
    }
    out[j + 3] = 255;
  }
  return out;
}

/**
 * Glitch overlay: flagged pixels get a 45° hatch (every 4th diagonal) in `rgb` at `alpha`.
 * Unflagged pixels are transparent, so the sky shows through.
 */
export function flagOverlayRgba(
  flags: Uint8Array,
  width: number,
  height: number,
  rgb: RGB,
  alpha = 153,
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      if (flags[i] === 0 || (x + y) % 4 !== 0) continue;
      const j = i * 4;
      out[j] = rgb[0];
      out[j + 1] = rgb[1];
      out[j + 2] = rgb[2];
      out[j + 3] = alpha;
    }
  }
  return out;
}

/** Number of flagged pixels (any non-zero flag). */
export function countFlagged(flags: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < flags.length; i++) if (flags[i] !== 0) n++;
  return n;
}
