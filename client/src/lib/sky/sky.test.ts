import { describe, expect, it } from "vitest";
import { difference, meanStack } from "./imageMath";
import { hashSeed, mulberry32 } from "./prng";
import { percentileRange, stretchToU8, stretchUnit } from "./stretch";
import { greyToRgba } from "./render";

describe("prng", () => {
  it("gives the same sequence for the same seed", () => {
    const a = mulberry32(hashSeed("field", 1));
    const b = mulberry32(hashSeed("field", 1));
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("gives different seeds for different inputs", () => {
    expect(hashSeed("a", 1)).not.toBe(hashSeed("a", 2));
  });

  it("returns values in [0, 1)", () => {
    const rng = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe("stretch", () => {
  it("finds the clip range from percentiles, ignoring NaN", () => {
    const data = new Float32Array(1001);
    for (let i = 0; i < 1000; i++) data[i] = i;
    data[1000] = Number.NaN;
    const range = percentileRange([data], 0, 100);
    expect(range.lo).toBe(0);
    expect(range.hi).toBe(999);
  });

  it("never returns an empty range", () => {
    const flat = new Float32Array(10).fill(5);
    const range = percentileRange([flat]);
    expect(range.hi).toBeGreaterThan(range.lo);
  });

  it("maps endpoints to 0 and 1 for every stretch", () => {
    const range = { lo: 10, hi: 20 };
    for (const kind of ["linear", "log", "asinh"] as const) {
      expect(stretchUnit(10, range, kind)).toBeCloseTo(0, 9);
      expect(stretchUnit(20, range, kind)).toBeCloseTo(1, 9);
    }
  });

  it("is monotonic and clamps outside the range", () => {
    const range = { lo: 0, hi: 1 };
    const values = [-5, 0, 0.1, 0.5, 0.9, 1, 7].map((v) => stretchUnit(v, range, "asinh"));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    expect(values[0]).toBe(0);
    expect(values[values.length - 1]).toBe(1);
  });

  it("writes NaN pixels as black", () => {
    const out = stretchToU8(Float32Array.from([Number.NaN, 1]), { lo: 0, hi: 1 }, "linear");
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(255);
  });
});

describe("imageMath", () => {
  it("subtracts frame a from frame b per pixel", () => {
    const d = difference(Float32Array.from([5, 2]), Float32Array.from([1, 4]));
    expect(Array.from(d)).toEqual([4, -2]);
  });

  it("averages frames and ignores NaN per pixel", () => {
    const m = meanStack([Float32Array.from([1, Number.NaN]), Float32Array.from([3, 4])]);
    expect(m[0]).toBe(2);
    expect(m[1]).toBe(4);
  });
});

describe("render helpers", () => {
  it("expands grey to opaque RGBA", () => {
    expect(Array.from(greyToRgba(Uint8ClampedArray.from([7])))).toEqual([7, 7, 7, 255]);
  });
});
