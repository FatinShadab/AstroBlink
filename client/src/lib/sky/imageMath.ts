/**
 * Float32 image maths (rules §4.5). Never run these on stretched 8-bit pixels.
 */

/** Frame b minus frame a, per pixel. NaN in either input gives NaN. */
export function difference(b: Float32Array, a: Float32Array): Float32Array {
  if (a.length !== b.length) throw new Error("difference: frames must share a grid");
  const out = new Float32Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b[i] - a[i];
  return out;
}

/** Per-pixel mean of several frames, ignoring NaN. Pixels with no data stay NaN. */
export function meanStack(frames: readonly Float32Array[]): Float32Array {
  if (frames.length === 0) throw new Error("meanStack: no frames");
  const n = frames[0].length;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    let count = 0;
    for (const f of frames) {
      const v = f[i];
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
    out[i] = count > 0 ? sum / count : Number.NaN;
  }
  return out;
}
