/**
 * Deterministic synthetic SPHEREx-like frames (architecture §5.2).
 * Same target → same stars, same noise, same glitches, every time.
 * Everything here is simulated; the UI labels it "Simulated sky".
 */
import { presetAt, type SyntheticSpecial } from "@/data/presets";
import { midWavelengthUm } from "@/lib/sky/detectors";
import { hashSeed, gaussian, mulberry32 } from "@/lib/sky/prng";
import type { Detector, FieldData, FrameMeta, FramePixels, SkyTarget } from "../types";
import { firstVisitUtc, toIsoDate, visitDates } from "./epochs";

export const PIXEL_SCALE_ARCSEC = 6.2;
const PSF_SIGMA_PX = 0.8;
const SKY_LEVEL = 100;
const NOISE_SIGMA = 5;
const STAR_DENSITY_PER_PX = 0.03;
const MIN_STAR_COUNTS = 30;
const STAR_POWER_ALPHA = 2.35;
const MAX_STAR_COUNTS = 5000;
const SATURATION_LEVEL = 4000;
const COSMIC_RAY_COUNTS = 2500;
const STREAK_COUNTS = 1500;
const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;

/** Side length in pixels: round(fov′ × 60 / 6.2). 5′ → 48 px, 15′ → 145 px. */
export function fieldSide(fovArcmin: number): number {
  return Math.round((fovArcmin * 60) / PIXEL_SCALE_ARCSEC);
}

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** Stable key for seeding: RA/Dec to 4 decimals, FoV, detector. */
export function fieldKey(target: SkyTarget): string {
  return `${round4(target.raDeg)}_${round4(target.decDeg)}_${target.fovArcmin}_${target.detector}`;
}

const encode = (s: string) => s.replace(/\./g, "p").replace(/-/g, "m");
const decode = (s: string) => s.replace(/p/g, ".").replace(/m/g, "-");

/** Field id that carries the target, so frame pixels can be rebuilt without a registry. */
export function fieldIdFor(target: SkyTarget): string {
  return `syn_${encode(fieldKey(target))}`;
}

export function parseFieldId(fieldId: string): SkyTarget | null {
  if (!fieldId.startsWith("syn_")) return null;
  const parts = decode(fieldId.slice(4)).split("_");
  if (parts.length !== 4) return null;
  const [ra, dec, fov, det] = parts;
  const target = {
    raDeg: Number(ra),
    decDeg: Number(dec),
    fovArcmin: Number(fov),
    detector: det as Detector,
  };
  return Number.isFinite(target.raDeg) && Number.isFinite(target.decDeg) ? target : null;
}

export function frameIdFor(fieldId: string, index: number): string {
  return `${fieldId}__${index}`;
}

export function splitFrameId(frameId: string): { fieldId: string; index: number } | null {
  const at = frameId.lastIndexOf("__");
  if (at < 0) return null;
  const index = Number(frameId.slice(at + 2));
  if (!Number.isInteger(index) || index < 0) return null;
  return { fieldId: frameId.slice(0, at), index };
}

/** Field metadata with one entry per visit so far. */
export function buildFieldData(target: SkyTarget, today: Date = new Date()): FieldData {
  const fieldId = fieldIdFor(target);
  const side = fieldSide(target.fovArcmin);
  const frames: FrameMeta[] = visitDates(target.raDeg, today).map((date, i) => ({
    id: frameIdFor(fieldId, i),
    obsDate: toIsoDate(date),
    detector: target.detector,
    wavelengthUm: midWavelengthUm(target.detector),
    width: side,
    height: side,
    pixelScaleArcsec: PIXEL_SCALE_ARCSEC,
    hasFlags: true,
  }));
  return { fieldId, target, frames, source: "synthetic", isSimulated: true };
}

/** Pixel data for visit `index` of this target. Pure: no state, no randomness beyond the seed. */
export function generateFramePixels(
  target: SkyTarget,
  index: number,
  today: Date = new Date(),
): FramePixels {
  const dates = visitDates(target.raDeg, today);
  const date = dates[index];
  if (!date) throw new Error(`Frame ${index} does not exist for this target`);

  const key = fieldKey(target);
  const side = fieldSide(target.fovArcmin);
  const n = side * side;
  const data = new Float32Array(n);
  const flags = new Uint8Array(n);
  const centre = (side - 1) / 2;
  const special = presetAt(target)?.synthetic;
  const tYears = (date.getTime() - firstVisitUtc(target.raDeg)) / MS_PER_YEAR;

  // 1. Background: sky level plus Gaussian noise, one seed per frame.
  const noiseRng = mulberry32(hashSeed(key, "noise", index));
  for (let i = 0; i < n; i++) data[i] = SKY_LEVEL + NOISE_SIGMA * gaussian(noiseRng);

  // 2. Field stars: fixed across all frames of this field.
  const starRng = mulberry32(hashSeed(key, "stars"));
  const starCount = Math.round(n * STAR_DENSITY_PER_PX);
  for (let s = 0; s < starCount; s++) {
    const x = starRng() * side;
    const y = starRng() * side;
    const u = starRng();
    const counts = Math.min(
      MAX_STAR_COUNTS,
      MIN_STAR_COUNTS * Math.pow(1 - u, -1 / (STAR_POWER_ALPHA - 1)),
    );
    addPsf(data, side, x, y, counts);
  }

  // 3. Special object (preset): a mover or a variable at the target position.
  if (special) addSpecial(data, side, centre, tYears, special, target, key);

  // 4. Saturation near very bright sources.
  for (let i = 0; i < n; i++) {
    if (data[i] > SATURATION_LEVEL) {
      data[i] = SATURATION_LEVEL;
      flags[i] |= 2;
    }
  }

  // 5. Glitches: cosmic-ray hits (single pixels or short horizontal streaks), flagged as 1.
  const glitchRng = mulberry32(hashSeed(key, "glitch", index));
  const hits = 2 + Math.floor(glitchRng() * 3);
  for (let h = 0; h < hits; h++) {
    const x = Math.floor(glitchRng() * side);
    const y = Math.floor(glitchRng() * side);
    const streak = glitchRng() < 0.5 ? 1 : 2 + Math.floor(glitchRng() * 3);
    const amount = streak === 1 ? COSMIC_RAY_COUNTS : STREAK_COUNTS;
    for (let k = 0; k < streak && x + k < side; k++) {
      const i = y * side + x + k;
      data[i] += amount;
      flags[i] |= 1;
    }
  }

  return { frameId: frameIdFor(fieldIdFor(target), index), width: side, height: side, data, flags };
}

function addPsf(data: Float32Array, side: number, x: number, y: number, counts: number) {
  const r = 3;
  const cx = Math.round(x);
  const cy = Math.round(y);
  const inv = 1 / (2 * PSF_SIGMA_PX * PSF_SIGMA_PX);
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx;
      const py = cy + dy;
      if (px < 0 || py < 0 || px >= side || py >= side) continue;
      const d2 = (px - x) ** 2 + (py - y) ** 2;
      data[py * side + px] += counts * Math.exp(-d2 * inv);
    }
  }
}

function addSpecial(
  data: Float32Array,
  side: number,
  centre: number,
  tYears: number,
  special: SyntheticSpecial,
  target: SkyTarget,
  key: string,
) {
  if (special.kind === "variable") {
    const m = variabilityMultiplier(special.variability, special.amplitude, tYears, key);
    addPsf(data, side, centre, centre, special.peakCounts * m);
    return;
  }

  // Mover: total proper motion; direction is simulated when the components are unknown.
  const dirRng = mulberry32(hashSeed(key, "pa"));
  const paRad = dirRng() * 2 * Math.PI;
  const pmRa = special.pmRaMasYr ?? special.pmTotalMasYr * Math.sin(paRad);
  const pmDec = special.pmDecMasYr ?? special.pmTotalMasYr * Math.cos(paRad);
  const dRaPx = ((pmRa / 1000) * tYears) / PIXEL_SCALE_ARCSEC;
  const dDecPx = ((pmDec / 1000) * tYears) / PIXEL_SCALE_ARCSEC;
  const counts = special.peakCounts[target.detector];
  // East is left in a north-up image, so RA offsets subtract.
  const x = centre - dRaPx;
  const y = centre - dDecPx;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  addPsf(data, side, x, y, counts);
}

/** Simulated brightness factor. Illustrative curves, not measured light curves. */
export function variabilityMultiplier(
  variability: "irregular" | { periodDays: number },
  amplitude: number,
  tYears: number,
  key: string,
): number {
  if (variability === "irregular") {
    const rng = mulberry32(hashSeed(key, "irregular"));
    const p1 = rng() * 2 * Math.PI;
    const p2 = rng() * 2 * Math.PI;
    return Math.max(
      0.05,
      1 +
        amplitude *
          (0.6 * Math.sin((2 * Math.PI * tYears) / 0.9 + p1) +
            0.4 * Math.sin((2 * Math.PI * tYears) / 2.3 + p2)),
    );
  }
  const periodYears = variability.periodDays / 365.25;
  return Math.max(0.05, 1 + amplitude * Math.sin((2 * Math.PI * tYears) / periodYears));
}
