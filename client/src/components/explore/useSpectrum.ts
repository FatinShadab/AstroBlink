"use client";

import { useEffect, useState } from "react";
import { getProvider } from "@/lib/data/provider";
import type { SkyTarget, SpectrumPoint } from "@/lib/data/types";

interface SpectrumState {
  key: string;
  points: SpectrumPoint[] | null;
  error: string | null;
}

/** Spectrum for a clicked pixel. Recomputed when the target or the pixel changes. */
export function useSpectrum(
  target: SkyTarget | null,
  pick: { x: number; y: number } | null,
): { points: SpectrumPoint[] | null; loading: boolean; error: string | null } {
  const key =
    target && pick
      ? `${target.raDeg}|${target.decDeg}|${target.fovArcmin}|${target.detector}|${pick.x}|${pick.y}`
      : null;
  const [state, setState] = useState<SpectrumState>({ key: "", points: null, error: null });

  useEffect(() => {
    if (!target || !pick || !key) return;
    const controller = new AbortController();
    (async () => {
      try {
        const points = await getProvider().getSpectrum(target, pick, controller.signal);
        if (!controller.signal.aborted) setState({ key, points, error: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ key, points: null, error: error instanceof Error ? error.message : "error" });
      }
    })();
    return () => controller.abort();
    // target/pick are compared through `key`, so object identity does not matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!key) return { points: null, loading: false, error: null };
  if (state.key !== key) return { points: null, loading: true, error: null };
  return { points: state.points, loading: false, error: state.error };
}
