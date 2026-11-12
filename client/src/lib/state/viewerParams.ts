import { parseAsFloat, parseAsInteger, parseAsString, parseAsStringLiteral } from "nuqs";
import { presetAt, presetById, type Preset } from "@/data/presets";
import { parseCoordinatePair, CoordError, type CoordErrorCode } from "@/lib/sky/coords";
import { DETECTOR_IDS } from "@/lib/sky/detectors";
import type { Detector, SkyTarget, StretchKind, ViewMode } from "@/lib/data/types";

/** URL is the source of truth for viewer state (architecture §7.1). */
export const VIEW_MODES = ["blink", "side", "merge", "diff", "stack"] as const;
export const STRETCHES = ["linear", "log", "asinh"] as const;
export const FOV_VALUES = [2, 5, 10, 15] as const;
export const DEFAULT_FOV = 5;
export const DEFAULT_DETECTOR: Detector = "D2";

/**
 * Parsers for nuqs. Optional values stay null when absent, so a preset can fill them in.
 * `f` is only written when the user pauses or steps, never during autoplay.
 */
export const viewerParsers = {
  preset: parseAsString,
  ra: parseAsFloat,
  dec: parseAsFloat,
  fov: parseAsInteger,
  det: parseAsStringLiteral(DETECTOR_IDS),
  mode: parseAsStringLiteral(VIEW_MODES).withDefault("blink"),
  f: parseAsInteger,
  a: parseAsInteger,
  b: parseAsInteger,
  st: parseAsStringLiteral(STRETCHES).withDefault("asinh"),
  fl: parseAsInteger.withDefault(0),
  /** Difference style: grey (default) or colour. Not in architecture §7.1; added for Phase 3. */
  ds: parseAsStringLiteral(["grey", "colour"] as const).withDefault("grey"),
};

export type ViewerParams = {
  preset: string | null;
  ra: number | null;
  dec: number | null;
  fov: number | null;
  det: Detector | null;
  mode: ViewMode;
  f: number | null;
  a: number | null;
  b: number | null;
  st: StretchKind;
  fl: number;
  ds: "grey" | "colour";
};

export type TargetResult =
  | { ok: true; target: SkyTarget; preset: Preset | null }
  | {
      ok: false;
      code: CoordErrorCode | "no-target" | "pending-preset" | "bad-fov";
      preset: Preset | null;
    };

/**
 * Work out the sky target from the URL. A preset fills in anything the URL leaves out.
 * A pending preset (coordinates still TODO) is reported, not guessed.
 */
export function resolveTarget(
  params: Pick<ViewerParams, "preset" | "ra" | "dec" | "fov" | "det">,
): TargetResult {
  const preset = params.preset ? (presetById(params.preset) ?? null) : null;
  if (
    preset &&
    (!Number.isFinite(preset.raDeg) || !Number.isFinite(preset.decDeg)) &&
    params.ra === null
  ) {
    return { ok: false, code: "pending-preset", preset };
  }
  const raDeg = params.ra ?? preset?.raDeg ?? null;
  const decDeg = params.dec ?? preset?.decDeg ?? null;
  if (raDeg === null || decDeg === null || !Number.isFinite(raDeg) || !Number.isFinite(decDeg)) {
    return { ok: false, code: "no-target", preset };
  }
  if (raDeg < 0 || raDeg >= 360 || decDeg < -90 || decDeg > 90) {
    return { ok: false, code: raDeg < 0 || raDeg >= 360 ? "ra-range" : "dec-range", preset };
  }
  // Typed coordinates that land on a real-data target use that target's own defaults
  // (WISE 0855 is brightest in D6), unless the URL says otherwise.
  const matched = preset ?? presetAt({ raDeg, decDeg }) ?? null;
  const fov = params.fov ?? matched?.fovArcmin ?? DEFAULT_FOV;
  if (!(FOV_VALUES as readonly number[]).includes(fov))
    return { ok: false, code: "bad-fov", preset: matched };
  const detector = params.det ?? matched?.detector ?? DEFAULT_DETECTOR;
  return { ok: true, target: { raDeg, decDeg, fovArcmin: fov, detector }, preset: matched };
}

/** Parse what the user typed into the search box. Throws CoordError with a code for the UI. */
export function parseSearch(text: string): { raDeg: number; decDeg: number } {
  try {
    return parseCoordinatePair(text);
  } catch (error) {
    if (error instanceof CoordError) throw error;
    throw new CoordError("format");
  }
}
