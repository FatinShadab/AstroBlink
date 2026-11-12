import { describe, expect, it } from "vitest";
import { cropAround, glitchMask, presetIdOfFrame, selectMatchedWavelength } from "./staticProvider";

describe("glitchMask", () => {
  it("keeps unreliable bits and ignores informational and clipped values", () => {
    // 0 ok; 1 cosmic ray; 2 saturated; 8 (bit 3, unused) ignored; 32 (bit 5 reference) ignored;
    // 64 non-functional; 255 clipped (mostly "part of a star") ignored.
    const raw = Uint8Array.from([0, 1, 2, 8, 32, 64, 255]);
    expect(Array.from(glitchMask(raw))).toEqual([0, 1, 1, 0, 0, 1, 0]);
  });
});

describe("selectMatchedWavelength", () => {
  const f = (obsDate: string, wavelengthUm: number, detector: "D2" | "D6" = "D6") => ({
    obsDate,
    wavelengthUm,
    detector,
  });

  it("keeps the largest group within the tolerance (WISE 0855 D6 pattern)", () => {
    const frames = [
      f("2025-05-05", 4.961),
      f("2025-11-10", 4.507),
      f("2025-11-14", 4.976),
      f("2026-04-21", 4.48),
      f("2026-05-11", 4.961),
    ];
    const picked = selectMatchedWavelength(frames).map((x) => x.obsDate);
    expect(picked).toEqual(["2025-05-05", "2025-11-14", "2026-05-11"]);
  });

  it("prefers the group spanning the longest time when sizes tie", () => {
    const frames = [
      f("2025-08-21", 1.101, "D2"),
      f("2025-08-27", 1.107, "D2"),
      f("2025-08-30", 1.496, "D2"),
      f("2026-09-22", 1.511, "D2"),
    ];
    const picked = selectMatchedWavelength(frames).map((x) => x.obsDate);
    expect(picked).toEqual(["2025-08-30", "2026-09-22"]);
  });

  it("widens the tolerance to reach at least three frames", () => {
    // D2 base tolerance 1.2 %: only pairs match; at 2.4 % three frames group together.
    const frames = [
      f("2025-01-01", 1.1, "D2"),
      f("2025-06-01", 1.12, "D2"),
      f("2026-01-01", 1.13, "D2"),
      f("2026-06-01", 1.5, "D2"),
    ];
    expect(selectMatchedWavelength(frames).map((x) => x.obsDate)).toEqual([
      "2025-01-01",
      "2025-06-01",
      "2026-01-01",
    ]);
  });

  it("returns nothing when no two frames match", () => {
    expect(selectMatchedWavelength([f("2025-01-01", 4.4), f("2025-06-01", 4.9)])).toEqual([]);
  });
});

describe("presetIdOfFrame", () => {
  it("strips the detector and observation suffix", () => {
    expect(presetIdOfFrame("wise-0855-D6-6080151418")).toBe("wise-0855");
    expect(presetIdOfFrame("eps-indi-b-D2-6116233696")).toBe("eps-indi-b");
    expect(presetIdOfFrame("rw-aur-D3-1")).toBe("rw-aur");
  });
});

describe("cropAround", () => {
  // 4×4 image with values 0..15, flags equal to value % 2.
  const width = 4;
  const height = 4;
  const data = Float32Array.from({ length: 16 }, (_, i) => i);
  const flags = Uint8Array.from({ length: 16 }, (_, i) => i % 2);

  it("returns a window centred on the target pixel", () => {
    const { data: out } = cropAround(data, flags, width, height, { x: 2, y: 2 }, 2);
    // x0 = 1, y0 = 1 → rows 1–2, columns 1–2.
    expect(Array.from(out)).toEqual([5, 6, 9, 10]);
  });

  it("fills pixels outside the cutout with NaN and flag 0", () => {
    const { data: out, flags: outFlags } = cropAround(data, flags, width, height, { x: 0, y: 0 }, 3);
    // x0 = y0 = −1: the first row and column fall outside the image.
    expect(Number.isNaN(out[0])).toBe(true);
    expect(outFlags[0]).toBe(0);
    expect(out[4]).toBe(0); // (1,1) of the window is image pixel (0,0)
    expect(out[8]).toBe(5);
  });
});
