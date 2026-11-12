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
}

const UNIFORM_PEAK = { D1: 1200, D2: 1200, D3: 1200, D4: 1200, D5: 1200, D6: 1200 } as const;

export const PRESETS: readonly Preset[] = [
  {
    id: "barnard",
    name: "Barnard's Star",
    kind: "mover",
    detector: "D2",
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
  },
  {
    id: "r-dra",
    name: "R Draconis",
    kind: "variable",
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

/** The preset whose position matches this target within 1′, if any. Used by the synthetic model. */
export function presetAt(target: Pick<SkyTarget, "raDeg" | "decDeg">): Preset | undefined {
  const tolDeg = 1 / 60;
  return PRESETS.find((p) => {
    if (!isPresetReady(p)) return false;
    const dRa =
      (((target.raDeg - p.raDeg + 540) % 360) - 180) * Math.cos((p.decDeg * Math.PI) / 180);
    const dDec = target.decDeg - p.decDeg;
    return Math.hypot(dRa, dDec) < tolDeg;
  });
}
