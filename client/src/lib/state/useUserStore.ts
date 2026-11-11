"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Lang } from "@/lib/i18n/lang";

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
  lang: Lang;
  reducedMotion: boolean;
  blinkFps: BlinkFps;
  colorblindMerge: boolean;
  advancedOpen: boolean;
}

export interface Classification {
  id: string;
  projectSlug: string;
  fieldId: string;
  answer: string;
  flaggedInteresting: boolean;
  isTraining: boolean;
  createdAt: string;
}

export interface BatchState {
  projectSlug: string;
  offset: number;
  index: number;
  size: 10;
}

export const DEFAULT_SETTINGS: UserSettings = {
  lang: "en",
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

  setLang: (lang: Lang) => void;
  setReducedMotion: (on: boolean) => void;
  setBlinkFps: (fps: BlinkFps) => void;
  setColorblindMerge: (on: boolean) => void;
  setAdvancedOpen: (open: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      settings: DEFAULT_SETTINGS,
      classifications: [],
      trainingDone: {},
      batch: null,

      setLang: (lang) => set((s) => ({ settings: { ...s.settings, lang } })),
      setReducedMotion: (reducedMotion) =>
        set((s) => ({ settings: { ...s.settings, reducedMotion } })),
      setBlinkFps: (blinkFps) => set((s) => ({ settings: { ...s.settings, blinkFps } })),
      setColorblindMerge: (colorblindMerge) =>
        set((s) => ({ settings: { ...s.settings, colorblindMerge } })),
      setAdvancedOpen: (advancedOpen) =>
        set((s) => ({ settings: { ...s.settings, advancedOpen } })),
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
