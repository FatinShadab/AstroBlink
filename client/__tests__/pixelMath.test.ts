import { describe, it, expect } from "vitest";
import {
  DEFAULT_STRETCH,
  applyTone,
  coaddFrames,
  computeStats,
  grayscaleRgba,
  maskRgba,
  signedRgba,
  subtractFrames,
  transfer,
} from "@/lib/render/pixelMath";

describe("co-add and difference imaging", () => {
  it("co-adds by averaging pixel intensities", () => {
    const sum = coaddFrames([new Float32Array([2, 4]), new Float32Array([6, 8])]);
    expect(Array.from(sum)).toEqual([4, 6]);
  });

  it("subtracts the reference epoch pixel by pixel", () => {
    expect(Array.from(subtractFrames(new Float32Array([5, 1]), new Float32Array([2, 3])))).toEqual([3, -2]);
  });

  it("maps stationary (zero-residual) pixels to neutral grey and dipoles to bright/dark", () => {
    const values = new Float32Array(400).fill(0);
    values[10] = 500; // bright residual
    values[20] = -500; // dark residual
    const rgba = signedRgba(values, DEFAULT_STRETCH);
    const grey = (i: number) => rgba[i * 4];
    expect(Math.abs(grey(5) - 128)).toBeLessThanOrEqual(2);
    expect(grey(10)).toBeGreaterThan(grey(5));
    expect(grey(20)).toBeLessThan(grey(5));
  });
});

describe("stretch and tone", () => {
  it("keeps transfer functions in [0, 1]", () => {
    for (const kind of ["linear", "log", "asinh", "zscale"] as const) {
      expect(transfer(0, kind)).toBeCloseTo(0);
      expect(transfer(1, kind)).toBeCloseTo(1);
    }
  });

  it("inverts when night-vision mode is on", () => {
    expect(applyTone(0.2, { ...DEFAULT_STRETCH, invert: true })).toBeCloseTo(0.8);
  });

  it("computes robust statistics that ignore a bright outlier", () => {
    const data = new Float32Array(1000).fill(40);
    data[0] = 1e6;
    const stats = computeStats(data);
    expect(stats.median).toBe(40);
    expect(stats.sigma).toBeLessThan(1);
  });

  it("renders opaque RGBA with the right length", () => {
    const rgba = grayscaleRgba(new Float32Array([0, 1, 2, 3]), DEFAULT_STRETCH);
    expect(rgba.length).toBe(16);
    expect(rgba[3]).toBe(255);
  });
});

describe("bitmask overlay", () => {
  it("colours flagged pixels and leaves clean pixels transparent", () => {
    const mask = new Uint8Array([0, 2, 8]);
    const rgba = maskRgba(mask);
    expect(rgba[3]).toBe(0);
    expect(rgba[7]).toBeGreaterThan(0); // saturation (red) is drawn
    expect(rgba[11]).toBeGreaterThan(0); // dead/hot (lime) is drawn
  });
});
