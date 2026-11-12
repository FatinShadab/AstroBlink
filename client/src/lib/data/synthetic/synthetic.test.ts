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
