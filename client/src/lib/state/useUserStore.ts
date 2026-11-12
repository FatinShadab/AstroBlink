"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Answer } from "@/lib/data/types";

/** Persisted user state (architecture §7.3). Key namespace per rules §5.1. */
export const USER_STORE_KEY = "astroblink:v1";
export const USER_STORE_VERSION = 1;

export type BlinkFps = 0.5 | 1 | 2;

export interface UserProfile {
  name: string;
  email: string;
  createdAt: string;
}

export interface UserSettings {
  reducedMotion: boolean;
  blinkFps: BlinkFps;
  colorblindMerge: boolean;
  advancedOpen: boolean;
}

export interface Classification {
  id: string;
  projectSlug: string;
  fieldId: string;
  answer: Answer;
  flaggedInteresting: boolean;
  isTraining: boolean;
  /** Whether the answer matched the known truth (training only). */
  correct?: boolean;
  /** Whether the answer matched the demo community answer (classify only; shown as demo data). */
  agrees?: boolean;
  createdAt: string;
}

export interface BatchState {
  projectSlug: string;
  offset: number;
  index: number;
  size: 10;
}

export const DEFAULT_SETTINGS: UserSettings = {
  reducedMotion: false,
  blinkFps: 1,
  colorblindMerge: false,
  advancedOpen: false,
};

export interface UserState {
  user: UserProfile | null;
  settings: UserSettings;
  classifications: Classification[];
  trainingDone: Record<string, boolean>;
  batch: BatchState | null;

  setReducedMotion: (on: boolean) => void;
  setBlinkFps: (fps: BlinkFps) => void;
  setColorblindMerge: (on: boolean) => void;
  setAdvancedOpen: (open: boolean) => void;
  addClassification: (c: Classification) => void;
  setBatch: (batch: BatchState | null) => void;
  markTrainingDone: (slug: string) => void;
  signIn: (profile: UserProfile) => void;
  signOut: () => void;
  clearMyData: () => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      settings: DEFAULT_SETTINGS,
      classifications: [],
      trainingDone: {},
      batch: null,

      setReducedMotion: (reducedMotion) =>
        set((s) => ({ settings: { ...s.settings, reducedMotion } })),
      setBlinkFps: (blinkFps) => set((s) => ({ settings: { ...s.settings, blinkFps } })),
      setColorblindMerge: (colorblindMerge) =>
        set((s) => ({ settings: { ...s.settings, colorblindMerge } })),
      setAdvancedOpen: (advancedOpen) =>
        set((s) => ({ settings: { ...s.settings, advancedOpen } })),
      addClassification: (c) => set((s) => ({ classifications: [...s.classifications, c] })),
      setBatch: (batch) => set({ batch }),
      markTrainingDone: (slug) =>
        set((s) => ({ trainingDone: { ...s.trainingDone, [slug]: true } })),
      // Mock sign-in: stored in this browser only (rules §5.1). Classifications are kept.
      signIn: (user) => set({ user }),
      signOut: () => set({ user: null }),
      // "Clear my data" removes everything the user did in this browser, but not their settings.
      clearMyData: () => set({ classifications: [], trainingDone: {}, batch: null, user: null }),
    }),
    {
      name: USER_STORE_KEY,
      version: USER_STORE_VERSION,
      storage: createJSONStorage(() => localStorage),
      // Rules §5.4: write a migrate() here whenever the persisted shape changes.
      migrate: (persisted) => persisted as UserState,
    },
  ),
);
