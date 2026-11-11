"use client";

import { create } from "zustand";

/** Ephemeral viewer state: zoom, pan, play state. Not persisted (architecture §7.2). */
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 16;

export interface ViewerUiState {
  zoom: number;
  panX: number; // in source-pixel units
  panY: number;
  playing: boolean;
  setZoom: (zoom: number) => void;
  zoomBy: (factor: number) => void;
  pan: (dx: number, dy: number) => void;
  fit: () => void;
  setPlaying: (playing: boolean) => void;
}

export const useViewerUiStore = create<ViewerUiState>()((set) => ({
  zoom: MIN_ZOOM,
  panX: 0,
  panY: 0,
  playing: false,
  setZoom: (zoom) => set({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom)) }),
  zoomBy: (factor) =>
    set((s) => ({ zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.zoom * factor)) })),
  pan: (dx, dy) => set((s) => ({ panX: s.panX + dx, panY: s.panY + dy })),
  fit: () => set({ zoom: MIN_ZOOM, panX: 0, panY: 0 }),
  setPlaying: (playing) => set({ playing }),
}));
