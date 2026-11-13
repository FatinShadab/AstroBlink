/**
 * Which timeline dots get a date label. All of them when no two labels would overlap; otherwise only the
 * first, middle and last (the middle is dropped if it would still overlap an end, and the last if it
 * overlaps the first). `positions` are label centres in pixels, in frame order (dates ascending).
 */
export function visibleLabels(positions: number[], minGapPx: number): Set<number> {
  const n = positions.length;
  if (n === 0) return new Set();
  const all = new Set(positions.map((_, i) => i));
  let overlaps = false;
  for (let i = 1; i < n; i++) {
    if (positions[i] - positions[i - 1] < minGapPx) {
      overlaps = true;
      break;
    }
  }
  if (!overlaps) return all;

  const first = 0;
  const last = n - 1;
  const mid = Math.floor((n - 1) / 2);
  const out = new Set([first]);
  const clear = (a: number, b: number) => Math.abs(positions[a] - positions[b]) >= minGapPx;
  if (last !== first && clear(first, last)) out.add(last);
  if (mid !== first && mid !== last && clear(mid, first) && (!out.has(last) || clear(mid, last))) out.add(mid);
  return out;
}
