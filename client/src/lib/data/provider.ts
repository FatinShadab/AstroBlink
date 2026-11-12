import type {
  DataSourceKind,
  FieldData,
  FrameMeta,
  FramePixels,
  QueueField,
  SkyTarget,
  SpectrumPoint,
} from "./types";
import { apiProvider } from "./api/ApiProvider";
import {
  parseFieldId,
  splitFrameId,
  generateFramePixels,
  buildFieldData,
} from "./synthetic/generateField";
import { spectrumTemplate } from "./synthetic/templates";
import { projectBySlug } from "@/data/projects";
import { PRESETS, presetAt, isPresetReady, type PresetId } from "@/data/presets";
import { buildBatch, buildPractice } from "@/lib/projects/queue";
import { createStaticProvider, presetIdOfFrame } from "./static/staticProvider";

/** The one interface every data source implements (architecture §5.1). Components never fetch. */
export interface SkyDataProvider {
  readonly kind: DataSourceKind;
  getField(target: SkyTarget, signal?: AbortSignal): Promise<FieldData>;
  getFramePixels(frame: FrameMeta, signal?: AbortSignal): Promise<FramePixels>;
  getSpectrum(
    target: SkyTarget,
    pixel: { x: number; y: number },
    signal?: AbortSignal,
  ): Promise<SpectrumPoint[]>;
  getProjectQueue(
    projectSlug: string,
    opts: { batchSize: number; offset: number },
  ): Promise<QueueField[]>;
}

function checkAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

/** Default source. Everything runs in the browser and is labelled "Simulated sky". */
export const syntheticProvider: SkyDataProvider = {
  kind: "synthetic",

  async getField(target, signal) {
    checkAborted(signal);
    return buildFieldData(target);
  },

  async getFramePixels(frame, signal) {
    checkAborted(signal);
    const parts = splitFrameId(frame.id);
    const target = parts ? parseFieldId(parts.fieldId) : null;
    if (!parts || !target) throw new Error(`Unknown frame id ${frame.id}`);
    return generateFramePixels(target, parts.index);
  },

  async getSpectrum(target, pixel, signal) {
    checkAborted(signal);
    // The pixel is not used yet: the template is the same everywhere. Phase 3 will vary it per star.
    return spectrumTemplate(`${target.raDeg}_${target.decDeg}_${pixel.x}_${pixel.y}`);
  },

  /** offset −1 returns the five practice fields (with known answers); otherwise a classify batch. */
  async getProjectQueue(projectSlug, opts) {
    const project = projectBySlug(projectSlug);
    if (!project) throw new Error(`Unknown project ${projectSlug}`);
    return opts.offset < 0
      ? buildPractice(project)
      : buildBatch(project, opts.offset, opts.batchSize);
  },
};

/**
 * The five preset targets use real SPHEREx data (public/data, from scripts/fetch_spherex.py).
 * Any other coordinates stay on the labelled synthetic sky. Real data is never silently replaced
 * with simulated data: a missing file or frame is an error the UI shows.
 */
const realProvider = createStaticProvider((target) => {
  const preset = presetAt(target);
  return preset && isPresetReady(preset) ? preset.id : null;
});

const REAL_PRESET_IDS = new Set(PRESETS.map((p) => p.id));

/** Routes each call to the real or synthetic source. Project queues always come from the synthetic source. */
export const routedProvider: SkyDataProvider = {
  kind: "static",

  getField(target, signal) {
    return realProvider.getField(target, signal).catch((error: unknown) => {
      if (presetAt(target)) throw error;
      return syntheticProvider.getField(target, signal);
    });
  },

  getFramePixels(frame, signal) {
    const presetId = presetIdOfFrame(frame.id);
    return REAL_PRESET_IDS.has(presetId as PresetId)
      ? realProvider.getFramePixels(frame, signal)
      : syntheticProvider.getFramePixels(frame, signal);
  },

  getSpectrum(target, pixel, signal) {
    return presetAt(target)
      ? realProvider.getSpectrum(target, pixel, signal)
      : syntheticProvider.getSpectrum(target, pixel, signal);
  },

  getProjectQueue(projectSlug, opts) {
    return syntheticProvider.getProjectQueue(projectSlug, opts);
  },
};

/**
 * Chooses the source by NEXT_PUBLIC_DATA_SOURCE (architecture §5.1).
 * "api" is the backend (not wired yet); "static" and the default use the routed provider.
 */
export function getProvider(): SkyDataProvider {
  const source = process.env.NEXT_PUBLIC_DATA_SOURCE;
  if (source === "api") return apiProvider;
  return routedProvider;
}

/**
 * Which data a view asks for. "sky" is the normal choice (real data for the presets, synthetic elsewhere).
 * "synthetic" forces the labelled simulated sky; the classify and train flows use it, because their
 * fields have known answers that only the synthetic model provides.
 */
export type DataChoice = "sky" | "synthetic";

export function providerFor(choice: DataChoice): SkyDataProvider {
  return choice === "synthetic" ? syntheticProvider : getProvider();
}
