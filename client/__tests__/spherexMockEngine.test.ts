import { describe, it, expect } from "vitest";
import {
  BENCHMARK_TARGETS,
  CHANNEL_COUNT,
  TEMPLATE_REF_UM,
  absorptionFactor,
  EPOCHS,
  WAVELENGTHS_UM,
  buildScene,
  channelsForBand,
  channelsInArray,
  estimateTransferMB,
  isBandKey,
  renderFrame,
  spectrumAt,
  targetWorldAt,
  templateFlux,
  variabilityFactor,
} from "@/lib/mock/spherexMockEngine";

describe("channel grid", () => {
  it("has 102 channels spanning 0.75–5.00 µm", () => {
    expect(WAVELENGTHS_UM).toHaveLength(CHANNEL_COUNT);
    expect(WAVELENGTHS_UM[0]).toBeCloseTo(0.75);
    expect(WAVELENGTHS_UM[CHANNEL_COUNT - 1]).toBeCloseTo(5.0);
  });

  it("partitions every channel into exactly one of the six arrays", () => {
    const all = [1, 2, 3, 4, 5, 6].flatMap((a) => channelsInArray(a as 1 | 2 | 3 | 4 | 5 | 6));
    expect(all.sort((a, b) => a - b)).toEqual(Array.from({ length: CHANNEL_COUNT }, (_, i) => i));
  });

  it("validates band keys", () => {
    expect(isBandKey("stack")).toBe(true);
    expect(isBandKey("a6")).toBe(true);
    expect(isBandKey("ch101")).toBe(true);
    expect(isBandKey("ch102")).toBe(false);
    expect(isBandKey("a7")).toBe(false);
    expect(isBandKey("swir")).toBe(false);
    expect(channelsForBand("ch5")).toEqual([5]);
  });
});

describe("epochs and targets", () => {
  it("spaces four epochs roughly six months apart from May 2025 to Nov 2026", () => {
    expect(EPOCHS.map((e) => e.isoDate)).toEqual(["2025-05-01", "2025-11-01", "2026-05-01", "2026-11-01"]);
  });

  it("moves WISE 0855 measurably between epochs", () => {
    const wise = BENCHMARK_TARGETS.find((t) => t.id === "wise_0855")!;
    const a = targetWorldAt(wise, EPOCHS[0].decimalYear);
    const b = targetWorldAt(wise, EPOCHS[3].decimalYear);
    const arcsec = Math.hypot((b.ra - a.ra) * 3600 * Math.cos((wise.dec * Math.PI) / 180), (b.dec - a.dec) * 3600);
    expect(arcsec).toBeGreaterThan(10); // ~8.5″/yr × 1.5 yr
  });

  it("varies RW Aurigae and R Draconis in brightness", () => {
    const rw = BENCHMARK_TARGETS.find((t) => t.id === "rw_aur")!;
    const rd = BENCHMARK_TARGETS.find((t) => t.id === "r_dra")!;
    const rwFactors = EPOCHS.map((e) => variabilityFactor(rw, e));
    expect(Math.max(...rwFactors) / Math.min(...rwFactors)).toBeGreaterThan(2);
    const rdFactors = EPOCHS.map((e) => variabilityFactor(rd, e));
    expect(Math.max(...rdFactors)).toBeGreaterThan(Math.min(...rdFactors));
  });
});

describe("rendering", () => {
  const scene = buildScene({ ra: 133.795, dec: -7.245 }, 5);

  it("is deterministic for the same scene, epoch and band", () => {
    const a = renderFrame(scene, 1, "a3");
    const b = renderFrame(scene, 1, "a3");
    expect(a.data).toEqual(b.data);
    expect(a.mask).toEqual(b.mask);
  });

  it("produces a 128×128 frame with a noise sigma that falls with more channels", () => {
    const narrow = renderFrame(scene, 0, "ch10");
    const stack = renderFrame(scene, 0, "stack");
    expect(narrow.data.length).toBe(128 * 128);
    expect(stack.sigma).toBeLessThan(narrow.sigma);
  });

  it("flags saturation and dead pixels in the bitmask", () => {
    const frame = renderFrame(scene, 0, "stack");
    const flags = frame.mask.reduce((acc, m) => acc | m, 0);
    expect(flags & 8).toBe(8); // hot pixels are always injected
  });

  it("returns spectra on the full channel grid with sigma per channel", () => {
    const s = spectrumAt(scene, 0, 64, 64);
    expect(s.fluxUjy).toHaveLength(CHANNEL_COUNT);
    expect(s.sigmaUjy).toHaveLength(CHANNEL_COUNT);
  });
});

describe("templates", () => {
  it("normalizes every template to unity at the reference wavelength", () => {
    expect(templateFlux("t_dwarf", TEMPLATE_REF_UM)).toBeCloseTo(1, 6);
    expect(templateFlux("m_dwarf", TEMPLATE_REF_UM)).toBeCloseTo(1, 6);
  });

  it("keeps cold-brown-dwarf dynamic range physical (no runaway red flux)", () => {
    // A 375 K Y dwarf should not be brighter than ~10× the reference at 5 µm.
    expect(templateFlux("y_dwarf", 5.0)).toBeLessThan(10);
  });

  it("applies strong methane absorption in Y-type brown dwarfs at 2.2 µm", () => {
    expect(absorptionFactor("y_dwarf", 2.2)).toBeLessThan(0.5);
    expect(absorptionFactor("y_dwarf", 4.0)).toBeCloseTo(1, 6);
  });
});

describe("estimates", () => {
  it("grows with field of view and with the number of bands", () => {
    expect(estimateTransferMB(30, 1)).toBeGreaterThan(estimateTransferMB(1, 1));
    expect(estimateTransferMB(5, 6)).toBeGreaterThan(estimateTransferMB(5, 1));
  });
});
