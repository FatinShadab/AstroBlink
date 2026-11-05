/**
 * Bi-directional URL state for the observatory.
 *
 * Shareable query parameters: ra, dec, fov, band, mode, speed, embed, plus
 * supporting keys (ep = 1-based epoch, loop, rgb, stretch, ov = overlay list).
 * Parsing is total: malformed values fall back to defaults instead of throwing.
 */

import { normalizeRa, clamp } from "@/lib/coords";
import { isBandKey, type ArrayId, type BandKey } from "@/lib/mock/spherexMockEngine";
import { DEFAULT_STRETCH, type DisplayMode, type StretchKind, type StretchSettings } from "@/lib/render/pixelMath";

export const FOV_CHOICES = [1, 5, 15, 30] as const;
export type FovChoice = (typeof FOV_CHOICES)[number];

export type LoopMode = "forward" | "pingpong";

export interface OverlayFlags {
  gaia: boolean;
  wise: boolean;
  mask: boolean;
  grid: boolean;
  compass: boolean;
}

export interface ObservatoryState {
  ra: number;
  dec: number;
  fov: FovChoice;
  band: BandKey;
  mode: DisplayMode;
  /** Playback speed in frames per second, 0.5–10. */
  speed: number;
  loop: LoopMode;
  embed: boolean;
  /** 0-based epoch index. */
  epochIndex: number;
  /** Arrays mapped to R, G, B in the false-colour composite. */
  rgb: [ArrayId, ArrayId, ArrayId];
  stretch: StretchSettings;
  overlays: OverlayFlags;
}

/** WISE 0855 — the default view, a fast mover that makes drift visible at 5′. */
export const DEFAULT_STATE: ObservatoryState = {
  ra: 133.795,
  dec: -7.245,
  fov: 5,
  band: "stack",
  mode: "blink",
  speed: 2,
  loop: "forward",
  embed: false,
  epochIndex: 0,
  rgb: [6, 4, 2],
  stretch: DEFAULT_STRETCH,
  overlays: { gaia: false, wise: false, mask: false, grid: true, compass: true },
};

const MODES: DisplayMode[] = ["blink", "coadd", "diff"];
const STRETCHES: StretchKind[] = ["linear", "log", "asinh", "zscale"];
const OVERLAY_KEYS: Array<keyof OverlayFlags> = ["gaia", "wise", "mask", "grid", "compass"];

function num(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function parseState(params: URLSearchParams, base: ObservatoryState = DEFAULT_STATE): ObservatoryState {
  const ra = normalizeRa(num(params.get("ra"), base.ra));
  const dec = clamp(num(params.get("dec"), base.dec), -90, 90);

  const fovNum = num(params.get("fov"), base.fov);
  const fov = (FOV_CHOICES as readonly number[]).includes(fovNum) ? (fovNum as FovChoice) : base.fov;

  const bandParam = params.get("band");
  const band = isBandKey(bandParam) ? bandParam : base.band;

  const modeParam = params.get("mode") as DisplayMode | null;
  const mode = modeParam && MODES.includes(modeParam) ? modeParam : base.mode;

  const speed = clamp(num(params.get("speed"), base.speed), 0.5, 10);

  const loopParam = params.get("loop");
  const loop: LoopMode = loopParam === "pingpong" || loopParam === "forward" ? loopParam : base.loop;

  const embed = params.get("embed") === "true";

  const epochNum = Math.round(num(params.get("ep"), base.epochIndex + 1));
  const epochIndex = clamp(epochNum - 1, 0, 3);

  const rgbParam = params.get("rgb");
  let rgb = base.rgb;
  if (rgbParam) {
    const parts = rgbParam.split(",").map((p) => Number(p));
    if (parts.length === 3 && parts.every((p) => Number.isInteger(p) && p >= 1 && p <= 6)) {
      rgb = [parts[0], parts[1], parts[2]] as [ArrayId, ArrayId, ArrayId];
    }
  }

  const stretchParam = params.get("stretch") as StretchKind | null;
  const stretch: StretchSettings = {
    kind: stretchParam && STRETCHES.includes(stretchParam) ? stretchParam : base.stretch.kind,
    invert: params.get("invert") === "true",
    brightness: clamp(num(params.get("bright"), base.stretch.brightness), -0.5, 0.5),
    contrast: clamp(num(params.get("contrast"), base.stretch.contrast), 0.5, 3),
  };

  const ov = params.get("ov");
  const overlays: OverlayFlags = ov === null
    ? base.overlays
    : Object.fromEntries(OVERLAY_KEYS.map((k) => [k, ov.split(",").includes(k)])) as unknown as OverlayFlags;

  return { ra, dec, fov, band, mode, speed, loop, embed, epochIndex, rgb, stretch, overlays };
}

export function serializeState(state: ObservatoryState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("ra", state.ra.toFixed(5));
  p.set("dec", state.dec.toFixed(5));
  p.set("fov", String(state.fov));
  p.set("band", state.band);
  p.set("mode", state.mode);
  p.set("speed", String(state.speed));
  p.set("loop", state.loop);
  p.set("ep", String(state.epochIndex + 1));
  if (state.band === "rgb") p.set("rgb", state.rgb.join(","));
  if (state.stretch.kind !== "zscale") p.set("stretch", state.stretch.kind);
  if (state.stretch.invert) p.set("invert", "true");
  if (state.stretch.brightness !== 0) p.set("bright", state.stretch.brightness.toFixed(2));
  if (state.stretch.contrast !== 1) p.set("contrast", state.stretch.contrast.toFixed(2));
  const on = OVERLAY_KEYS.filter((k) => state.overlays[k]);
  p.set("ov", on.join(","));
  if (state.embed) p.set("embed", "true");
  return p;
}
