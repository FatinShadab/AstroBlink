/**
 * SPHEREx Mock Engine — the single home for mock astronomy.
 *
 * Everything the UI shows in mock mode (benchmark catalog, 102-channel grid,
 * procedural multi-epoch sky frames, spectra, overlays, transfer estimates)
 * is produced here, so components never contain simulation logic and the
 * service layer can be swapped for the FastAPI backend with one env toggle.
 *
 * Physical fidelity is "plausible for a demo", not calibrated photometry.
 * Proper motions for the benchmark targets are approximate and exist to make
 * positional drift visible across epochs.
 */

import { makeWcs, normalizeName, normalizeRa, type WorldCoord, type Wcs } from "@/lib/coords";

// ───────────────────────────── Constants ─────────────────────────────

export const FRAME_SIZE = 128;
export const CHANNEL_COUNT = 102;
export const LAMBDA_MIN_UM = 0.75;
export const LAMBDA_MAX_UM = 5.0;
export const BACKGROUND_UJY = 35;
export const CHANNEL_SIGMA_UJY = 6;
export const SATURATION_UJY = 3000;
/** Wavelength at which template spectra and source amplitudes are normalized (mid-band). */
export const TEMPLATE_REF_UM = 3.5;
/** Reference year of the catalogue positions (epoch 1 observation date). */
export const CATALOG_REF_YEAR = 2025.37;

export const WAVELENGTHS_UM: number[] = Array.from({ length: CHANNEL_COUNT }, (_, i) =>
  Number((LAMBDA_MIN_UM + (i * (LAMBDA_MAX_UM - LAMBDA_MIN_UM)) / (CHANNEL_COUNT - 1)).toFixed(4)),
);

export type ArrayId = 1 | 2 | 3 | 4 | 5 | 6;
/** "stack" = all arrays, "aN" = one detector array, "chN" = one narrow channel, "rgb" = false-colour composite. */
export type BandKey = "stack" | "rgb" | `a${ArrayId}` | `ch${number}`;

export interface SpectrumArray {
  id: ArrayId;
  lo: number;
  hi: number;
  label: string;
}

export const SPHEREX_ARRAYS: SpectrumArray[] = [
  { id: 1, lo: 0.75, hi: 1.1, label: "Array 1 · 0.75–1.1 µm" },
  { id: 2, lo: 1.1, hi: 1.6, label: "Array 2 · 1.1–1.6 µm" },
  { id: 3, lo: 1.6, hi: 2.4, label: "Array 3 · 1.6–2.4 µm" },
  { id: 4, lo: 2.4, hi: 3.8, label: "Array 4 · 2.4–3.8 µm" },
  { id: 5, lo: 3.8, hi: 4.4, label: "Array 5 · 3.8–4.4 µm" },
  { id: 6, lo: 4.4, hi: 5.0, label: "Array 6 · 4.4–5.0 µm" },
];

export interface MolecularBand {
  id: "H2O" | "CH4" | "CO2" | "CO" | "PAH";
  label: string;
  ranges: Array<[number, number]>;
}

export const MOLECULAR_BANDS: MolecularBand[] = [
  { id: "H2O", label: "H₂O (incl. water ice)", ranges: [[1.3, 1.5], [1.75, 2.05], [2.55, 3.2]] },
  { id: "CH4", label: "CH₄ (methane)", ranges: [[2.2, 2.4], [3.2, 3.45]] },
  { id: "CO2", label: "CO₂", ranges: [[4.2, 4.35]] },
  { id: "CO", label: "CO", ranges: [[4.5, 4.8]] },
  { id: "PAH", label: "PAH", ranges: [[3.2, 3.35]] },
];

// ───────────────────────────── Epochs ─────────────────────────────

export interface EpochInfo {
  index: number;
  epoch: number;
  label: string;
  isoDate: string;
  mjd: number;
  decimalYear: number;
}

const EPOCH_DATES = ["2025-05-01", "2025-11-01", "2026-05-01", "2026-11-01"];

function isoToMjd(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`) / 86400000 + 40587;
}

export const EPOCHS: EpochInfo[] = EPOCH_DATES.map((iso, index) => {
  const mjd = isoToMjd(iso);
  return {
    index,
    epoch: index + 1,
    label: `Epoch ${index + 1}`,
    isoDate: iso,
    mjd,
    decimalYear: 2000 + (mjd - 51544.5) / 365.25,
  };
});

// ───────────────────────────── Spectral templates ─────────────────────────────

export type TemplateId = "t_dwarf" | "y_dwarf" | "m_dwarf" | "star" | "comet" | "quasar";

export const TEMPLATE_LABELS: Record<TemplateId, string> = {
  t_dwarf: "Brown dwarf (T-type)",
  y_dwarf: "Brown dwarf (Y-type)",
  m_dwarf: "M-dwarf star",
  star: "Hot young star",
  comet: "Comet coma",
  quasar: "Quasar",
};

/** Templates offered for side-by-side comparison in the spectrum drawer. */
export const COMPARISON_TEMPLATES: TemplateId[] = ["t_dwarf", "y_dwarf", "m_dwarf", "comet", "quasar"];

interface AbsorptionLine {
  center: number;
  depth: number;
  sigma: number;
}

function absorptionsFor(id: TemplateId): AbsorptionLine[] {
  switch (id) {
    case "y_dwarf":
      return [
        { center: 1.4, depth: 0.6, sigma: 0.06 },
        { center: 1.9, depth: 0.6, sigma: 0.07 },
        { center: 2.7, depth: 0.7, sigma: 0.1 },
        { center: 1.65, depth: 0.7, sigma: 0.05 },
        { center: 2.2, depth: 0.6, sigma: 0.05 },
        { center: 3.3, depth: 0.6, sigma: 0.06 },
      ];
    case "t_dwarf":
      return [
        { center: 1.4, depth: 0.4, sigma: 0.06 },
        { center: 1.9, depth: 0.4, sigma: 0.07 },
        { center: 1.65, depth: 0.5, sigma: 0.05 },
        { center: 2.2, depth: 0.5, sigma: 0.05 },
      ];
    case "m_dwarf":
      return [
        { center: 1.4, depth: 0.3, sigma: 0.05 },
        { center: 1.9, depth: 0.3, sigma: 0.06 },
        { center: 2.7, depth: 0.25, sigma: 0.08 },
      ];
    default:
      return [];
  }
}

function planck(lambdaUm: number, tempK: number): number {
  const x = 14388 / (lambdaUm * tempK);
  return Math.pow(lambdaUm, -5) / Math.expm1(x);
}

function rawTemplate(id: TemplateId, lambda: number): number {
  switch (id) {
    case "t_dwarf":
      return planck(lambda, 1000);
    case "y_dwarf":
      return planck(lambda, 375);
    case "m_dwarf":
      return planck(lambda, 3100);
    case "star":
      return planck(lambda, 4000);
    case "comet":
      // Reflected sunlight dominates the near-IR, thermal emission the far end.
      return 0.5 * planck(lambda, 5800) + 4 * planck(lambda, 280);
    case "quasar":
      return Math.pow(lambda, -1.5);
  }
}

/** Multiplicative molecular absorption for a template at wavelength λ (1 = no absorption). */
export function absorptionFactor(id: TemplateId, lambda: number): number {
  let factor = 1;
  for (const line of absorptionsFor(id)) {
    const d = (lambda - line.center) / line.sigma;
    factor *= 1 - line.depth * Math.exp(-0.5 * d * d);
  }
  return factor;
}

/** Template flux normalized to 1.0 at TEMPLATE_REF_UM, with molecular absorption applied. */
export function templateFlux(id: TemplateId, lambda: number): number {
  const norm = rawTemplate(id, TEMPLATE_REF_UM) * absorptionFactor(id, TEMPLATE_REF_UM);
  return (rawTemplate(id, lambda) * absorptionFactor(id, lambda)) / norm;
}

/** Template curve in µJy with the given flux at TEMPLATE_REF_UM, sampled on the 102-channel grid. */
export function templateSpectrum(id: TemplateId, fluxAtRefUjy = 100): number[] {
  return WAVELENGTHS_UM.map((l) => fluxAtRefUjy * templateFlux(id, l));
}

// ───────────────────────────── Channel / band mapping ─────────────────────────────

export function channelsInArray(arrayId: ArrayId): number[] {
  const arr = SPHEREX_ARRAYS[arrayId - 1];
  const out: number[] = [];
  WAVELENGTHS_UM.forEach((l, i) => {
    if (l >= arr.lo && (l < arr.hi || (arrayId === 6 && l <= arr.hi))) out.push(i);
  });
  return out;
}

export function channelsForBand(band: BandKey): number[] {
  // "rgb" is composed from three arrays by the renderer; its per-frame channel set is the full stack.
  if (band === "stack" || band === "rgb") return WAVELENGTHS_UM.map((_, i) => i);
  if (band.startsWith("ch")) return [Number(band.slice(2))];
  return channelsInArray(Number(band.slice(1)) as ArrayId);
}

export function isBandKey(value: string | null | undefined): value is BandKey {
  if (!value) return false;
  if (value === "stack" || value === "rgb") return true;
  if (/^a[1-6]$/.test(value)) return true;
  const m = /^ch(\d{1,3})$/.exec(value);
  return !!m && Number(m[1]) < CHANNEL_COUNT;
}

/** Nearest narrow-band channel index for a wavelength in µm. */
export function channelForWavelength(um: number): number {
  let best = 0;
  let bestD = Infinity;
  WAVELENGTHS_UM.forEach((l, i) => {
    const d = Math.abs(l - um);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// ───────────────────────────── Benchmark catalog ─────────────────────────────

export interface BenchmarkTarget {
  id: "barnards_star" | "eps_indi_b" | "wise_0855" | "rw_aur" | "r_dra";
  name: string;
  aliases: string[];
  ra: number;
  dec: number;
  /** Approximate proper motion in arcsec/yr (RA × cos δ, Dec). */
  pmRaArcsecYr: number;
  pmDecArcsecYr: number;
  /** Peak mock flux at TEMPLATE_REF_UM (3.5 µm), µJy. */
  amplitudeUjy: number;
  template: TemplateId;
  variability: "steady" | "ttauri" | "mira";
  description: string;
}

export const BENCHMARK_TARGETS: BenchmarkTarget[] = [
  {
    id: "barnards_star",
    name: "Barnard's Star",
    aliases: ["barnards star", "barnard's star", "barnard", "gj 699"],
    ra: 269.452,
    dec: 4.693,
    pmRaArcsecYr: -0.7986,
    pmDecArcsecYr: 10.2877,
    amplitudeUjy: 1200,
    template: "m_dwarf",
    variability: "steady",
    description: "High proper-motion red dwarf",
  },
  {
    id: "eps_indi_b",
    name: "Epsilon Indi B",
    aliases: ["epsilon indi b", "eps indi b", "eps indi", "ε indi b"],
    ra: 330.84,
    dec: -56.786,
    pmRaArcsecYr: -3.4,
    pmDecArcsecYr: -2.3,
    amplitudeUjy: 300,
    template: "t_dwarf",
    variability: "steady",
    description: "Binary brown dwarf pair",
  },
  {
    id: "wise_0855",
    name: "WISE 0855",
    aliases: ["wise 0855", "wise0855", "wise 0855-0714", "wise 0855−0714", "wise j0855"],
    ra: 133.795,
    dec: -7.245,
    pmRaArcsecYr: -6.5,
    pmDecArcsecYr: 5.5,
    amplitudeUjy: 50,
    template: "y_dwarf",
    variability: "steady",
    description: "Fast-moving coldest brown dwarf",
  },
  {
    id: "rw_aur",
    name: "RW Aurigae",
    aliases: ["rw aur", "rw aurigae", "rwaur"],
    ra: 76.956,
    dec: 30.401,
    pmRaArcsecYr: 0.5,
    pmDecArcsecYr: -0.5,
    amplitudeUjy: 2000,
    template: "star",
    variability: "ttauri",
    description: "T Tauri variable — dramatic flux swings across epochs",
  },
  {
    id: "r_dra",
    name: "R Draconis",
    aliases: ["r dra", "r draconis", "rdra"],
    ra: 248.172,
    dec: 66.753,
    pmRaArcsecYr: -0.05,
    pmDecArcsecYr: 0.1,
    amplitudeUjy: 3000,
    template: "m_dwarf",
    variability: "mira",
    description: "Mira-type pulsating variable (P ≈ 246 d)",
  },
];

export function findBenchmark(query: string): BenchmarkTarget | null {
  const q = normalizeName(query);
  if (!q) return null;
  return (
    BENCHMARK_TARGETS.find(
      (t) => normalizeName(t.name) === q || t.id.replace(/_/g, "") === q || t.aliases.some((a) => normalizeName(a) === q),
    ) ?? null
  );
}

/** Resolves a free-text target name to coordinates (used by the parser fallback). */
export function resolveTargetName(query: string): WorldCoord | null {
  const t = findBenchmark(query);
  return t ? { ra: t.ra, dec: t.dec } : null;
}

export function canonicalTargetName(query: string): string | null {
  return findBenchmark(query)?.name ?? null;
}

// ───────────────────────────── Deterministic randomness ─────────────────────────────

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 PRNG — tiny, fast and fully deterministic for a given seed. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gaussian(rng: () => number): number {
  const u = Math.max(rng(), 1e-12);
  const v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ───────────────────────────── Sky scene ─────────────────────────────

export interface SceneStar {
  x: number;
  y: number;
  amp: number;
  template: TemplateId;
  pmRaArcsecYr: number;
  pmDecArcsecYr: number;
}

export interface SkyScene {
  key: string;
  center: WorldCoord;
  fovArcmin: number;
  wcs: Wcs;
  stars: SceneStar[];
  hotPixels: number[];
  targets: BenchmarkTarget[];
}

/** Builds the deterministic sky for a centre + FoV. Same inputs always give the same sky. */
export function buildScene(center: WorldCoord, fovArcmin: number): SkyScene {
  const key = `${center.ra.toFixed(4)}|${center.dec.toFixed(4)}|${fovArcmin}`;
  const wcs = makeWcs(center, fovArcmin, FRAME_SIZE);
  const rng = mulberry32(hashString(`stars|${key}`));
  const starCount = Math.round(70 + fovArcmin * 1.5);

  const stars: SceneStar[] = [];
  for (let i = 0; i < starCount; i++) {
    const u = rng();
    const bright = rng() < 0.03;
    const amp = bright ? 1200 + rng() * 1400 : 4 + 260 * Math.pow(u, 6);
    stars.push({
      x: rng() * FRAME_SIZE,
      y: rng() * FRAME_SIZE,
      amp,
      template: rng() < 0.7 ? "star" : "m_dwarf",
      pmRaArcsecYr: (rng() - 0.5) * 0.08,
      pmDecArcsecYr: (rng() - 0.5) * 0.08,
    });
  }

  const hotRng = mulberry32(hashString(`hot|${key}`));
  const hotPixels = Array.from({ length: 9 }, () => Math.floor(hotRng() * FRAME_SIZE * FRAME_SIZE));

  const targets = BENCHMARK_TARGETS.filter((t) => {
    const p = wcs.worldToPixel(t.ra, t.dec);
    return p.x > -12 && p.x < FRAME_SIZE + 12 && p.y > -12 && p.y < FRAME_SIZE + 12;
  });

  return { key, center, fovArcmin, wcs, stars, hotPixels, targets };
}

/** Target world position at a decimal year, using catalogue position + proper motion. */
export function targetWorldAt(target: BenchmarkTarget, decimalYear: number): WorldCoord {
  const dt = decimalYear - CATALOG_REF_YEAR;
  const cosDec = Math.max(Math.cos((target.dec * Math.PI) / 180), 1e-6);
  return {
    ra: normalizeRa(target.ra + (target.pmRaArcsecYr * dt) / 3600 / cosDec),
    dec: target.dec + (target.pmDecArcsecYr * dt) / 3600,
  };
}

/** Mock variability factor for a target at a given epoch (MJD-driven). */
export function variabilityFactor(target: BenchmarkTarget, epoch: EpochInfo): number {
  switch (target.variability) {
    case "ttauri": {
      // Dramatic, irregular dimming/brightening across the four epochs.
      const pattern = [1.0, 0.45, 1.7, 0.7];
      return pattern[epoch.index] ?? 1;
    }
    case "mira": {
      const period = 245.6;
      const phase = (((epoch.mjd - EPOCHS[0].mjd) / period) + 0.2) % 1;
      const c = 0.5 + 0.5 * Math.cos(2 * Math.PI * phase);
      return 0.15 + 0.85 * c * c;
    }
    default:
      return 1;
  }
}

function targetPixel(scene: SkyScene, target: BenchmarkTarget, epoch: EpochInfo): { x: number; y: number } {
  const w = targetWorldAt(target, epoch.decimalYear);
  return scene.wcs.worldToPixel(w.ra, w.dec);
}

// ───────────────────────────── Rendering ─────────────────────────────

export interface Frame {
  size: number;
  /** Intensity in µJy per pixel (row-major, size × size). */
  data: Float32Array;
  /** SPHEREx bitmask: 1 cosmic ray, 2 saturation, 4 stray light, 8 dead/hot pixel. */
  mask: Uint8Array;
  /** Per-pixel noise sigma in µJy for this band. */
  sigma: number;
}

export const MASK_BITS = { cosmicRay: 1, saturation: 2, strayLight: 4, deadHot: 8 } as const;

function addPsf(data: Float32Array, x: number, y: number, peak: number, sigma = 1.15): void {
  if (peak <= 0) return;
  const size = FRAME_SIZE;
  const r = 4;
  const cx = Math.round(x);
  const cy = Math.round(y);
  const inv = 1 / (2 * sigma * sigma);
  for (let dy = -r; dy <= r; dy++) {
    const py = cy + dy;
    if (py < 0 || py >= size) continue;
    for (let dx = -r; dx <= r; dx++) {
      const px = cx + dx;
      if (px < 0 || px >= size) continue;
      const d2 = (px - x) * (px - x) + (py - y) * (py - y);
      data[py * size + px] += peak * Math.exp(-d2 * inv);
    }
  }
  if (peak > 150) {
    // Diffraction spikes on bright sources.
    const len = Math.min(26, 3 * Math.sqrt(peak / 10));
    for (let d = 1; d <= len; d++) {
      const v = peak * 0.06 * Math.exp(-d / (len * 0.35));
      for (const [px, py] of [
        [cx + d, cy], [cx - d, cy], [cx, cy + d], [cx, cy - d],
      ] as const) {
        if (px >= 0 && px < size && py >= 0 && py < size) data[py * size + px] += v;
      }
    }
  }
}

/** Mean template weight over the channels of a band (relative to TEMPLATE_REF_UM). */
function bandWeight(template: TemplateId, channels: number[]): number {
  let sum = 0;
  for (const i of channels) sum += templateFlux(template, WAVELENGTHS_UM[i]);
  return sum / channels.length;
}

/**
 * Renders one procedural frame: starfield, benchmark targets with motion and
 * variability, sky background, band-dependent Gaussian noise, cosmic rays,
 * saturation, stray light and hot pixels. Pure and deterministic.
 */
export function renderFrame(scene: SkyScene, epochIndex: number, band: BandKey): Frame {
  const size = FRAME_SIZE;
  const data = new Float32Array(size * size);
  const mask = new Uint8Array(size * size);
  const channels = channelsForBand(band);
  const sigma = CHANNEL_SIGMA_UJY / Math.sqrt(channels.length);
  const epoch = EPOCHS[epochIndex];

  // Sky background with a gentle gradient.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      data[y * size + x] = BACKGROUND_UJY * (1 + 0.04 * (x / size));
    }
  }

  for (const s of scene.stars) {
    const pos = { x: s.x, y: s.y };
    addPsf(data, pos.x, pos.y, s.amp * bandWeight(s.template, channels));
  }

  for (const t of scene.targets) {
    const p = targetPixel(scene, t, epoch);
    const peak = t.amplitudeUjy * variabilityFactor(t, epoch) * bandWeight(t.template, channels);
    addPsf(data, p.x, p.y, peak);
  }

  // Stray light: a diagonal glow streak.
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = x - (y * 0.5 + 20);
      const glow = 9 * Math.exp((-d * d) / 4.5);
      if (glow > 0.05) {
        data[y * size + x] += glow;
        if (Math.abs(d) < 2) mask[y * size + x] |= MASK_BITS.strayLight;
      }
    }
  }

  // Noise: seeded per scene, epoch and band so frames are reproducible.
  const noise = mulberry32(hashString(`noise|${scene.key}|${epochIndex}|${band}`));
  for (let i = 0; i < data.length; i++) data[i] += gaussian(noise) * sigma;

  // Cosmic rays: per epoch, single bright pixels.
  const cr = mulberry32(hashString(`cr|${scene.key}|${epochIndex}`));
  for (let k = 0; k < 5; k++) {
    const i = Math.floor(cr() * size * size);
    data[i] += 600 + cr() * 400;
    mask[i] |= MASK_BITS.cosmicRay;
  }

  // Hot / dead pixels: static per scene.
  for (const i of scene.hotPixels) {
    data[i] += 120;
    mask[i] |= MASK_BITS.deadHot;
  }

  // Saturation clipping.
  for (let i = 0; i < data.length; i++) {
    if (data[i] > SATURATION_UJY) {
      data[i] = SATURATION_UJY;
      mask[i] |= MASK_BITS.saturation;
    }
  }

  return { size, data, mask, sigma };
}

// ───────────────────────────── Spectra ─────────────────────────────

export interface SpectrumResult {
  epochIndex: number;
  x: number;
  y: number;
  wavelengthsUm: number[];
  fluxUjy: number[];
  sigmaUjy: number[];
  /** Name of the dominant source near the pixel, if any. */
  nearestSource: string | null;
}

/** 102-band spectrophotometry at a pixel: summed PSF contributions of nearby sources plus sky. */
export function spectrumAt(scene: SkyScene, epochIndex: number, x: number, y: number): SpectrumResult {
  const epoch = EPOCHS[epochIndex];
  const flux = new Array<number>(CHANNEL_COUNT).fill(BACKGROUND_UJY);
  const best = { name: null as string | null, w: 0 };
  const inv = 1 / (2 * 1.15 * 1.15);

  const contribute = (px: number, py: number, peak: number, template: TemplateId, name: string) => {
    const d2 = (px - x) * (px - x) + (py - y) * (py - y);
    const w = peak * Math.exp(-d2 * inv);
    if (w < 1e-3) return;
    for (let c = 0; c < CHANNEL_COUNT; c++) flux[c] += w * templateFlux(template, WAVELENGTHS_UM[c]);
    if (w > best.w) {
      best.w = w;
      best.name = name;
    }
  };

  for (const s of scene.stars) contribute(s.x, s.y, s.amp, s.template, s.template === "star" ? "Field star" : "Field M dwarf");
  for (const t of scene.targets) {
    const p = targetPixel(scene, t, epoch);
    contribute(p.x, p.y, t.amplitudeUjy * variabilityFactor(t, epoch), t.template, t.name);
  }

  const noise = mulberry32(hashString(`spec|${scene.key}|${epochIndex}|${x.toFixed(1)}|${y.toFixed(1)}`));
  const fluxUjy = flux.map((f) => Number((f + gaussian(noise) * CHANNEL_SIGMA_UJY).toFixed(3)));
  return {
    epochIndex,
    x,
    y,
    wavelengthsUm: WAVELENGTHS_UM,
    fluxUjy,
    sigmaUjy: WAVELENGTHS_UM.map(() => CHANNEL_SIGMA_UJY),
    nearestSource: best.name,
  };
}

// ───────────────────────────── Overlays ─────────────────────────────

export interface GaiaOverlaySource {
  id: string;
  x: number;
  y: number;
  gMag: number;
  /** Direction of proper motion, degrees east of north (screen: N up, E left). */
  pmAngleDeg: number;
  /** Proper motion in pixels per year (for arrow scaling). */
  pmPxPerYr: number;
}

export interface WiseOverlaySource {
  id: string;
  label: string;
  year: number;
  x: number;
  y: number;
  /** Current (epoch-1) pixel position of the same object, for drift lines. */
  currentX: number;
  currentY: number;
  inFrame: boolean;
}

export interface OverlayData {
  gaia: GaiaOverlaySource[];
  wise: WiseOverlaySource[];
}

export function buildOverlays(scene: SkyScene, epochIndex: number): OverlayData {
  const epoch = EPOCHS[epochIndex];
  const pxPerArcsec = 1 / scene.wcs.arcsecPerPx;

  const gaia: GaiaOverlaySource[] = [];
  scene.stars.forEach((s, i) => {
    const amp = s.amp;
    if (amp < 20) return; // Gaia-visible stars only
    const pmx = s.pmRaArcsecYr * pxPerArcsec;
    const pmy = s.pmDecArcsecYr * pxPerArcsec;
    gaia.push({
      id: `gaia-${i}`,
      x: s.x,
      y: s.y,
      gMag: Number((17 - 2.5 * Math.log10(amp / 10)).toFixed(2)),
      pmAngleDeg: normalizeAngle((Math.atan2(s.pmRaArcsecYr, s.pmDecArcsecYr) * 180) / Math.PI),
      pmPxPerYr: Math.hypot(pmx, pmy),
    });
  });

  const wise: WiseOverlaySource[] = [];
  for (const t of scene.targets) {
    const now = targetPixel(scene, t, epoch);
    for (const year of [2010.5, 2024.5]) {
      const dt = year - CATALOG_REF_YEAR;
      const cosDec = Math.max(Math.cos((t.dec * Math.PI) / 180), 1e-6);
      const w = {
        ra: normalizeRa(t.ra + (t.pmRaArcsecYr * dt) / 3600 / cosDec),
        dec: t.dec + (t.pmDecArcsecYr * dt) / 3600,
      };
      const p = scene.wcs.worldToPixel(w.ra, w.dec);
      wise.push({
        id: `wise-${t.id}-${year}`,
        label: `${t.name} · WISE ${year.toFixed(1)}`,
        year,
        x: p.x,
        y: p.y,
        currentX: now.x,
        currentY: now.y,
        inFrame: p.x >= 0 && p.x < FRAME_SIZE && p.y >= 0 && p.y < FRAME_SIZE,
      });
    }
  }

  return { gaia, wise };
}

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

// ───────────────────────────── Transfer & cost estimates ─────────────────────────────

/**
 * Estimated transfer size for a view. Purely a UX hint: real sizes depend on
 * the backend's tile format. Scales with FoV, band count and epoch count.
 */
export function estimateTransferMB(fovArcmin: number, bandCount: number, epochCount = EPOCHS.length): number {
  const mb = 0.45 * Math.sqrt(fovArcmin) * bandCount * (epochCount / 4);
  return Math.max(0.1, Math.round(mb * 10) / 10);
}

export function motionTag(fovArcmin: number): string {
  if (fovArcmin <= 1) return "Fast Mover Tracking";
  if (fovArcmin <= 5) return "Mover Tracking";
  if (fovArcmin <= 15) return "Wide-Field Survey";
  return "Context Survey";
}

/** Band count used for transfer estimates. */
export function bandCountFor(band: BandKey): number {
  if (band === "stack") return SPHEREX_ARRAYS.length;
  if (band === "rgb") return 3;
  if (band.startsWith("ch")) return 1;
  return 1;
}
