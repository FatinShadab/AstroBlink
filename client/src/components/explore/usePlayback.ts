"use client";

import { useEffect, useRef } from "react";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";

/** Hard cap from rules §3.2 and design §10: never more than 2 frame changes per second. */
export const MAX_FPS = 2;

/**
 * Steps the frame index while playing. Pauses when the tab is hidden and resumes when it returns.
 * Only the index changes here; the URL `f` is written by the caller on pause or step, never during autoplay.
 */
export function usePlayback(opts: { count: number; fps: number; onTick: () => void }) {
  const { count, fps, onTick } = opts;
  const playing = useViewerUiStore((s) => s.playing);
  const setPlaying = useViewerUiStore((s) => s.setPlaying);
  const resumeWhenVisible = useRef(false);
  const tickRef = useRef(onTick);

  useEffect(() => {
    tickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    if (!playing || count < 2) return;
    const intervalMs = Math.max(1000 / MAX_FPS, 1000 / Math.min(fps, MAX_FPS));
    const id = window.setInterval(() => tickRef.current(), intervalMs);
    return () => window.clearInterval(id);
  }, [playing, count, fps]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) {
        resumeWhenVisible.current = useViewerUiStore.getState().playing;
        setPlaying(false);
      } else if (resumeWhenVisible.current) {
        resumeWhenVisible.current = false;
        setPlaying(true);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [setPlaying]);
}
