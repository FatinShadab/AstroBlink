"use client";

import { useMemo } from "react";
import type { LoadedField } from "@/lib/data/useFieldFrames";
import type { ViewMode } from "@/lib/data/types";
import { difference, meanStack } from "@/lib/sky/imageMath";
import {
  diffToRgba,
  differenceScale,
  flagOverlayRgba,
  mergeRgba,
  type DiffStyle,
  type RGB,
} from "@/lib/sky/modes";
import { fillEnclosedNaN } from "@/lib/sky/fill";
import { makeFrameCanvas, makeRgbaCanvas } from "@/lib/sky/render";
import { percentileRange, stretchToU8, type Adjust, type StretchKind } from "@/lib/sky/stretch";

export interface ModeInputs {
  loaded: LoadedField | null;
  mode: ViewMode;
  /** Compare frames A and B (indices). */
  a: number;
  b: number;
  /** Stack selection; empty means all frames. */
  stackIds: number[];
  diffStyle: DiffStyle;
  colourblind: boolean;
  stretch: StretchKind;
  adjust: Adjust;
  showFlags: boolean;
}

export interface ModeCanvases {
  /** What the viewer shows: one canvas per frame in Blink, otherwise one or two views. */
  views: HTMLCanvasElement[];
  /** Glitch-flag overlays, one per frame, or empty when flags are off. */
  flags: HTMLCanvasElement[];
}

function cssRgb(name: string, fallback: string): RGB {
  const value =
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value);
  if (!m) return [255, 255, 255];
  return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
}

/**
 * Turns loaded frames into the canvases for the current view mode (design §10):
 * blink frames, side-by-side pair, RGB merge, difference, or stack. Uses Float32 data for
 * difference and stack, and a single clip range per field so frames stay comparable.
 */
export function useModeCanvases(inputs: ModeInputs): ModeCanvases {
  const { loaded, mode, a, b, stackIds, diffStyle, colourblind, stretch, adjust, showFlags } =
    inputs;

  const flags = useMemo(() => {
    if (!loaded || !showFlags) return [];
    return loaded.frames.map((frame) =>
      makeRgbaCanvas(
        flagOverlayRgba(
          frame.flags,
          frame.meta.width,
          frame.meta.height,
          cssRgb("--data-6", "#cc79a7"),
        ),
        frame.meta.width,
        frame.meta.height,
      ),
    );
  }, [loaded, showFlags]);

  const views = useMemo<HTMLCanvasElement[]>(() => {
    if (!loaded || loaded.frames.length === 0) return [];
    const { frames, range } = loaded;
    const n = frames.length;
    const { width, height } = frames[0].meta;
    // Display copies with saturated (NaN) star cores filled; photometry elsewhere uses the raw data.
    const shown = frames.map((f) => fillEnclosedNaN(f.data, f.meta.width, f.meta.height));
    const grey = (i: number) => stretchToU8(shown[i], range, stretch, adjust);
    const clampIndex = (i: number) => Math.min(n - 1, Math.max(0, i));

    switch (mode) {
      case "blink":
        return []; // Blink frames are built by useFrameCanvases in the viewer

      case "side":
        return [clampIndex(a), clampIndex(b)].map((i) => makeFrameCanvas(grey(i), width, height));

      case "merge": {
        // Default: first, middle and last visit → red, green, blue. Colour-blind: first → magenta, last → green.
        const first = 0;
        const middle = Math.floor(n / 2);
        const last = n - 1;
        const red = grey(first);
        const green = grey(colourblind ? last : middle);
        const blue = colourblind ? grey(first) : grey(last);
        return [makeRgbaCanvas(mergeRgba(red, green, blue), width, height)];
      }

      case "diff": {
        const diff = difference(shown[clampIndex(b)], shown[clampIndex(a)]);
        const scale = differenceScale(diff);
        const pos = cssRgb("--data-2", "#e69f00");
        const neg = cssRgb("--data-1", "#56b4e9");
        return [makeRgbaCanvas(diffToRgba(diff, diffStyle, scale, pos, neg), width, height)];
      }

      case "stack": {
        const ids = stackIds.length > 0 ? stackIds.filter((i) => i < n) : frames.map((_, i) => i);
        const mean = meanStack(ids.map((i) => shown[i]));
        const stackRange = percentileRange([mean]);
        return [makeFrameCanvas(stretchToU8(mean, stackRange, stretch, adjust), width, height)];
      }
    }
  }, [loaded, mode, a, b, stackIds, diffStyle, colourblind, stretch, adjust]);

  return { views, flags };
}
