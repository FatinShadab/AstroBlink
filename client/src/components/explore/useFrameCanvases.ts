"use client";

import { useMemo } from "react";
import type { LoadedField } from "@/lib/data/useFieldFrames";
import { fillEnclosedNaN } from "@/lib/sky/fill";
import { makeFrameCanvas } from "@/lib/sky/render";
import { stretchToU8, type Adjust, type ClipRange, type StretchKind } from "@/lib/sky/stretch";

/**
 * One canvas per frame at native size, all using the field-wide clip range so frames share a scale.
 * Rebuilt only when the field, the stretch or the Image-tab adjustments change (architecture §8).
 * `rangeOverride` replaces the field's clip range (the contributor viewer's softer display).
 */
export function useFrameCanvases(
  loaded: LoadedField | null,
  stretch: StretchKind,
  adjust: Adjust,
  rangeOverride?: ClipRange | null,
): HTMLCanvasElement[] {
  return useMemo(() => {
    if (!loaded) return [];
    const range = rangeOverride ?? loaded.range;
    // Saturated (NaN) star cores are filled for display only, so bright stars look solid.
    return loaded.frames.map((frame) =>
      makeFrameCanvas(
        stretchToU8(
          fillEnclosedNaN(frame.data, frame.meta.width, frame.meta.height),
          range,
          stretch,
          adjust,
        ),
        frame.meta.width,
        frame.meta.height,
      ),
    );
  }, [loaded, stretch, adjust, rangeOverride]);
}
