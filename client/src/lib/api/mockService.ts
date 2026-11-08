/**
 * Mock service: the offline stand-in for the FastAPI backend.
 *
 * It serves only catalogue-level data (benchmark targets, epochs, subject ids,
 * an empty community history). It does NOT synthesise sky images, spectra or
 * catalogue overlays: those return null / empty until real SPHEREx tiles and
 * photometry are served by the backend.
 */

import type {
  CandidateListResponse,
  ClassificationResponse,
  SubjectResponse,
} from "./generated/types";
import type { BenchmarkView, ClassificationRequestView, EpochView, OverlaysResponse, SpectrumResponse } from "./types";
import { ANNOTATION_TO_CONTRACT } from "./types";
import {
  BENCHMARK_TARGETS,
  EPOCHS,
  findBenchmark,
  hashString,
  type BandKey,
} from "@/lib/mock/spherexMockEngine";
import type { Frame } from "@/lib/mock/spherexMockEngine";

export interface ViewParams {
  ra: number;
  dec: number;
  fovArcmin: number;
}

/** Simulated network latency so loading states are exercised in mock mode. */
const LATENCY_MS = 120;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

function subjectIdFor(p: ViewParams): string {
  const key = `${p.ra.toFixed(4)}|${p.dec.toFixed(4)}|${p.fovArcmin}`;
  return `sub_${hashString(key).toString(16).padStart(8, "0")}`;
}

// ───────────────────────────── In-memory store ─────────────────────────────

const classificationLog: Array<{ subjectId: string; category: string }> = [];

function subjectCount(subjectId: string): number {
  return classificationLog.filter((c) => c.subjectId === subjectId).length;
}

// ───────────────────────────── Public operations ─────────────────────────────

export async function getSubject(p: ViewParams): Promise<SubjectResponse> {
  const id = subjectIdFor(p);
  return delay({
    id,
    ra_deg: p.ra,
    dec_deg: p.dec,
    size_deg: p.fovArcmin / 60,
    epochs: EPOCHS.map((e) => e.epoch),
    tile_urls: {},
    classification_count: subjectCount(id),
    retired: false,
  });
}

let nextBenchmarkCursor = 0;

/** Next subject to classify: rotates through the benchmark targets. */
export async function getNextSubject(fovArcmin = 5): Promise<SubjectResponse> {
  const t = BENCHMARK_TARGETS[nextBenchmarkCursor % BENCHMARK_TARGETS.length];
  nextBenchmarkCursor += 1;
  return getSubject({ ra: t.ra, dec: t.dec, fovArcmin });
}

export function listEpochs(): EpochView[] {
  return EPOCHS.map((e) => ({ index: e.index, epoch: e.epoch, label: e.label, iso_date: e.isoDate, mjd: e.mjd }));
}

export function listBenchmarks(): BenchmarkView[] {
  return BENCHMARK_TARGETS.map((t) => ({
    id: t.id,
    name: t.name,
    description: t.description,
    ra: t.ra,
    dec: t.dec,
    default_fov_arcmin: 5,
  }));
}

export async function resolveTarget(query: string): Promise<BenchmarkView | null> {
  const t = findBenchmark(query);
  if (!t) return delay(null);
  return delay(listBenchmarks().find((b) => b.id === t.id) ?? null);
}

/** No catalogue overlays are synthesised; the backend supplies Gaia / WISE sources. */
export async function getOverlays(_p: ViewParams, _epochIndex: number): Promise<OverlaysResponse> {
  return delay({ gaia: [], wise: [] });
}

/** No spectrum is synthesised; returns null until photometry is available. */
export async function getSpectrum(
  _p: ViewParams,
  _epochIndex: number,
  _x: number,
  _y: number,
): Promise<SpectrumResponse | null> {
  return delay(null);
}

/** No sky frames are synthesised; returns null so the canvas stays empty. */
export async function getFrame(_p: ViewParams, _epochIndex: number, _band: BandKey): Promise<Frame | null> {
  return null;
}

export async function submitClassification(body: ClassificationRequestView): Promise<ClassificationResponse> {
  classificationLog.push({ subjectId: body.subject_id, category: ANNOTATION_TO_CONTRACT[body.category] });
  const n = subjectCount(body.subject_id);
  const id = `cls_${classificationLog.length.toString(36).padStart(5, "0")}`;
  return delay({
    classification_id: id,
    subject_id: body.subject_id,
    category: ANNOTATION_TO_CONTRACT[body.category],
    marks_count: body.marks.length,
    subject_classification_count: n,
    subject_retired: n >= 20,
    badges_earned: n === 1 ? ["First Light"] : [],
    message: "Classification recorded locally (mock mode — not sent to a server)",
  });
}

/** No community history is seeded; the feed starts empty until the backend supplies candidates. */
export async function listCandidates(): Promise<CandidateListResponse> {
  return delay({ candidates: [], count: 0 });
}
