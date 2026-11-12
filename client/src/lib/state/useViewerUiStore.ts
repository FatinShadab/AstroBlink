"use client";

import { create } from "zustand";

/** Ephemeral viewer state: zoom, pan, play state, Image-tab adjustments. Not persisted (architecture §7.2). */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 16;

export interface ViewerUiState {
  zoom: number;
  panX: number; // screen pixels
  panY: number;
  playing: boolean;
  brightness: number; // −0.5 … 0.5
  contrast: number; // 0.25 … 3
  /** Frame indices included in Stack mode (Compare tab). Empty means all frames. */
  stackIds: number[];
  /** Pixel the user clicked for the spectrum (image coordinates), or null. */
  pick: { x: number; y: number } | null;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  pan: (dx: number, dy: number) => void;
  fit: () => void;
  setPlaying: (playing: boolean) => void;
  setBrightness: (value: number) => void;
  setContrast: (value: number) => void;
  toggleStackId: (index: number) => void;
  setPick: (pick: { x: number; y: number } | null) => void;
  resetAdjust: () => void;
}

export const useViewerUiStore = create<ViewerUiState>()((set) => ({
  zoom: MIN_ZOOM,
  panX: 0,
  panY: 0,
  playing: false,
  brightness: 0,
  contrast: 1,
  stackIds: [],
  pick: null,
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  zoomBy: (factor) =>
    set((s) => ({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom * factor)) })),
  pan: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),
  fit: () => set({ zoom: MIN_ZOOM, panX: 0, panY: 0 }),
  setPlaying: (playing) => set({ playing }),
  setBrightness: (brightness) => set({ brightness }),
  setContrast: (contrast) => set({ contrast }),
  toggleStackId: (index) =>
    set((s) => ({
      stackIds: s.stackIds.includes(index)
        ? s.stackIds.filter((i) => i !== index)
        : [...s.stackIds, index].sort((a, b) => a - b),
    })),
  setPick: (pick) => set({ pick }),
  resetAdjust: () => set({ brightness: 0, contrast: 1 }),
}));
