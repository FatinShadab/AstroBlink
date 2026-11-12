import type { SpectrumPoint } from "@/lib/data/types";

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Removes clear outliers before plotting a spectrum. Each point is compared with the median of its
 * neighbours in wavelength (up to `window` points on each side); a point whose difference is more than
 * `k` median absolute deviations from the typical difference is dropped. Non-finite values are dropped too.
 * Fewer than 5 points are returned as they are (too few to judge).
 */
export function cleanSpectrum(
  points: SpectrumPoint[],
  { window = 3, k = 3 }: { window?: number; k?: number } = {},
): { kept: SpectrumPoint[]; dropped: number } {
  const finite = points
    .filter((p) => Number.isFinite(p.flux) && Number.isFinite(p.wavelengthUm))
    .sort((a, b) => a.wavelengthUm - b.wavelengthUm);
  const nonFinite = points.length - finite.length;
  if (finite.length < 5) return { kept: finite, dropped: nonFinite };

  const residuals = finite.map((p, i) => {
    const neighbours: number[] = [];
    for (let j = Math.max(0, i - window); j <= Math.min(finite.length - 1, i + window); j++) {
      if (j !== i) neighbours.push(finite[j].flux);
    }
    return p.flux - median(neighbours);
  });
  const centre = median(residuals);
  const mad = median(residuals.map((r) => Math.abs(r - centre)));
  if (mad === 0) return { kept: finite, dropped: nonFinite };

  const kept = finite.filter((_, i) => Math.abs(residuals[i] - centre) <= k * mad);
  return { kept, dropped: nonFinite + (finite.length - kept.length) };
}

/** Y-axis range that fits every point and its error bar, with about 10% padding on each side. */
export function paddedRange(points: SpectrumPoint[], padding = 0.1): [number, number] {
  if (points.length === 0) return [0, 1];
  let lo = Infinity;
  let hi = -Infinity;
  for (const p of points) {
    const err = Number.isFinite(p.fluxErr) ? Math.abs(p.fluxErr) : 0;
    lo = Math.min(lo, p.flux - err);
    hi = Math.max(hi, p.flux + err);
  }
  const span = hi - lo || Math.abs(hi) || 1;
  return [lo - span * padding, hi + span * padding];
}
