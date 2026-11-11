"use client";

import { useMemo } from "react";
import type { LoadedField } from "@/lib/data/useFieldFrames";
import { stretchToU8, type StretchKind } from "@/lib/sky/stretch";
import { makeFrameCanvas } from "@/lib/sky/render";

/**
 * One canvas per frame at native size, all using the field-wide clip range so frames share a scale.
 * Rebuilt only when the field or the stretch changes (architecture §8).
 */
export function useFrameCanvases(
  loaded: LoadedField | null,
  stretch: StretchKind,
): HTMLCanvasElement[] {
  return useMemo(() => {
    if (!loaded) return [];
    return loaded.frames.map((frame) =>
      makeFrameCanvas(
        stretchToU8(frame.data, loaded.range, stretch),
        frame.meta.width,
        frame.meta.height,
      ),
    );
  }, [loaded, stretch]);
}
