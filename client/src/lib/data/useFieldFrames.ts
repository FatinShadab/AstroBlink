"use client";

import { useCallback, useEffect, useState } from "react";
import { percentileRange, type ClipRange } from "@/lib/sky/stretch";
import { providerFor, type DataChoice } from "./provider";
import { fieldIdFor } from "./synthetic/generateField";
import type { FieldData, FrameMeta, SkyTarget } from "./types";

export interface LoadedFrame {
  meta: FrameMeta;
  data: Float32Array;
  flags: Uint8Array;
}

/** Every frame of a field, loaded before playback starts (rules §4.6.3). */
export interface LoadedField {
  field: FieldData;
  frames: LoadedFrame[];
  /** One clip range for all frames, so blinking never shows fake brightness changes (architecture §8). */
  range: ClipRange;
}

export type FieldLoad =
  | { status: "idle" }
  | { status: "loading"; loaded: number; total: number }
  | { status: "ready"; data: LoadedField }
  | { status: "error"; message: string };

const CACHE_LIMIT = 6;
/** In-memory cache of finished fields, keyed by field id. Read only inside effects. */
const cache = new Map<string, LoadedField>();

function remember(key: string, value: LoadedField) {
  cache.delete(key);
  cache.set(key, value);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

interface Result {
  key: string;
  load: FieldLoad;
}

/**
 * Loads a field and all its frames. Progress and results live in React state.
 * Reading the module cache during render would be memoised by the React Compiler
 * and go stale, so the cache is only read and written inside effects.
 */
export function useFieldFrames(
  target: SkyTarget | null,
  choice: DataChoice = "sky",
): { load: FieldLoad; retry: () => void } {
  // The data choice is part of the key, so a real and a synthetic field at the same spot never share a cache entry.
  const key = target ? `${choice}:${fieldIdFor(target)}` : null;
  const [result, setResult] = useState<Result>({ key: "", load: { status: "idle" } });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!target || !key) return;
    const controller = new AbortController();
    const provider = providerFor(choice);

    (async () => {
      const hit = cache.get(key);
      if (hit) {
        setResult({ key, load: { status: "ready", data: hit } });
        return;
      }
      try {
        const field = await provider.getField(target, controller.signal);
        const total = field.frames.length;
        setResult({ key, load: { status: "loading", loaded: 0, total } });
        let loaded = 0;
        const frames = await Promise.all(
          field.frames.map(async (meta) => {
            const px = await provider.getFramePixels(meta, controller.signal);
            loaded++;
            setResult({ key, load: { status: "loading", loaded, total } });
            return { meta, data: px.data, flags: px.flags ?? new Uint8Array(px.data.length) };
          }),
        );
        if (controller.signal.aborted) return;
        const range = percentileRange(frames.map((f) => f.data));
        const data: LoadedField = { field, frames, range };
        remember(key, data);
        setResult({ key, load: { status: "ready", data } });
      } catch (error) {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : "Unknown error";
        setResult({ key, load: { status: "error", message } });
      }
    })();

    return () => controller.abort();
  }, [target, key, attempt, choice]);

  const retry = useCallback(() => {
    setResult({ key: "", load: { status: "idle" } });
    setAttempt((n) => n + 1);
  }, []);

  if (!key) return { load: { status: "idle" }, retry };
  if (result.key === key) return { load: result.load, retry };
  return { load: { status: "loading", loaded: 0, total: 0 }, retry };
}
