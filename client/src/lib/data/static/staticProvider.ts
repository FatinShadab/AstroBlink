import type {
  FieldData,
  FrameMeta,
  FramePixels,
  SkyTarget,
  SpectrumPoint,
} from "../types";
import type { SkyDataProvider } from "../provider";

/**
 * Real SPHEREx observations for the five preset targets, read from the static files that
 * client/scripts/fetch_spherex.py writes to public/data/<preset-id>/ (manifest, frames, spectrum).
 * No network calls leave the browser; the files ship with the app.
 *
 * Errors are thrown, never replaced with simulated data (the brief forbids a silent fallback).
 */

interface ManifestFrame {
  centrePixel: { x: number; y: number };
  id: string;
  obsDate: string;
  detector: FrameMeta["detector"];
  wavelengthUm: number;
  width: number;
  height: number;
  pixelScaleArcsec: number;
  hasFlags: boolean;
  /** Aperture photometry at the target (mJy); null when the aperture is saturated or off the image. */
  flux?: number | null;
  fluxErr?: number | null;
  files: { pixels: string; flags: string };
}

interface Manifest {
  id: string;
  name: string;
  frames: ManifestFrame[];
  detectors: string[];
  dateRange: [string, string];
}

const DATA_ROOT = "/data";
const manifestCache = new Map<string, Promise<Manifest>>();
const spectrumCache = new Map<string, Promise<SpectrumPoint[]>>();

async function fetchOk(url: string, signal?: AbortSignal): Promise<Response> {
  // "no-cache" revalidates with the server (a cheap 304 when unchanged), so a data refresh is never
  // hidden behind stale browser copies with the same file names.
  const res = await fetch(url, { signal, cache: "no-cache" });
  if (!res.ok) throw new Error(`Real data file missing or unreadable: ${url} (HTTP ${res.status})`);
  return res;
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

/**
 * Shared, cached requests are made without any one caller's abort signal: otherwise a caller that
 * aborts (React runs effects twice in development) would leave a rejected promise in the cache for
 * the next caller. Each caller checks its own signal after the shared request settles.
 */
async function loadManifest(presetId: string, signal?: AbortSignal): Promise<Manifest> {
  let cached = manifestCache.get(presetId);
  if (!cached) {
    cached = fetchOk(`${DATA_ROOT}/${presetId}/manifest.json`).then((r) => r.json() as Promise<Manifest>);
    manifestCache.set(presetId, cached);
    // A failed load must not stay cached, so the next attempt can retry.
    cached.catch(() => manifestCache.delete(presetId));
  }
  const manifest = await cached;
  checkAborted(signal);
  return manifest;
}

/**
 * A size × size window centred on the target pixel. Pixels outside the stored cutout are NaN (no data)
 * and their flags are 0, so the viewer shows them as empty rather than inventing values.
 */
export function cropAround(
  data: Float32Array,
  flags: Uint8Array,
  width: number,
  height: number,
  centre: { x: number; y: number },
  size: number,
): { data: Float32Array; flags: Uint8Array } {
  const out = new Float32Array(size * size).fill(Number.NaN);
  const outFlags = new Uint8Array(size * size);
  const x0 = centre.x - Math.floor(size / 2);
  const y0 = centre.y - Math.floor(size / 2);
  for (let y = 0; y < size; y++) {
    const sy = y0 + y;
    if (sy < 0 || sy >= height) continue;
    for (let x = 0; x < size; x++) {
      const sx = x0 + x;
      if (sx < 0 || sx >= width) continue;
      out[y * size + x] = data[sy * width + sx];
      outFlags[y * size + x] = flags[sy * width + sx];
    }
  }
  return { data: out, flags: outFlags };
}

/**
 * Relative wavelength tolerance per detector: about half a SPHEREx resolution element.
 * D1–D4 have R ≈ 35–41 (≈ 2.5 % per element); D5–D6 have R ≈ 112–128 (≈ 0.8 %).
 */
export function wavelengthTolerance(detector: FrameMeta["detector"]): number {
  return detector === "D5" || detector === "D6" ? 0.005 : 0.012;
}

/**
 * SPHEREx is a linear-variable-filter instrument: the wavelength at the target depends on where it falls
 * on the detector, so it changes between visits. Blinking frames at different wavelengths would show
 * colour as fake brightness change. This keeps the largest group of frames whose wavelength at the target
 * matches within the tolerance; ties go to the group that spans the longest time. Fewer than two matching
 * frames returns an empty list, and the caller reports it.
 */
export function selectMatchedWavelength<T extends Pick<FrameMeta, "obsDate" | "wavelengthUm" | "detector">>(
  frames: T[],
): T[] {
  if (frames.length < 2) return [];
  const tol = wavelengthTolerance(frames[0].detector);
  let best: T[] = [];
  let bestSpan = -1;
  for (const anchor of frames) {
    const group = frames.filter(
      (f) => Math.abs(f.wavelengthUm - anchor.wavelengthUm) / anchor.wavelengthUm <= tol,
    );
    const dates = group.map((f) => Date.parse(f.obsDate));
    const span = Math.max(...dates) - Math.min(...dates);
    if (group.length > best.length || (group.length === best.length && span > bestSpan)) {
      best = group;
      bestSpan = span;
    }
  }
  return best.length >= 2 ? [...best].sort((a, b) => a.obsDate.localeCompare(b.obsDate)) : [];
}

/** The preset id is the first part of a frame id ("wise-0855-D2-6080151418" → "wise-0855"). */
export function presetIdOfFrame(frameId: string): string {
  return frameId.replace(/-D[1-6]-\d+$/, "");
}

export function createStaticProvider(presetIdOf: (target: SkyTarget) => string | null): SkyDataProvider {
  return {
    kind: "static",

    async getField(target, signal) {
      const presetId = presetIdOf(target);
      if (!presetId) throw new Error("No real data is available for these coordinates.");
      const manifest = await loadManifest(presetId, signal);
      const onDetector = manifest.frames.filter((f) => f.detector === target.detector);
      const matched = selectMatchedWavelength(onDetector);
      if (onDetector.length > 0 && matched.length === 0) {
        throw new Error(
          `${manifest.name}: no two ${target.detector} observations share a matching wavelength, so they cannot be compared. Try another detector.`,
        );
      }
      const frames: FrameMeta[] = matched
        .map((f) => {
          // The stored cutout is 15′; the view shows the chosen field of view, centred on the target.
          const size = Math.min(f.width, Math.max(8, Math.round((target.fovArcmin * 60) / f.pixelScaleArcsec)));
          return {
            id: f.id,
            obsDate: f.obsDate,
            detector: f.detector,
            wavelengthUm: f.wavelengthUm,
            width: size,
            height: size,
            pixelScaleArcsec: f.pixelScaleArcsec,
            hasFlags: f.hasFlags,
          };
        })
        .sort((a, b) => a.obsDate.localeCompare(b.obsDate));
      if (frames.length === 0) {
        throw new Error(`No real ${target.detector} observations are stored for ${manifest.name}.`);
      }
      // Light curve from the aperture photometry in the manifest (saturated frames have no point).
      // Data written before photometry existed has no `flux` field; then there is no light curve here
      // and the view measures the frames itself.
      const hasPhotometry = matched.some((f) => "flux" in f);
      const lightCurve = hasPhotometry
        ? matched
            .filter((f) => typeof f.flux === "number" && Number.isFinite(f.flux))
            .map((f) => ({
              obsDate: f.obsDate,
              flux: f.flux as number,
              fluxErr: typeof f.fluxErr === "number" ? f.fluxErr : 0,
              frameId: f.id,
            }))
        : undefined;
      const field: FieldData = {
        fieldId: `real-${presetId}-${target.detector}`,
        target,
        frames,
        lightCurve,
        source: "static",
        isSimulated: false,
      };
      return field;
    },

    async getFramePixels(frame, signal): Promise<FramePixels> {
      const presetId = presetIdOfFrame(frame.id);
      const manifest = await loadManifest(presetId, signal);
      const entry = manifest.frames.find((f) => f.id === frame.id);
      if (!entry) throw new Error(`Frame ${frame.id} is not in the real-data manifest.`);
      const [pixelsRes, flagsRes] = await Promise.all([
        fetchOk(`${DATA_ROOT}/${presetId}/${entry.files.pixels}`, signal),
        fetchOk(`${DATA_ROOT}/${presetId}/${entry.files.flags}`, signal),
      ]);
      const full = new Float32Array(await pixelsRes.arrayBuffer());
      const fullFlags = new Uint8Array(await flagsRes.arrayBuffer());
      const { data, flags } = cropAround(full, fullFlags, entry.width, entry.height, entry.centrePixel, frame.width);
      return { frameId: frame.id, width: frame.width, height: frame.height, data, flags };
    },

    async getSpectrum(target, _pixel, signal) {
      const presetId = presetIdOf(target);
      if (!presetId) throw new Error("No real spectrum is available for these coordinates.");
      let cached = spectrumCache.get(presetId);
      if (!cached) {
        cached = fetchOk(`${DATA_ROOT}/${presetId}/spectrum.json`).then(
          (r) => r.json() as Promise<SpectrumPoint[]>,
        );
        spectrumCache.set(presetId, cached);
        cached.catch(() => spectrumCache.delete(presetId));
      }
      // One point per detector at the target pixel. The pixel argument is not used yet.
      const points = await cached;
      checkAborted(signal);
      return points;
    },

    async getProjectQueue() {
      throw new Error("Project queues are served by the synthetic provider, not the real-data provider.");
    },
  };
}
