"use client";

import { useMemo } from "react";
import type { LoadedField } from "@/lib/data/useFieldFrames";
import { makeFrameCanvas } from "@/lib/sky/render";
import { stretchToU8, type Adjust, type StretchKind } from "@/lib/sky/stretch";

/**
 * One canvas per frame at native size, all using the field-wide clip range so frames share a scale.
 * Rebuilt only when the field, the stretch or the Image-tab adjustments change (architecture §8).
 */
export function useFrameCanvases(
  loaded: LoadedField | null,
  stretch: StretchKind,
  adjust: Adjust,
): HTMLCanvasElement[] {
  return useMemo(() => {
    if (!loaded) return [];
    return loaded.frames.map((frame) =>
      makeFrameCanvas(
        stretchToU8(frame.data, loaded.range, stretch, adjust),
        frame.meta.width,
        frame.meta.height,
      ),
    );
  }, [loaded, stretch, adjust]);
}
