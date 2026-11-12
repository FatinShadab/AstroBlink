import type { DictKey } from "@/lib/i18n/en";
import type { ThumbSpec } from "@/lib/sky/thumbnails";

/** An image for a project card or example, from client/public/data (real) or the synthetic model. */
export interface ProjectImage {
  spec: ThumbSpec;
  /** Real target name for the caption "Real SPHEREx image · <target>"; absent for simulated images. */
  target?: string;
  /** Screen-reader description. */
  labelKey: DictKey;
}

const BARNARD_BLINK: ProjectImage = {
  // D5: matched-wavelength frames from Aug 2025 and Sep 2026 (the viewer's default for Barnard's Star).
  spec: { kind: "real", preset: "barnard", detector: "D5", frames: "ends", size: 40 },
  target: "Barnard's Star",
  labelKey: "thumb.label.barnard",
};

const SIMULATED_GLITCH: ProjectImage = {
  spec: { kind: "simulated-glitch" },
  labelKey: "thumb.label.glitch",
};

/** Project card / project header images, by project slug. */
export const PROJECT_IMAGES: Record<string, ProjectImage> = {
  "hunt-moving-stars": BARNARD_BLINK,
  "brown-dwarfs": {
    spec: { kind: "real", preset: "eps-indi-b", detector: "D5", frames: "first", size: 40, clip: "crop" },
    target: "Epsilon Indi B",
    labelKey: "thumb.label.epsIndiB",
  },
  "variable-watch": {
    spec: { kind: "real", preset: "r-dra", detector: "D3", frames: "first", size: 40 },
    target: "R Draconis",
    labelKey: "thumb.label.rDra",
  },
  "glitch-patrol": SIMULATED_GLITCH,
};

/** Free explore: the whole stored 15′ field around Barnard's Star. */
export const FREE_EXPLORE_IMAGE: ProjectImage = {
  spec: { kind: "real", preset: "barnard", detector: "D3", frames: "first", size: 145 },
  target: "Barnard's Star field (15′)",
  labelKey: "thumb.label.wide",
};

/** "What to look for" examples, in the order of project.look.one / two / three. */
export const LOOK_FOR_IMAGES: readonly ProjectImage[] = [
  BARNARD_BLINK,
  SIMULATED_GLITCH,
  {
    // The same two dates as the mover, on a patch of sky beside the star: everything stays put.
    spec: { kind: "real", preset: "barnard", detector: "D5", frames: "ends", size: 40, offset: { x: -40, y: 30 } },
    target: "field near Barnard's Star",
    labelKey: "thumb.label.static",
  },
];
