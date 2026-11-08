/**
 * Project catalogue for the citizen-science gallery.
 *
 * Projects and their pictures (fields to inspect) are catalogue data, not
 * imagery: each picture is a sky field described by coordinates, field of view
 * and epoch coverage. Images appear only once real SPHEREx tiles are served.
 */

import { BENCHMARK_TARGETS, type BenchmarkTarget } from "./spherexMockEngine";
import { DEFAULT_STATE, serializeState } from "@/lib/url-state";

export type ProjectCategory = "Brown dwarfs" | "Variable stars" | "Moving objects";

export interface Project {
  id: string;
  name: string;
  category: ProjectCategory;
  summary: string;
  description: string;
  targetIds: BenchmarkTarget["id"][];
}

export interface Picture {
  id: string;
  projectId: string;
  title: string;
  targetId: BenchmarkTarget["id"];
  ra: number;
  dec: number;
  fovArcmin: 5 | 15;
  epochCount: number;
}

export const PROJECTS: Project[] = [
  {
    id: "brown-dwarf-census",
    name: "Brown Dwarf Census",
    category: "Brown dwarfs",
    summary: "Find cold, faint brown dwarfs that drift slowly between epochs.",
    description:
      "Brown dwarfs are failed stars, some cooler than room temperature. Look for small, steady proper motion across the four SPHEREx epochs and tag each candidate you can separate from artifacts.",
    targetIds: ["wise_0855", "eps_indi_b"],
  },
  {
    id: "nearby-stars-motion",
    name: "Nearby Stars in Motion",
    category: "Moving objects",
    summary: "Track fast-moving red dwarfs with large proper motion.",
    description:
      "Nearby red dwarfs shift visibly over a year. Blink the fields and confirm the motion direction matches the Gaia arrows before tagging.",
    targetIds: ["barnards_star"],
  },
  {
    id: "young-star-variability",
    name: "Young Star Variability",
    category: "Variable stars",
    summary: "Measure brightness swings of young T Tauri stars.",
    description:
      "Young stars brighten and dim unpredictably as they accrete material. Compare epochs with difference imaging and mark stars whose residuals change sign.",
    targetIds: ["rw_aur"],
  },
  {
    id: "mira-light-curves",
    name: "Mira Pulsators",
    category: "Variable stars",
    summary: "Follow the pulsation of long-period Mira variables.",
    description:
      "Mira variables pulsate on roughly year-long cycles. Each epoch samples a different phase; tag the fields where the variable is clearly brighter or fainter than its neighbours.",
    targetIds: ["r_dra"],
  },
];

/** Pictures are generated from each project's benchmark targets: a close and a wide field per target. */
export function picturesFor(projectId: string): Picture[] {
  const project = PROJECTS.find((p) => p.id === projectId);
  if (!project) return [];
  const out: Picture[] = [];
  for (const targetId of project.targetIds) {
    const t = BENCHMARK_TARGETS.find((b) => b.id === targetId);
    if (!t) continue;
    out.push({
      id: `${project.id}--${t.id}-close`,
      projectId: project.id,
      title: `${t.name} · close field`,
      targetId: t.id,
      ra: t.ra,
      dec: t.dec,
      fovArcmin: 5,
      epochCount: 4,
    });
    out.push({
      id: `${project.id}--${t.id}-wide`,
      projectId: project.id,
      title: `${t.name} · wide field`,
      targetId: t.id,
      ra: t.ra,
      dec: t.dec,
      fovArcmin: 15,
      epochCount: 4,
    });
  }
  return out;
}

export function getProject(id: string): Project | undefined {
  return PROJECTS.find((p) => p.id === id);
}

export function getPicture(id: string | null | undefined): Picture | undefined {
  if (!id) return undefined;
  for (const p of PROJECTS) {
    const hit = picturesFor(p.id).find((pic) => pic.id === id);
    if (hit) return hit;
  }
  return undefined;
}

export const ALL_PICTURE_COUNT = PROJECTS.reduce((n, p) => n + picturesFor(p.id).length, 0);

/** Observatory link for a picture: its field, project and picture ids travel in the query. */
export function observatoryHref(pic: Picture): string {
  const qs = serializeState({ ...DEFAULT_STATE, ra: pic.ra, dec: pic.dec, fov: pic.fovArcmin, epochIndex: 0 });
  qs.set("project", pic.projectId);
  qs.set("subject", pic.id);
  return `/observatory?${qs.toString()}`;
}
