/**
 * Celestial coordinate utilities: input parsing, sexagesimal formatting and a
 * small linear WCS (tangent-plane approximation) for FoV-sized frames.
 *
 * Convention: north is up, east is left (standard astronomical orientation),
 * so RA increases toward smaller x and Dec increases toward smaller y.
 */

export interface WorldCoord {
  ra: number;
  dec: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export interface Wcs {
  size: number;
  center: WorldCoord;
  fovArcmin: number;
  arcsecPerPx: number;
  worldToPixel(ra: number, dec: number): PixelCoord;
  pixelToWorld(x: number, y: number): WorldCoord;
}

const DEG = Math.PI / 180;

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function normalizeRa(ra: number): number {
  if (ra >= 0 && ra < 360) return ra; // already in range: keep the exact value
  return ((ra % 360) + 360) % 360;
}

/** Wraps an angular difference into [-180, 180). */
export function wrap180(d: number): number {
  return ((((d + 180) % 360) + 360) % 360) - 180;
}

export function makeWcs(center: WorldCoord, fovArcmin: number, size = 128): Wcs {
  const pxPerDeg = size / (fovArcmin / 60);
  const cosDec0 = Math.max(Math.cos(center.dec * DEG), 1e-6);
  const half = size / 2;

  return {
    size,
    center,
    fovArcmin,
    arcsecPerPx: (fovArcmin * 60) / size,
    worldToPixel(ra, dec) {
      const dRa = wrap180(ra - center.ra);
      return {
        x: half - dRa * cosDec0 * pxPerDeg,
        y: half - (dec - center.dec) * pxPerDeg,
      };
    },
    pixelToWorld(x, y) {
      const dRa = (half - x) / (pxPerDeg * cosDec0);
      const dDec = (half - y) / pxPerDeg;
      return {
        ra: normalizeRa(center.ra + dRa),
        dec: clamp(center.dec + dDec, -90, 90),
      };
    },
  };
}

/** 123.4567 -> "123.45670" style fixed formatting for decimal readouts. */
export function formatDecimal(v: number, digits = 5): string {
  return v.toFixed(digits);
}

/** RA in degrees -> "08h 55m 10.83s" (hundredths of a second, carry-safe). */
export function formatRaHms(raDeg: number): string {
  const t = Math.round((normalizeRa(raDeg) / 15) * 3600 * 100) % (24 * 3600 * 100);
  const h = Math.floor(t / 360000);
  const m = Math.floor((t % 360000) / 6000);
  const s = (t % 6000) / 100;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${s.toFixed(2).padStart(5, "0")}s`;
}

/** Dec in degrees -> "-07° 14′ 42.53″" (hundredths of an arcsecond). */
export function formatDecDms(decDeg: number): string {
  const sign = decDeg < 0 ? "-" : "+";
  const t = Math.round(Math.abs(decDeg) * 3600 * 100);
  const d = Math.floor(t / 360000);
  const m = Math.floor((t % 360000) / 6000);
  const s = (t % 6000) / 100;
  return `${sign}${String(d).padStart(2, "0")}° ${String(m).padStart(2, "0")}′ ${s.toFixed(2).padStart(5, "0")}″`;
}

export type ParsedCoordinates =
  | { kind: "coords"; ra: number; dec: number; format: "decimal" | "sexagesimal" }
  | { kind: "name"; name: string; resolved: WorldCoord }
  | { kind: "error"; message: string };

const NAME_NORMALIZE = /[^a-z0-9]/g;

/**
 * Parses user input into equatorial coordinates.
 *
 * Accepts:
 *  - Decimal degrees: `133.795, -7.245`, `RA: 133.795 Dec: -7.245`
 *  - Sexagesimal:     `08h55m10.831s -07d14m42.53s`, `08:55:10.8 -07:14:42.5`
 *  - Target names, resolved through `resolveName` (e.g. the benchmark catalog).
 */
export function parseCoordinateInput(
  raw: string,
  resolveName?: (query: string) => WorldCoord | null,
  canonicalName?: (query: string) => string | null,
): ParsedCoordinates {
  const input = raw.trim().replace(/−/g, "-");
  if (!input) return { kind: "error", message: "Enter coordinates or a target name." };

  const numericTokens = extractSignedNumbers(input);

  if (numericTokens.length !== 2 && numericTokens.length !== 6) {
    const resolved = resolveName?.(input);
    if (resolved) {
      return { kind: "name", name: canonicalName?.(input) ?? input, resolved };
    }
    return {
      kind: "error",
      message: `Unknown target "${input}". Try decimal degrees, HMS/DMS, or a benchmark name.`,
    };
  }

  if (numericTokens.length === 2) {
    const [ra, dec] = numericTokens.map((t) => t.value);
    if (ra < 0 || ra >= 360) return { kind: "error", message: "RA must be in [0, 360) degrees." };
    if (dec < -90 || dec > 90) return { kind: "error", message: "Dec must be in [-90, 90] degrees." };
    return { kind: "coords", ra, dec, format: "decimal" };
  }

  const [rh, rm, rs, dd, dm, ds] = numericTokens;
  if (rh.value >= 24 || rm.value >= 60 || rs.value >= 60 || rm.value < 0 || rs.value < 0) {
    return { kind: "error", message: "RA sexagesimal out of range (h<24, m<60, s<60)." };
  }
  if (dd.value > 90 || dm.value >= 60 || ds.value >= 60 || dm.value < 0 || ds.value < 0) {
    return { kind: "error", message: "Dec sexagesimal out of range (d<=90, m<60, s<60)." };
  }
  const ra = (rh.value + rm.value / 60 + rs.value / 3600) * 15;
  const decMag = Math.abs(dd.value) + dm.value / 60 + ds.value / 3600;
  const dec = (dd.negative ? -1 : 1) * decMag;
  if (Math.abs(dec) > 90) return { kind: "error", message: "Dec must be within ±90°." };
  return { kind: "coords", ra: normalizeRa(ra), dec, format: "sexagesimal" };
}

interface SignedToken {
  value: number;
  negative: boolean;
}

function extractSignedNumbers(input: string): SignedToken[] {
  // Labels and unit letters become separators; the minus sign stays attached.
  const cleaned = input
    .replace(/\bRA\b\s*[:=]?/gi, " ")
    .replace(/\bDec\b\s*[:=]?/gi, " ")
    .replace(/[hdms°′″':",]/gi, " ");
  const out: SignedToken[] = [];
  const re = /([+-]?)\s*(\d+(?:\.\d+)?)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    out.push({ value: Math.abs(Number(match[2])) * (match[1] === "-" ? -1 : 1), negative: match[1] === "-" });
  }
  return out;
}

/** Normalizes a free-text target name for alias lookup. */
export function normalizeName(name: string): string {
  return name.toLowerCase().replace(NAME_NORMALIZE, "");
}
