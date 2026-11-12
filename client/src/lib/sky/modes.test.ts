import { describe, expect, it } from "vitest";
import { centreAperture } from "./lightCurve";
import { countFlagged, diffToRgba, differenceScale, flagOverlayRgba, mergeRgba } from "./modes";
import { stretchToU8, NO_ADJUST } from "./stretch";

const RED: [number, number, number] = [230, 159, 0];
const BLUE: [number, number, number] = [86, 180, 233];

describe("merge", () => {
  it("maps the three channels to RGB, opaque", () => {
    const out = mergeRgba(
      Uint8ClampedArray.from([10]),
      Uint8ClampedArray.from([20]),
      Uint8ClampedArray.from([30]),
    );
    expect(Array.from(out)).toEqual([10, 20, 30, 255]);
  });
});

describe("difference", () => {
  it("uses a symmetric scale from |difference|", () => {
    const scale = differenceScale(Float32Array.from([-4, 1, 2, 3, 4]));
    expect(scale).toBeGreaterThan(0);
    expect(scale).toBeLessThanOrEqual(4);
  });

  it("grey style: zero is mid-grey, positive is brighter, negative darker", () => {
    const out = diffToRgba(Float32Array.from([0, 10, -10]), "grey", 10, RED, BLUE);
    expect(out[0]).toBe(128);
    expect(out[4]).toBe(255);
    expect(out[8]).toBe(1);
  });

  it("colour style: positive uses the warm colour, negative the cool one", () => {
    const out = diffToRgba(Float32Array.from([10, -10]), "colour", 10, RED, BLUE);
    expect(Array.from(out.slice(0, 3))).toEqual(RED);
    expect(Array.from(out.slice(4, 7))).toEqual(BLUE);
  });

  it("treats NaN as black", () => {
    const out = diffToRgba(Float32Array.from([Number.NaN]), "grey", 1, RED, BLUE);
    expect(Array.from(out)).toEqual([0, 0, 0, 255]);
  });
});

describe("glitch overlay", () => {
  it("hatches only flagged pixels, with a 4px diagonal spacing", () => {
    const flags = new Uint8Array(16).fill(1); // 4×4, all flagged
    const out = flagOverlayRgba(flags, 4, 4, RED);
    let hatched = 0;
    for (let i = 3; i < out.length; i += 4) if (out[i] > 0) hatched++;
    // (x + y) % 4 === 0 for x, y in 0..3: (0,0), (1,3), (2,2), (3,1) → 4 pixels
    expect(hatched).toBe(4);
  });

  it("counts flagged pixels", () => {
    expect(countFlagged(Uint8Array.from([0, 1, 2, 0]))).toBe(2);
  });
});

describe("centre aperture photometry", () => {
  it("is brighter at a bright centre than at the sky", () => {
    const side = 10;
    const data = new Float32Array(side * side).fill(100);
    data[5 * side + 5] = 600;
    const point = centreAperture(data, side);
    expect(point.flux).toBeGreaterThan(0);
  });

  it("gives zero flux for a flat frame", () => {
    const flat = new Float32Array(49).fill(7);
    expect(centreAperture(flat, 7).flux).toBeCloseTo(0, 6);
  });
});

describe("contrast and brightness", () => {
  it("leaves output unchanged with the neutral settings", () => {
    const data = Float32Array.from([0, 5, 10]);
    const plain = stretchToU8(data, { lo: 0, hi: 10 }, "linear");
    const same = stretchToU8(data, { lo: 0, hi: 10 }, "linear", NO_ADJUST);
    expect(Array.from(same)).toEqual(Array.from(plain));
  });

  it("raising brightness makes mid-grey brighter", () => {
    const data = Float32Array.from([5]);
    const bright = stretchToU8(data, { lo: 0, hi: 10 }, "linear", { brightness: 0.2, contrast: 1 });
    expect(bright[0]).toBeGreaterThan(127);
  });
});
