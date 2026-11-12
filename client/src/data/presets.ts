import type { DictKey } from "@/lib/i18n/en";
import type { Detector, SkyTarget } from "@/lib/data/types";

/**
 * The five test targets (brain §5, architecture §6).
 *
 * Coordinates marked TODO are not yet verified. The app treats them as "pending":
 * the chip is disabled and says so, rather than inventing values (rules §9.3).
 * Sources for filled values are listed next to each preset.
 *
 * `synthetic` holds the simulated appearance used only by the SyntheticProvider.
 * Detector factors and variability amplitudes are illustrative, not measurements.
 */

export type PresetId = "barnard" | "eps-indi-b" | "wise-0855" | "rw-aur" | "r-dra";

export type SyntheticSpecial =
  | {
      kind: "mover";
      /** Total proper motion, mas/yr. */
      pmTotalMasYr: number;
      /** Components (μα cosδ, μδ) in mas/yr when known; otherwise the direction is simulated. */
      pmRaMasYr?: number;
      pmDecMasYr?: number;
      /** Counts at the object's peak for each detector (illustrative). */
      peakCounts: Record<Detector, number>;
    }
  | {
      kind: "variable";
      variability: "irregular" | { periodDays: number };
      /** Fractional amplitude of the simulated brightness change. */
      amplitude: number;
      peakCounts: number;
    };

export interface Preset {
  id: PresetId;
  name: string;
  kind: "mover" | "variable";
  detector: Detector;
  fovArcmin: 2 | 5 | 10 | 15;
  /** NaN until verified (see `coordsSource`). */
  raDeg: number;
  decDeg: number;
  coordsSource: string;
  synthetic: SyntheticSpecial;
  descriptionKey: DictKey;
  lookKey: DictKey;
  /** An honest note about the real data for this target (shown on the object card), if needed. */
  dataNoteKey?: DictKey;
}

const UNIFORM_PEAK = { D1: 1200, D2: 1200, D3: 1200, D4: 1200, D5: 1200, D6: 1200 } as const;

export const PRESETS: readonly Preset[] = [
  {
    id: "barnard",
    name: "Barnard's Star",
    kind: "mover",
    // D5: five frames at one wavelength from Aug 2025 to Sep 2026 (the longest baseline, 1.8 px of motion),
    // star field aligned (scripts/qa_check.py), and the steadiest brightness of this non-variable star.
    detector: "D5",
    fovArcmin: 5,
    raDeg: 269.446291, // position at epoch 2025.9
    decDeg: 4.767917,
    coordsSource:
      "Gaia DR3 4472832130942575872 (epoch 2016.0) propagated to 2025.9, the middle of the SPHEREx data. J2000 position: 17h57m48.5s +04°41′36″.",
    synthetic: {
      kind: "mover",
      pmTotalMasYr: 10392,
      pmRaMasYr: -801.6, // from the same source; confirm against SIMBAD
      pmDecMasYr: 10362.4,
      peakCounts: UNIFORM_PEAK,
    },
    descriptionKey: "preset.barnard.desc",
    lookKey: "preset.barnard.look",
  },
  {
    id: "eps-indi-b",
    name: "Epsilon Indi B",
    kind: "mover",
    detector: "D5",
    fovArcmin: 5,
    raDeg: 331.096448, // position at epoch 2025.9
    decDeg: -56.800596,
    coordsSource:
      "Gaia DR3 6412596012146801152 (epoch 2016.0) propagated to 2025.9, the middle of the SPHEREx data.",
    synthetic: {
      kind: "mover",
      pmTotalMasYr: 4700, // approximate (brain §5); direction TODO
      peakCounts: { D1: 40, D2: 60, D3: 120, D4: 300, D5: 500, D6: 500 },
    },
    descriptionKey: "preset.epsIndiB.desc",
    lookKey: "preset.epsIndiB.look",
  },
  {
    id: "wise-0855",
    name: "WISE 0855",
    kind: "mover",
    detector: "D6",
    fovArcmin: 5,
    raDeg: 133.760644, // position at epoch 2025.9
    decDeg: -7.241366,
    coordsSource:
      "CatWISE2020 J085507.96-071439.3 (epoch 2015.87) propagated to 2025.9. NASA's discovery position 08h55m10.831s −07°14′42.53″ is from an earlier epoch.",
    synthetic: {
      kind: "mover",
      pmTotalMasYr: 8100, // approximate; direction TODO
      peakCounts: { D1: 2, D2: 5, D3: 15, D4: 120, D5: 350, D6: 800 },
    },
    descriptionKey: "preset.wise0855.desc",
    lookKey: "preset.wise0855.look",
    dataNoteKey: "preset.wise0855.note",
  },
  {
    id: "rw-aur",
    name: "RW Aurigae",
    kind: "variable",
    detector: "D3",
    fovArcmin: 5,
    raDeg: 76.95625, // 05h07m49.5s, team brief
    decDeg: 30.40139, // +30°24′05″
    coordsSource:
      'Team brief (05h07m49.5s +30°24′05″); proper motion is negligible here. SIMBAD ("V* RW Aur A") was unreachable when the data was fetched.',
    synthetic: { kind: "variable", variability: "irregular", amplitude: 0.3, peakCounts: 900 },
    descriptionKey: "preset.rwAur.desc",
    lookKey: "preset.rwAur.look",
    dataNoteKey: "preset.rwAur.note",
  },
  {
    id: "r-dra",
    name: "R Draconis",
    kind: "variable",
    // R Dra saturates every SPHEREx detector, so brightness is measured on the unsaturated outer ring.
    // D3: eight frames at one wavelength (Apr 2025 to Jun 2026) with the clearest change, about 10x, far above
    // what the same method gives for the constant Barnard's Star on D3 (1.7x).
    detector: "D3",
    fovArcmin: 5,
    raDeg: 248.16667, // 16h32m40s, from the team brief
    decDeg: 66.755, // +66°45′18″, from the team brief
    coordsSource:
      "Team brief (16h32m40s +66°45′18″). SIMBAD was unreachable when the data was fetched; confirm before the demo.",
    synthetic: {
      kind: "variable",
      variability: { periodDays: 245 }, // brain §5
      amplitude: 0.5,
      peakCounts: 900,
    },
    descriptionKey: "preset.rDra.desc",
    lookKey: "preset.rDra.look",
  },
];

export function presetById(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}

export function isPresetReady(preset: Preset): boolean {
  return Number.isFinite(preset.raDeg) && Number.isFinite(preset.decDeg);
}

/**
 * Catalogue positions as published (J2000 / the challenge brief). The preset position above is the
 * star's position at epoch 2025.9; typing either one opens the real data.
 */
export const CATALOGUE_POSITIONS: Record<PresetId, { raDeg: number; decDeg: number; label: string }> = {
  "wise-0855": { raDeg: 133.795129, decDeg: -7.245147, label: "08h55m10.831s −07°14′42.53″ (challenge brief)" },
  barnard: { raDeg: 269.452083, decDeg: 4.693333, label: "17h57m48.5s +04°41′36″ (J2000)" },
  "eps-indi-b": { raDeg: 331.04375, decDeg: -56.782778, label: "22h04m10.5s −56°46′58″ (J2000)" },
  "r-dra": { raDeg: 248.166667, decDeg: 66.755, label: "16h32m40s +66°45′18″ (J2000)" },
  "rw-aur": { raDeg: 76.95625, decDeg: 30.401389, label: "05h07m49.5s +30°24′05″ (J2000)" },
};

/** Names people type for each target. Matching ignores case, spaces, apostrophes and punctuation. */
export const PRESET_ALIASES: Record<PresetId, readonly string[]> = {
  "wise-0855": ["WISE 0855", "WISE J0855", "WISE J085510.83-071442.5", "WISE 0855-0714"],
  barnard: ["Barnard's Star", "Barnard", "Barnards Star", "GJ 699", "Gliese 699"],
  "eps-indi-b": ["Epsilon Indi B", "Eps Ind B", "eps Indi B", "Epsilon Indi Ba"],
  "r-dra": ["R Draconis", "R Dra"],
  "rw-aur": ["RW Aurigae", "RW Aur", "RW Aur A"],
};

/** The stored real-data cutouts are 15′ wide, so a position within 5′ still has the target inside. */
export const REAL_MATCH_RADIUS_ARCMIN = 5;

function separationDeg(a: { raDeg: number; decDeg: number }, b: { raDeg: number; decDeg: number }): number {
  const dRa = (((a.raDeg - b.raDeg + 540) % 360) - 180) * Math.cos((b.decDeg * Math.PI) / 180);
  return Math.hypot(dRa, a.decDeg - b.decDeg);
}

/**
 * The preset whose position (epoch 2025.9) or catalogue position lies within 5′ of this target, if any.
 * The routed data provider uses this to choose real data; the synthetic model uses it too.
 */
export function presetAt(target: Pick<SkyTarget, "raDeg" | "decDeg">): Preset | undefined {
  const tolDeg = REAL_MATCH_RADIUS_ARCMIN / 60;
  return PRESETS.find((p) => {
    if (!isPresetReady(p)) return false;
    return (
      separationDeg(target, p) < tolDeg || separationDeg(target, CATALOGUE_POSITIONS[p.id]) < tolDeg
    );
  });
}

/** True when real SPHEREx data covers this position (one of the five test targets). */
export function hasRealData(target: Pick<SkyTarget, "raDeg" | "decDeg">): boolean {
  return presetAt(target) !== undefined;
}

function normaliseName(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** The preset a typed name refers to ("Barnard's Star", "WISE 0855", "R Dra"), if any. */
export function presetByName(text: string): Preset | undefined {
  const key = normaliseName(text);
  if (key.length < 3) return undefined;
  return PRESETS.find((p) =>
    [p.name, ...PRESET_ALIASES[p.id]].some((alias) => normaliseName(alias) === key),
  );
}
