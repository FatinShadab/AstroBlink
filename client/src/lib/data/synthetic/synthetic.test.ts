import { describe, expect, it } from "vitest";
import { PRESETS, isPresetReady, presetAt, presetById } from "@/data/presets";
import {
  fieldSide,
  buildFieldData,
  fieldIdFor,
  frameIdFor,
  generateFramePixels,
  parseFieldId,
  splitFrameId,
} from "./generateField";
import { visitDates, firstVisitUtc } from "./epochs";
import type { SkyTarget } from "../types";

const target: SkyTarget = { raDeg: 133.795, decDeg: -7.245, fovArcmin: 5, detector: "D6" };
const TODAY = new Date(Date.UTC(2026, 10, 12));

describe("epochs", () => {
  it("starts on or after 15 May 2025 and spaces visits 182 days apart", () => {
    const dates = visitDates(0, TODAY);
    expect(dates[0].getTime()).toBe(Date.UTC(2025, 4, 15));
    expect(dates[1].getTime() - dates[0].getTime()).toBe(182 * 24 * 60 * 60 * 1000);
  });

  it("adds frames as time passes (never hard-coded to 3 or 4)", () => {
    const now = visitDates(100, new Date(Date.UTC(2026, 10, 12))).length;
    const later = visitDates(100, new Date(Date.UTC(2028, 10, 12))).length;
    expect(later).toBeGreaterThan(now);
  });

  it("offsets the first visit by RA, within 0–180 days", () => {
    const offset = (firstVisitUtc(359) - firstVisitUtc(0)) / (24 * 60 * 60 * 1000);
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThanOrEqual(180);
  });
});

describe("synthetic field", () => {
  it("sizes the field from the FoV (5′ ≈ 48 px, 15′ ≈ 145 px)", () => {
    expect(fieldSide(5)).toBe(48);
    expect(fieldSide(15)).toBe(145);
  });

  it("is deterministic: the same target gives the same pixels", () => {
    const a = generateFramePixels(target, 1, TODAY);
    const b = generateFramePixels(target, 1, TODAY);
    expect(a.data.length).toBe(fieldSide(5) ** 2);
    expect(Array.from(a.data.slice(0, 200))).toEqual(Array.from(b.data.slice(0, 200)));
    expect(Array.from(a.flags ?? [])).toEqual(Array.from(b.flags ?? []));
  });

  it("gives different noise for different frames", () => {
    const a = generateFramePixels(target, 0, TODAY);
    const b = generateFramePixels(target, 1, TODAY);
    expect(Array.from(a.data.slice(0, 50))).not.toEqual(Array.from(b.data.slice(0, 50)));
  });

  it("builds one frame per visit, with ids that round-trip", () => {
    const field = buildFieldData(target, TODAY);
    expect(field.isSimulated).toBe(true);
    expect(field.frames.length).toBe(visitDates(target.raDeg, TODAY).length);
    const fieldId = fieldIdFor(target);
    expect(field.fieldId).toBe(fieldId);
    expect(splitFrameId(frameIdFor(fieldId, 2))).toEqual({ fieldId, index: 2 });
    expect(parseFieldId(fieldId)).toEqual(target);
  });

  it("flags some glitches (1 = cosmic ray, 2 = saturation) without NaN pixels", () => {
    const px = generateFramePixels(target, 0, TODAY);
    expect(px.flags?.some((f) => f > 0)).toBe(true);
    expect(Array.from(px.data).every((v) => Number.isFinite(v))).toBe(true);
  });
});

describe("contributor options (classify and practice)", () => {
  const plain: SkyTarget = { raDeg: 10, decDeg: 10, fovArcmin: 5, detector: "D3" };

  it("keeps cosmic-ray hits out of the outer 10% of the frame", () => {
    for (let ra = 0; ra < 360; ra += 15) {
      const t = { ...plain, raDeg: ra };
      const px = generateFramePixels(t, 0, TODAY, { contributor: true });
      const side = px.width;
      const margin = Math.ceil(side * 0.1);
      px.flags?.forEach((f, i) => {
        if ((f & 1) === 0) return;
        const x = i % side;
        const y = Math.floor(i / side);
        expect(x).toBeGreaterThanOrEqual(margin);
        expect(y).toBeGreaterThanOrEqual(margin);
        expect(x).toBeLessThan(side - margin);
        expect(y).toBeLessThan(side - margin);
      });
    }
  });

  it("has no cosmic-ray hits outside Glitch patrol (glitches: false)", () => {
    for (let ra = 0; ra < 360; ra += 30) {
      const px = generateFramePixels({ ...plain, raDeg: ra }, 0, TODAY, { contributor: true, glitches: false });
      expect(px.flags?.some((f) => (f & 1) !== 0)).toBe(false);
    }
  });

  it("puts a steady star at the reticle in a plain field", () => {
    const side = fieldSide(5);
    const c = Math.round((side - 1) / 2);
    const a = generateFramePixels(plain, 0, TODAY, { contributor: true });
    const b = generateFramePixels(plain, 0, TODAY);
    expect(a.data[c * side + c] - b.data[c * side + c]).toBeGreaterThan(300);
  });

  it("centres a mover's track on the reticle", () => {
    const barnard = presetById("barnard");
    if (!barnard) throw new Error("missing preset");
    const t: SkyTarget = { raDeg: barnard.raDeg, decDeg: barnard.decDeg, fovArcmin: 5, detector: "D2" };
    const n = visitDates(t.raDeg, TODAY).length;
    const side = fieldSide(5);
    // In the difference (last − first), the mover leaves a minimum where it was and a maximum where it is.
    const f = generateFramePixels(t, 0, TODAY, { contributor: true });
    const l = generateFramePixels(t, n - 1, TODAY, { contributor: true });
    const first = f.data;
    const last = l.data;
    // Cosmic-ray hits are brighter than the mover in a difference; leave flagged pixels out.
    const glitch = (j: number) => ((f.flags?.[j] ?? 0) | (l.flags?.[j] ?? 0)) !== 0;
    let lo = 0;
    let hi = 0;
    for (let j = 1; j < first.length; j++) {
      if (glitch(j)) continue;
      const d = last[j] - first[j];
      if (d < last[lo] - first[lo]) lo = j;
      if (d > last[hi] - first[hi]) hi = j;
    }
    const mid = (side - 1) / 2;
    const at = (j: number) => ({ x: (j % side) - mid, y: Math.floor(j / side) - mid });
    // Both ends of the track lie within 2 px of the reticle and on opposite sides of it.
    const a = at(lo);
    const b = at(hi);
    expect(Math.hypot(a.x, a.y)).toBeLessThan(2.5);
    expect(Math.hypot(b.x, b.y)).toBeLessThan(2.5);
    expect(a.y * b.y).toBeLessThan(0);
  });

  it("leaves the default (Explore) output unchanged", () => {
    const a = generateFramePixels(plain, 0, TODAY);
    const b = generateFramePixels(plain, 0, TODAY, {});
    expect(Array.from(a.data)).toEqual(Array.from(b.data));
  });
});

describe("presets", () => {
  it("gives every preset finite coordinates (none pending)", () => {
    const pending = PRESETS.filter((p) => !isPresetReady(p)).map((p) => p.id);
    expect(pending).toEqual([]);
  });

  it("matches a target to its preset within 1 arcminute", () => {
    const wise = presetById("wise-0855");
    expect(wise).toBeDefined();
    // Within 1′ of the preset position (epoch 2025.9).
    expect(presetAt({ raDeg: 133.7610, decDeg: -7.2410 })?.id).toBe("wise-0855");
    expect(presetAt({ raDeg: 10, decDeg: 10 })).toBeUndefined();
  });
});
