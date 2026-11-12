import { describe, expect, it } from "vitest";
import { fillEnclosedNaN } from "./fill";

describe("fillEnclosedNaN", () => {
  it("fills a saturated core with the brightest border pixel", () => {
    // 5×5 with a 1-pixel NaN core surrounded by values up to 9.
    const n = Number.NaN;
    const data = Float32Array.from([
      0, 0, 0, 0, 0,
      0, 5, 9, 5, 0,
      0, 7, n, 8, 0,
      0, 5, 6, 5, 0,
      0, 0, 0, 0, 0,
    ]);
    const out = fillEnclosedNaN(data, 5, 5);
    expect(out[12]).toBe(9);
    expect(data[12]).toBeNaN(); // the raw data is untouched
  });

  it("leaves NaN regions that touch the edge empty", () => {
    const n = Number.NaN;
    const data = Float32Array.from([
      n, n, 1,
      n, 2, 3,
      4, 5, 6,
    ]);
    const out = fillEnclosedNaN(data, 3, 3);
    expect(out[0]).toBeNaN();
    expect(out[1]).toBeNaN();
    expect(out[3]).toBeNaN();
  });
});
