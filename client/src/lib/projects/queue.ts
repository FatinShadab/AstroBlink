/**
 * Field queues for the citizen-science projects (architecture §5.1 getProjectQueue).
 * Truth comes from the synthetic model itself, so it is known without guessing:
 *  - a mover preset → "moved", a variable preset → "brightness", a plain field → "no_change";
 *  - glitch patrol: "glitch" when a flagged pixel sits in the central 5×5 aperture, else "real".
 * Demo agreement percentages are seeded numbers, always labelled as demo data in the UI.
 */
import { presetAt, presetById, type PresetId } from "@/data/presets";
import type { ProjectDef } from "@/data/projects";
import { fieldIdFor, generateFramePixels } from "@/lib/data/synthetic/generateField";
import type { Answer, Detector, QueueField, SkyTarget } from "@/lib/data/types";
import { hashSeed, mulberry32 } from "@/lib/sky/prng";

const BATCH_PRESETS: Partial<Record<ProjectDef["slug"], PresetId[]>> = {
  "hunt-moving-stars": ["barnard", "wise-0855"],
  "brown-dwarfs": ["wise-0855"],
  "variable-watch": ["rw-aur"],
};

const TRUTH_EXPLANATION: Record<Answer, string> = {
  moved: "train.explain.moved",
  brightness: "train.explain.brightness",
  no_change: "train.explain.noChange",
  real: "train.explain.real",
  glitch: "train.explain.glitch",
  not_sure: "train.explain.notSure",
};

export function explanationKey(answer: Answer): string {
  return TRUTH_EXPLANATION[answer];
}

/** Truth for a target under a given project. */
export function truthFor(project: ProjectDef, target: SkyTarget): Answer {
  if (project.taskType === "glitch") return centreGlitch(target) ? "glitch" : "real";
  const special = presetAt(target)?.synthetic;
  if (!special) return "no_change";
  if (special.kind === "mover") return "moved";
  return "brightness";
}

/** True when the first frame has a flagged pixel in the central 5×5 aperture. */
export function centreGlitch(target: SkyTarget): boolean {
  // Same options as the contributor viewer, so the answer matches what people see.
  const px = generateFramePixels(target, 0, new Date(), { contributor: true });
  const flags = px.flags;
  if (!flags) return false;
  const side = px.width;
  const c = Math.floor(side / 2);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const x = c + dx;
      const y = c + dy;
      if (x >= 0 && y >= 0 && x < side && y < side && flags[y * side + x] !== 0) return true;
    }
  }
  return false;
}

function randomSky(rng: () => number, fov: 5 | 10, detector: Detector): SkyTarget {
  const ra = rng() * 360;
  const dec = (Math.asin(rng() * 2 - 1) * 180) / Math.PI;
  return {
    raDeg: Math.round(ra * 1e4) / 1e4,
    decDeg: Math.round(dec * 1e4) / 1e4,
    fovArcmin: fov,
    detector,
  };
}

function presetTarget(id: PresetId, fov: 5 | 10): SkyTarget {
  const p = presetById(id);
  if (!p) throw new Error(`Unknown preset ${id}`);
  return { raDeg: p.raDeg, decDeg: p.decDeg, fovArcmin: fov, detector: p.detector };
}

function field(project: ProjectDef, target: SkyTarget, seed: number): QueueField {
  const truth = truthFor(project, target);
  const rng = mulberry32(seed);
  const agreementPct = 55 + Math.floor(rng() * 36); // 55–90, demo data
  return {
    fieldId: fieldIdFor(target),
    target,
    truth,
    explanationKey: explanationKey(truth),
    demoAgreement: { answer: truth, percent: agreementPct },
  };
}

/** Classify batch: deterministic for (project, offset). Mixes known movers/variables with plain fields. */
export function buildBatch(project: ProjectDef, offset: number, size: number): QueueField[] {
  const out: QueueField[] = [];
  const presetIds = BATCH_PRESETS[project.slug] ?? [];
  for (let k = offset; k < offset + size; k++) {
    const rng = mulberry32(hashSeed(project.slug, "batch", k));
    const usePreset = presetIds.length > 0 && rng() < 0.4;
    const fov: 5 | 10 = rng() < 0.7 ? 5 : 10;
    const target = usePreset
      ? presetTarget(presetIds[Math.floor(rng() * presetIds.length)], fov)
      : randomSky(rng, fov, project.defaultDetector);
    out.push(field(project, target, hashSeed(project.slug, "agree", k)));
  }
  return out;
}

/** Five practice fields with known answers. Glitch practice scans for real and glitch examples. */
export function buildPractice(project: ProjectDef): QueueField[] {
  if (project.taskType === "glitch") return buildGlitchPractice(project);
  const plan: SkyTarget[] =
    project.slug === "hunt-moving-stars"
      ? [
          presetTarget("barnard", 5),
          randomSky(mulberry32(hashSeed("p", 1)), 5, "D2"),
          presetTarget("wise-0855", 5),
          randomSky(mulberry32(hashSeed("p", 2)), 5, "D2"),
          presetTarget("barnard", 10),
        ]
      : project.slug === "brown-dwarfs"
        ? [
            presetTarget("wise-0855", 5),
            randomSky(mulberry32(hashSeed("p", 3)), 5, "D6"),
            presetTarget("wise-0855", 10),
            randomSky(mulberry32(hashSeed("p", 4)), 5, "D6"),
            { ...presetTarget("wise-0855", 5), detector: "D5" },
          ]
        : [
            presetTarget("rw-aur", 5),
            randomSky(mulberry32(hashSeed("p", 5)), 5, "D3"),
            presetTarget("rw-aur", 10),
            randomSky(mulberry32(hashSeed("p", 6)), 5, "D3"),
            randomSky(mulberry32(hashSeed("p", 7)), 10, "D3"),
          ];
  return plan.map((target, i) => field(project, target, hashSeed(project.slug, "practice", i)));
}

function buildGlitchPractice(project: ProjectDef): QueueField[] {
  const rng = mulberry32(hashSeed(project.slug, "practice-scan"));
  const real: QueueField[] = [];
  const glitch: QueueField[] = [];
  for (let tries = 0; tries < 400 && (real.length < 3 || glitch.length < 2); tries++) {
    const target = randomSky(rng, 5, project.defaultDetector);
    const truth = centreGlitch(target) ? "glitch" : "real";
    if (truth === "real" && real.length < 3)
      real.push(field(project, target, hashSeed("g", tries)));
    if (truth === "glitch" && glitch.length < 2)
      glitch.push(field(project, target, hashSeed("g", tries)));
  }
  // Interleave so the practice order is not all one answer.
  const out: QueueField[] = [];
  for (let i = 0; i < 5; i++) {
    const pick = i % 2 === 0 ? real.shift() : glitch.shift();
    out.push(pick ?? real.shift() ?? glitch.shift() ?? field(project, randomSky(rng, 5, "D3"), i));
  }
  return out;
}
