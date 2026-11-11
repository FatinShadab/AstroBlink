import { describe, expect, it } from "vitest";
import {
  CoordError,
  formatDec,
  formatDegrees,
  formatRa,
  parseCoordinatePair,
  parseDec,
  parseRa,
} from "./coords";

const codeOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (error) {
    return error instanceof CoordError ? error.code : "other";
  }
  return "none";
};

describe("parseRa", () => {
  it("reads sexagesimal hours", () => {
    expect(parseRa("08h55m10.8s")).toBeCloseTo(133.795, 3);
    expect(parseRa("08 55 10.8")).toBeCloseTo(133.795, 3);
    expect(parseRa("08:55:10.8")).toBeCloseTo(133.795, 3);
  });

  it("reads decimal degrees, with or without the degree sign", () => {
    expect(parseRa("133.795")).toBe(133.795);
    expect(parseRa("133.795°")).toBe(133.795);
  });

  it("wraps 24 hours back to 0", () => {
    expect(parseRa("24h00m00s")).toBe(0);
    expect(parseRa("25h00m00s")).toBeCloseTo(15, 6);
  });

  it("rejects bad minutes and seconds", () => {
    expect(codeOf(() => parseRa("08h60m00s"))).toBe("min-sec");
    expect(codeOf(() => parseRa("08h55m60s"))).toBe("min-sec");
  });

  it("rejects negative RA and garbage", () => {
    expect(codeOf(() => parseRa("-1"))).toBe("ra-range");
    expect(codeOf(() => parseRa("abc"))).toBe("format");
    expect(codeOf(() => parseRa("   "))).toBe("empty");
  });
});

describe("parseDec", () => {
  it("reads sexagesimal with ASCII and unicode marks", () => {
    expect(parseDec("-07d14m42.5s")).toBeCloseTo(-7.24514, 4);
    expect(parseDec("−07°14′42.5″")).toBeCloseTo(-7.24514, 4);
    expect(parseDec("-07:14:42.5")).toBeCloseTo(-7.24514, 4);
  });

  it("keeps the sign when degrees are zero (-00d30m)", () => {
    expect(parseDec("-00d30m00s")).toBeCloseTo(-0.5, 6);
    expect(parseDec("00d30m00s")).toBeCloseTo(0.5, 6);
  });

  it("reads decimal values with an optional plus", () => {
    expect(parseDec("-7.245")).toBe(-7.245);
    expect(parseDec("+4.693")).toBe(4.693);
  });

  it("rejects values beyond the poles", () => {
    expect(codeOf(() => parseDec("91"))).toBe("dec-range");
    expect(codeOf(() => parseDec("-90.5"))).toBe("dec-range");
  });
});

describe("parseCoordinatePair", () => {
  it("splits sexagesimal RA and Dec before the sign", () => {
    const { raDeg, decDeg } = parseCoordinatePair("08h55m10.8s -07d14m42s");
    expect(raDeg).toBeCloseTo(133.795, 3);
    expect(decDeg).toBeCloseTo(-7.245, 3);
  });

  it("splits decimal pairs with a comma or a space", () => {
    expect(parseCoordinatePair("133.795, -7.245")).toEqual({ raDeg: 133.795, decDeg: -7.245 });
    expect(parseCoordinatePair("133.795 -7.245")).toEqual({ raDeg: 133.795, decDeg: -7.245 });
    expect(parseCoordinatePair("133.795 4.693")).toEqual({ raDeg: 133.795, decDeg: 4.693 });
  });

  it("reports an empty box and a missing half", () => {
    expect(codeOf(() => parseCoordinatePair(""))).toBe("empty");
    expect(codeOf(() => parseCoordinatePair("133.795"))).toBe("format");
  });
});

describe("formatting", () => {
  it("formats RA as hours, minutes and tenths of seconds", () => {
    expect(formatRa(133.795)).toBe("08h55m10.8s");
    expect(formatRa(0)).toBe("00h00m00.0s");
  });

  it("formats Dec with a real minus sign", () => {
    expect(formatDec(-7.24514)).toBe("−07°14′42.5″");
    expect(formatDec(4.69336)).toBe("+04°41′36.1″");
  });

  it("formats degrees with units", () => {
    expect(formatDegrees(133.795)).toBe("133.795°");
    expect(formatDegrees(-7.245)).toBe("−7.245°");
  });

  it("round-trips through the parser", () => {
    const ra = parseRa(formatRa(269.45208));
    const dec = parseDec(formatDec(4.69336));
    expect(ra).toBeCloseTo(269.45208, 3);
    expect(dec).toBeCloseTo(4.69336, 3);
  });
});
