/**
 * Mock service: implements the same operations as the FastAPI backend, backed
 * entirely by the SPHEREx mock engine. Components never call this directly —
 * they go through `client.ts`, which routes here when NEXT_PUBLIC_USE_MOCK_DATA
 * is true (the default until the backend serves these endpoints).
 */

import type {
  CandidateListResponse,
  CandidateResponse,
  CandidateStatus,
  ClassificationResponse,
  ClassificationCategory,
  SubjectResponse,
} from "./generated/types";
import type { BenchmarkView, ClassificationRequestView, EpochView, OverlaysResponse, SpectrumResponse } from "./types";
import { ANNOTATION_TO_CONTRACT } from "./types";
import type { WorldCoord } from "@/lib/coords";
import {
  BENCHMARK_TARGETS,
  EPOCHS,
  buildOverlays,
  buildScene,
  canonicalTargetName,
  findBenchmark,
  hashString,
  renderFrame,
  spectrumAt,
  type BandKey,
  type Frame,
  type SkyScene,
} from "@/lib/mock/spherexMockEngine";

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

function sceneFor(p: ViewParams): SkyScene {
  return buildScene({ ra: p.ra, dec: p.dec } as WorldCoord, p.fovArcmin);
}

function subjectIdFor(scene: SkyScene): string {
  return `sub_${hashString(scene.key).toString(16).padStart(8, "0")}`;
}

// ───────────────────────────── In-memory community store ─────────────────────────────

interface StoredClassification {
  subjectId: string;
  category: ClassificationCategory;
  reliability: number;
}

const classificationLog: StoredClassification[] = [];
const seededCounts: Record<string, number> = {};

/** Gold-standard seed history so the discoveries page is not empty on first load. */
const SEED_HISTORY: Array<{ target: string; category: ClassificationCategory; count: number; reliability: number }> = [
  { target: "wise_0855", category: "brown_dwarf", count: 12, reliability: 0.88 },
  { target: "eps_indi_b", category: "brown_dwarf", count: 6, reliability: 0.74 },
];

function subjectCount(subjectId: string): number {
  return (seededCounts[subjectId] ?? 0) + classificationLog.filter((c) => c.subjectId === subjectId).length;
}

function statusFor(n: number, reliability: number): CandidateStatus {
  if (n === 0) return "new";
  if (n < 5) return "under_review";
  return reliability >= 0.75 ? "confirmed" : "rejected";
}

// Seed counts keyed by the same subject id the UI will compute for that benchmark.
for (const seed of SEED_HISTORY) {
  const t = findBenchmark(seed.target);
  if (!t) continue;
  seededCounts[subjectIdFor(sceneFor({ ra: t.ra, dec: t.dec, fovArcmin: 5 }))] = seed.count;
}

// ───────────────────────────── Public operations ─────────────────────────────

export async function getSubject(p: ViewParams): Promise<SubjectResponse> {
  const scene = sceneFor(p);
  const id = subjectIdFor(scene);
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

export function resolveTargetSync(query: string): WorldCoord | null {
  const t = findBenchmark(query);
  return t ? { ra: t.ra, dec: t.dec } : null;
}

export function canonicalNameSync(query: string): string | null {
  return canonicalTargetName(query);
}

export async function getOverlays(p: ViewParams, epochIndex: number): Promise<OverlaysResponse> {
  const data = buildOverlays(sceneFor(p), epochIndex);
  return delay({
    gaia: data.gaia.map((g) => ({
      id: g.id,
      x: g.x,
      y: g.y,
      g_mag: g.gMag,
      pm_angle_deg: g.pmAngleDeg,
      pm_px_per_yr: g.pmPxPerYr,
    })),
    wise: data.wise.map((w) => ({
      id: w.id,
      label: w.label,
      year: w.year,
      x: w.x,
      y: w.y,
      current_x: w.currentX,
      current_y: w.currentY,
      in_frame: w.inFrame,
    })),
  });
}

export async function getSpectrum(p: ViewParams, epochIndex: number, x: number, y: number): Promise<SpectrumResponse> {
  const scene = sceneFor(p);
  const s = spectrumAt(scene, epochIndex, x, y);
  const world = scene.wcs.pixelToWorld(x, y);
  return delay({
    subject_id: subjectIdFor(scene),
    epoch: EPOCHS[epochIndex].epoch,
    ra: world.ra,
    dec: world.dec,
    pixel_x: x,
    pixel_y: y,
    wavelength_um: s.wavelengthsUm,
    flux_ujy: s.fluxUjy,
    sigma_ujy: s.sigmaUjy,
    nearest_source: s.nearestSource,
  });
}

/** Renders one frame synchronously-in-spirit; wrapped so callers can await it like a tile fetch. */
export async function getFrame(p: ViewParams, epochIndex: number, band: BandKey): Promise<Frame> {
  return renderFrame(sceneFor(p), epochIndex, band);
}

export async function submitClassification(body: ClassificationRequestView): Promise<ClassificationResponse> {
  const subjectId = body.subject_id;
  const reliability = 0.6 + ((hashString(`${subjectId}|${body.marks.length}|${body.category}`) % 30) / 100);
  classificationLog.push({
    subjectId,
    category: ANNOTATION_TO_CONTRACT[body.category],
    reliability,
  });
  const n = subjectCount(subjectId);
  const retired = n >= 20;
  const badges = n === 1 ? ["First Light"] : n === 10 ? ["Blink Master"] : [];
  const id = `cls_${classificationLog.length.toString(36).padStart(5, "0")}`;
  return delay({
    classification_id: id,
    subject_id: subjectId,
    category: ANNOTATION_TO_CONTRACT[body.category],
    marks_count: body.marks.length,
    subject_classification_count: n,
    subject_retired: retired,
    badges_earned: badges,
    message: "Classification recorded (mock — not sent to a server)",
  });
}

export async function listCandidates(): Promise<CandidateListResponse> {
  const seeded: CandidateResponse[] = SEED_HISTORY.map((s) => {
    const t = findBenchmark(s.target);
    const id = t ? subjectIdFor(sceneFor({ ra: t.ra, dec: t.dec, fovArcmin: 5 })) : s.target;
    return {
      id: `cand_${s.target}`,
      subject_id: id,
      category: s.category,
      status: statusFor(s.count, s.reliability),
      n_classifications: s.count,
      mean_reliability: s.reliability,
      created_at: "2026-05-01T00:00:00Z",
      updated_at: "2026-11-01T00:00:00Z",
    };
  });
  return delay({ candidates: seeded, count: seeded.length });
}

export { statusFor as deriveCandidateStatus, EPOCHS };
