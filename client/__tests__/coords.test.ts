import { describe, it, expect } from "vitest";
import { formatDecDms, formatRaHms, makeWcs, parseCoordinateInput } from "@/lib/coords";
import { resolveTargetName, canonicalTargetName } from "@/lib/mock/spherexMockEngine";

const parse = (s: string) => parseCoordinateInput(s, resolveTargetName, canonicalTargetName);

describe("parseCoordinateInput", () => {
  it("parses decimal degrees with or without labels", () => {
    const a = parse("133.795, -7.245");
    expect(a).toMatchObject({ kind: "coords", format: "decimal", ra: 133.795, dec: -7.245 });
    const b = parse("RA: 133.795 Dec: -7.245");
    expect(b).toMatchObject({ kind: "coords", ra: 133.795, dec: -7.245 });
  });

  it("parses HMS/DMS in the spec's notation", () => {
    const r = parse("08h55m10.831s -07d14m42.53s");
    expect(r.kind).toBe("coords");
    if (r.kind !== "coords") return;
    expect(r.format).toBe("sexagesimal");
    expect(r.ra).toBeCloseTo(133.795, 2);
    expect(r.dec).toBeCloseTo(-7.245, 2);
  });

  it("parses colon-separated sexagesimal with a negative declination", () => {
    const r = parse("08:55:10.8 -07:14:42.5");
    expect(r.kind).toBe("coords");
    if (r.kind !== "coords") return;
    expect(r.ra).toBeCloseTo(133.795, 2);
    expect(r.dec).toBeCloseTo(-7.245, 2);
  });

  it("resolves benchmark names and their aliases", () => {
    const r = parse("WISE 0855");
    expect(r).toMatchObject({ kind: "name", name: "WISE 0855" });
    if (r.kind === "name") expect(r.resolved.ra).toBeCloseTo(133.795);
    expect(parse("barnard's star")).toMatchObject({ kind: "name", name: "Barnard's Star" });
    expect(parse("rdra")).toMatchObject({ kind: "name", name: "R Draconis" });
  });

  it("rejects out-of-range values and unknown names with a message", () => {
    expect(parse("400 10")).toMatchObject({ kind: "error" });
    expect(parse("10 95")).toMatchObject({ kind: "error" });
    expect(parse("Vega")).toMatchObject({ kind: "error" });
    expect(parse("")).toMatchObject({ kind: "error" });
  });
});

describe("formatting", () => {
  it("formats RA as HMS and Dec as DMS", () => {
    expect(formatRaHms(133.795)).toBe("08h 55m 10.80s");
    expect(formatDecDms(-7.245)).toBe("-07° 14′ 42.00″");
  });

  it("never rolls seconds over to 60.00", () => {
    expect(formatRaHms(359.9999999)).not.toContain("60.00");
  });
});

describe("makeWcs", () => {
  it("round-trips pixel ↔ world and puts the centre at the frame middle", () => {
    const wcs = makeWcs({ ra: 269.452, dec: 4.693 }, 15, 128);
    const mid = wcs.worldToPixel(269.452, 4.693);
    expect(mid.x).toBeCloseTo(64);
    expect(mid.y).toBeCloseTo(64);
    const w = wcs.pixelToWorld(30, 90);
    const back = wcs.worldToPixel(w.ra, w.dec);
    expect(back.x).toBeCloseTo(30, 6);
    expect(back.y).toBeCloseTo(90, 6);
  });

  it("uses north-up, east-left orientation", () => {
    const wcs = makeWcs({ ra: 100, dec: 0 }, 10, 128);
    expect(wcs.worldToPixel(100, 0.01).y).toBeLessThan(64); // north is up
    expect(wcs.worldToPixel(100.01, 0).x).toBeLessThan(64); // east is left
  });
});
