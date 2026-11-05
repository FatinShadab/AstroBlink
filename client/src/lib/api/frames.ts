/**
 * Frame loading for the blink comparator.
 *
 * Two sources share one interface:
 *  - Procedural frames from the mock engine (when the subject has no tile URLs).
 *  - Real PNG tiles from the backend (`subject.tile_urls["<epoch>_<band>"]`),
 *    decoded to 128×128 luminance so the same pixel pipeline applies.
 */

import type { SubjectResponse } from "./generated/types";
import { api } from "./client";
import type { ViewParams } from "./mockService";
import { FRAME_SIZE, type BandKey, type Frame } from "@/lib/mock/spherexMockEngine";

export type FrameLoader = (epochIndex: number, band: BandKey) => Promise<Frame | null>;

const CACHE_LIMIT = 96;

/** Small LRU-style cache around any loader, keyed by epoch and band. */
function cached(loader: FrameLoader): FrameLoader {
  const store = new Map<string, Promise<Frame | null>>();
  return (epochIndex, band) => {
    const key = `${epochIndex}|${band}`;
    const hit = store.get(key);
    if (hit) {
      // Refresh recency.
      store.delete(key);
      store.set(key, hit);
      return hit;
    }
    const pending = loader(epochIndex, band).catch((err: unknown) => {
      store.delete(key);
      throw err;
    });
    store.set(key, pending);
    if (store.size > CACHE_LIMIT) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
    return pending;
  };
}

/** Procedural loader for mock mode. */
export function createProceduralLoader(p: ViewParams): FrameLoader {
  return cached((epochIndex, band) => api.getFrame(p, epochIndex, band));
}

/** Decodes a PNG/JPEG tile to a 128×128 luminance field (0–255 scale). */
export function loadTileFrame(url: string): Promise<Frame> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = FRAME_SIZE;
        canvas.height = FRAME_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, FRAME_SIZE, FRAME_SIZE);
        const rgba = ctx.getImageData(0, 0, FRAME_SIZE, FRAME_SIZE).data;
        const n = FRAME_SIZE * FRAME_SIZE;
        const data = new Float32Array(n);
        for (let i = 0; i < n; i++) {
          const o = i * 4;
          data[i] = 0.2126 * rgba[o] + 0.7152 * rgba[o + 1] + 0.0722 * rgba[o + 2];
        }
        resolve({ size: FRAME_SIZE, data, mask: new Uint8Array(n), sigma: 1 });
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Tile decode failed"));
      }
    };
    img.onerror = () => reject(new Error(`Tile failed to load: ${url}`));
    img.src = url;
  });
}

/** Loader that reads backend tiles keyed `${epoch}_${band}`; missing tiles resolve to null. */
export function createTileLoader(subject: SubjectResponse): FrameLoader {
  return cached(async (epochIndex, band) => {
    const epoch = subject.epochs[epochIndex];
    const url = subject.tile_urls[`${epoch}_${band}`];
    if (!url) return null;
    return loadTileFrame(url);
  });
}

/** Picks the loader for a subject: real tiles when the backend supplied them, otherwise procedural. */
export function createFrameLoader(subject: SubjectResponse | null, p: ViewParams): FrameLoader {
  if (subject && Object.keys(subject.tile_urls).length > 0) return createTileLoader(subject);
  return createProceduralLoader(p);
}
