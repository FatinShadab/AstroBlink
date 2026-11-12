import { describe, expect, it } from "vitest";
import { cleanSpectrum, paddedRange } from "./cleanSpectrum";

const p = (wavelengthUm: number, flux: number, fluxErr = 0) => ({ wavelengthUm, flux, fluxErr });

describe("cleanSpectrum", () => {
  it("drops a clear outlier and keeps a smooth trend", () => {
    const points = [p(1, 10), p(1.2, 10.5), p(1.4, 11), p(1.6, 80), p(1.8, 12), p(2, 12.4), p(2.2, 13)];
    const { kept, dropped } = cleanSpectrum(points);
    expect(dropped).toBe(1);
    expect(kept.map((x) => x.flux)).not.toContain(80);
  });

  it("drops non-finite values and keeps tiny spectra as they are", () => {
    const { kept, dropped } = cleanSpectrum([p(1, 5), p(2, Number.NaN), p(3, 6)]);
    expect(kept).toHaveLength(2);
    expect(dropped).toBe(1);
  });
});

describe("paddedRange", () => {
  it("fits the points and error bars with 10% padding", () => {
    const [lo, hi] = paddedRange([p(1, 10, 1), p(2, 20, 1)]);
    // data span 9..21 (12 wide) → padding 1.2
    expect(lo).toBeCloseTo(7.8, 5);
    expect(hi).toBeCloseTo(22.2, 5);
  });
});
