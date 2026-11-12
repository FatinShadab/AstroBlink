/**
 * Display-only fill for saturated star cores. SPHEREx leaves saturated pixels as NaN, which would draw
 * a bright star as a black hole. Each NaN region that is fully surrounded by real pixels is filled with
 * the brightest pixel on its border, so the star looks solid and bright. NaN regions that touch the image
 * edge (outside the observed area) stay NaN and are drawn as empty.
 *
 * Photometry and light curves must keep using the raw data; only the canvases use this.
 */
export function fillEnclosedNaN(data: Float32Array, width: number, height: number): Float32Array {
  const out = Float32Array.from(data);
  const seen = new Uint8Array(data.length);
  const stack: number[] = [];
  const region: number[] = [];

  for (let start = 0; start < data.length; start++) {
    if (seen[start] || !Number.isNaN(data[start])) continue;
    // Flood the NaN region containing `start` (4-connected).
    region.length = 0;
    stack.push(start);
    seen[start] = 1;
    let touchesEdge = false;
    let borderMax = -Infinity;
    while (stack.length > 0) {
      const i = stack.pop() as number;
      region.push(i);
      const x = i % width;
      const y = (i - x) / width;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesEdge = true;
      const neighbours = [
        x > 0 ? i - 1 : -1,
        x < width - 1 ? i + 1 : -1,
        y > 0 ? i - width : -1,
        y < height - 1 ? i + width : -1,
      ];
      for (const n of neighbours) {
        if (n < 0) continue;
        const v = data[n];
        if (Number.isNaN(v)) {
          if (!seen[n]) {
            seen[n] = 1;
            stack.push(n);
          }
        } else if (v > borderMax) {
          borderMax = v;
        }
      }
    }
    if (!touchesEdge && Number.isFinite(borderMax)) {
      for (const i of region) out[i] = borderMax;
    }
  }
  return out;
}
