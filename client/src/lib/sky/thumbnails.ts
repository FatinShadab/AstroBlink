import type { Detector, SkyTarget } from "@/lib/data/types";
import { cropAround, glitchMask, selectMatchedWavelength } from "@/lib/data/static/staticProvider";
import { generateFramePixels } from "@/lib/data/synthetic/generateField";
import { fillEnclosedNaN } from "./fill";
import { percentileRange, stretchToU8 } from "./stretch";

/**
 * Small images for the project pages, made from our own data with the viewer's display:
 * the same matched-wavelength frames, the same display fill of saturated cores, one clip range for all
 * frames of the image, and the viewer's default asinh stretch.
 */

export interface RealThumb {
  kind: "real";
  /** Preset id (folder under public/data). */
  preset: string;
  detector: Detector;
  /** "ends": earliest and latest matched frames (a 2-frame blink); "first": one still frame. */
  frames: "ends" | "first";
  /** With "first": which matched frame to show (default 0, the earliest), e.g. to skip a frame with an artefact. */
  frameIndex?: number;
  /** Side of the square crop in pixels (6.2″ each). */
  size: number;
  /** Crop centre relative to the target, in pixels (default: on the target). */
  offset?: { x: number; y: number };
  /**
   * Where the clip range comes from: "frame" (default) the whole stored frames, so a bright star does not
   * black out its neighbours; "crop" the crop itself, which suits a faint target.
   */
  clip?: "frame" | "crop";
}

export interface SimulatedGlitchThumb {
  kind: "simulated-glitch";
}

export type ThumbSpec = RealThumb | SimulatedGlitchThumb;

export interface ThumbFrame {
  grey: Uint8ClampedArray;
  /** 1 where a pixel is flagged as a glitch. */
  flags: Uint8Array;
  obsDate?: string;
}

export interface ThumbImage {
  width: number;
  height: number;
  frames: ThumbFrame[];
}

interface ManifestFrame {
  id: string;
  obsDate: string;
  detector: Detector;
  wavelengthUm: number;
  width: number;
  height: number;
  centrePixel: { x: number; y: number };
  files: { pixels: string; flags: string };
}

const manifests = new Map<string, Promise<{ frames: ManifestFrame[] }>>();

async function getBuffer(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Missing data file: ${url}`);
  return res.arrayBuffer();
}

function loadManifest(preset: string): Promise<{ frames: ManifestFrame[] }> {
  let m = manifests.get(preset);
  if (!m) {
    m = fetch(`/data/${preset}/manifest.json`).then((r) => {
      if (!r.ok) throw new Error(`Missing manifest for ${preset}`);
      return r.json();
    });
    manifests.set(preset, m);
    m.catch(() => manifests.delete(preset));
  }
  return m;
}

async function loadReal(spec: RealThumb, signal?: AbortSignal): Promise<ThumbImage> {
  const manifest = await loadManifest(spec.preset);
  const group = selectMatchedWavelength(manifest.frames.filter((f) => f.detector === spec.detector));
  if (group.length === 0) throw new Error(`No matched frames for ${spec.preset} ${spec.detector}`);
  const picks =
    spec.frames === "ends" && group.length >= 2
      ? [group[0], group[group.length - 1]]
      : [group[Math.min(spec.frameIndex ?? 0, group.length - 1)]];
  const crops = await Promise.all(
    picks.map(async (f) => {
      const [px, fl] = await Promise.all([
        getBuffer(`/data/${spec.preset}/${f.files.pixels}`, signal),
        getBuffer(`/data/${spec.preset}/${f.files.flags}`, signal),
      ]);
      const centre = {
        x: f.centrePixel.x + Math.round(spec.offset?.x ?? 0),
        y: f.centrePixel.y + Math.round(spec.offset?.y ?? 0),
      };
      const full = fillEnclosedNaN(new Float32Array(px), f.width, f.height);
      const { data, flags } = cropAround(full, glitchMask(new Uint8Array(fl)), f.width, f.height, centre, spec.size);
      return { data, full, flags, obsDate: f.obsDate };
    }),
  );
  // Clip range from the whole stored frames: in a small crop a bright star fills the top percentiles and
  // would leave the surrounding stars black.
  const range = percentileRange(crops.map((c) => (spec.clip === "crop" ? c.data : c.full)));
  return {
    width: spec.size,
    height: spec.size,
    frames: crops.map((c) => ({ grey: stretchToU8(c.data, range, "asinh"), flags: c.flags, obsDate: c.obsDate })),
  };
}

/** A simulated sky (not a real target) whose frames carry the synthetic model's flagged cosmic-ray hits. */
const SIMULATED_TARGET: SkyTarget = { raDeg: 150.1, decDeg: 2.2, fovArcmin: 5, detector: "D3" };
const SIMULATED_TODAY = new Date("2026-11-01T00:00:00Z"); // fixed, so the image never changes

function loadSimulated(): ThumbImage {
  const frames = [0, 1].map((i) =>
    generateFramePixels(SIMULATED_TARGET, i, SIMULATED_TODAY, { contributor: true }),
  );
  const range = percentileRange(frames.map((f) => f.data));
  return {
    width: frames[0].width,
    height: frames[0].height,
    frames: frames.map((f) => ({
      grey: stretchToU8(f.data, range, "asinh"),
      // Only cosmic-ray hits (flag 1), as in the glitch overlay.
      flags: (f.flags ?? new Uint8Array(f.data.length)).map((v) => (v & 1 ? 1 : 0)),
    })),
  };
}

export function loadThumb(spec: ThumbSpec, signal?: AbortSignal): Promise<ThumbImage> {
  return spec.kind === "real" ? loadReal(spec, signal) : Promise.resolve(loadSimulated());
}
