/**
 * RA / Dec parsing and formatting (rules §4.5.3: this is the only coordinate module).
 *
 * Accepted input (RA in hours or degrees, Dec in degrees):
 *   08h55m10.8s   08h55m10.8s   08 55 10.8   08:55:10.8   133.795   133.795°
 *   -07d14m42.5s  −07°14′42.5″  -07:14:42.5  -7.245        +4.693
 * A leading minus (ASCII hyphen, real minus −, en dash –) is kept even when degrees are 0
 * (e.g. -00d30m00s is south of the equator).
 */

export type CoordErrorCode = "empty" | "format" | "ra-range" | "dec-range" | "min-sec";

export class CoordError extends Error {
  readonly code: CoordErrorCode;
  constructor(code: CoordErrorCode) {
    super(code);
    this.code = code;
    this.name = "CoordError";
  }
}

const NUMBER = /^\d+(\.\d+)?$|^\d+\.$|^\.\d+$/;
const UNIT_CHARS = /[hdms°′″':"]/gi;

interface Parsed {
  negative: boolean;
  values: number[];
}

function isMinus(ch: string): boolean {
  return ch === "-" || ch === "−" || ch === "–";
}

/** Split one coordinate into numeric parts, noting whether it has a leading minus. */
function tokenise(raw: string): Parsed {
  const text = raw.trim().replace(/\s+/g, " ");
  if (text === "") throw new CoordError("empty");
  const negative = isMinus(text.charAt(0));
  const body = text
    .replace(/^[+\-−–]/, "")
    .replace(UNIT_CHARS, " ")
    .trim();
  const parts = body.split(/[\s:]+/).filter((p) => p !== "");
  if (parts.length === 0 || parts.length > 3) throw new CoordError("format");
  const values = parts.map((p) => {
    if (!NUMBER.test(p)) throw new CoordError("format");
    return Number(p);
  });
  return { negative, values };
}

function sexagesimal(values: number[]): number {
  const [d = 0, m = 0, s = 0] = values;
  return d + m / 60 + s / 3600;
}

/** Right ascension → degrees in [0, 360). */
export function parseRa(raw: string): number {
  const { negative, values } = tokenise(raw);
  if (negative) throw new CoordError("ra-range");
  const [, m = 0, s = 0] = values;
  if (values.length > 1 && (m >= 60 || s >= 60)) throw new CoordError("min-sec");
  // A degree sign means degrees; an hour marker or several parts means hours;
  // a lone plain number is degrees (e.g. 133.795).
  const hasDegreeSign = raw.includes("°");
  const hasHourMarker = /[hms:]/i.test(raw) || values.length > 1;
  const inDegrees = hasDegreeSign || (!hasHourMarker && values.length === 1);
  const degrees = inDegrees ? sexagesimal(values) : sexagesimal(values) * 15;
  return wrap360(degrees);
}

/** Declination → degrees in [-90, 90]. The sign comes from the text, so -00d30m is negative. */
export function parseDec(raw: string): number {
  const { negative, values } = tokenise(raw);
  const [, m = 0, s = 0] = values;
  if (values.length > 1 && (m >= 60 || s >= 60)) throw new CoordError("min-sec");
  const magnitude = sexagesimal(values);
  const degrees = negative ? -magnitude : magnitude;
  if (degrees < -90 || degrees > 90) throw new CoordError("dec-range");
  return degrees;
}

/**
 * Parse "RA Dec" typed in one box. Splits on a comma, or before the sign of Dec,
 * or on whitespace when there are exactly two plain numbers.
 */
export function parseCoordinatePair(raw: string): { raDeg: number; decDeg: number } {
  const text = raw.trim();
  if (text === "") throw new CoordError("empty");

  let parts: [string, string] | null = null;
  if (text.includes(",")) {
    const [a, ...rest] = text.split(",");
    parts = [a, rest.join(",")];
  } else {
    // Split before the first sign that is not at the start (the Dec sign).
    const match = /\s[+\-−–]/.exec(text) ?? /(?<=\S)[+\-−–]/.exec(text.slice(1));
    if (match) {
      const index = match.index + (match[0].startsWith(" ") ? 0 : 1);
      parts = [text.slice(0, index), text.slice(index)];
    } else {
      const tokens = text.split(/\s+/);
      if (tokens.length === 2) parts = [tokens[0], tokens[1]];
    }
  }
  if (!parts || parts[0].trim() === "" || parts[1].trim() === "") throw new CoordError("format");
  return { raDeg: parseRa(parts[0]), decDeg: parseDec(parts[1]) };
}

export function wrap360(degrees: number): number {
  if (degrees >= 0 && degrees < 360) return degrees; // keep exact input values
  const wrapped = ((degrees % 360) + 360) % 360;
  return wrapped === 360 ? 0 : wrapped;
}

/** Degrees → "08h55m10.8s" (tenths of a second, carries correctly). */
export function formatRa(raDeg: number): string {
  const tenths = Math.round((wrap360(raDeg) / 15) * 3600 * 10);
  const totalTenths = tenths % (24 * 3600 * 10);
  const h = Math.floor(totalTenths / 36000);
  const m = Math.floor((totalTenths % 36000) / 600);
  const sTenths = totalTenths % 600;
  return `${pad(h, 2)}h${pad(m, 2)}m${pad(Math.floor(sTenths / 10), 2)}.${sTenths % 10}s`;
}

/** Degrees → "−07°14′42.5″" with a real minus sign (design §14). */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? "−" : "+";
  const tenths = Math.round(Math.abs(decDeg) * 3600 * 10);
  const d = Math.floor(tenths / 36000);
  const m = Math.floor((tenths % 36000) / 600);
  const sTenths = tenths % 600;
  return `${sign}${pad(d, 2)}°${pad(m, 2)}′${pad(Math.floor(sTenths / 10), 2)}.${sTenths % 10}″`;
}

/** Degrees with a unit, e.g. "133.795°" and "−7.245°" (design §14). */
export function formatDegrees(deg: number, digits = 3): string {
  const text = Math.abs(deg).toFixed(digits);
  return `${deg < 0 ? "−" : ""}${text}°`;
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}
