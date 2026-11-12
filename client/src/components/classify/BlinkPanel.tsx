"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { PlayerBar } from "@/components/explore/PlayerBar";
import { SkyViewer } from "@/components/explore/SkyViewer";
import { useFrameCanvases } from "@/components/explore/useFrameCanvases";
import { usePlayback } from "@/components/explore/usePlayback";
import { Skeleton } from "@/components/ui/Surfaces";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";
import { useFieldFrames } from "@/lib/data/useFieldFrames";
import type { SkyTarget } from "@/lib/data/types";
import { fill } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import { NO_ADJUST } from "@/lib/sky/stretch";
import { useUserStore, type BlinkFps } from "@/lib/state/useUserStore";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";

/**
 * A small blink viewer for the training and classify flows: the field, its player and nothing else.
 * Autoplays once frames are ready, unless reduced motion is on (rules §3.3).
 */
export function BlinkPanel({
  target,
  showPlayer = true,
  fps: fpsOverride,
  autoplay = true,
  label,
}: {
  target: SkyTarget;
  showPlayer?: boolean;
  /** Overrides the user's blink speed (the landing demo is slower). */
  fps?: BlinkFps;
  autoplay?: boolean;
  /** Replaces the default viewer label, e.g. "Simulated example". */
  label?: string;
}) {
  const { t } = useT();
  const { load } = useFieldFrames(target);
  const loaded = load.status === "ready" ? load.data : null;
  const frames = useMemo(() => loaded?.frames ?? [], [loaded]);
  const count = frames.length;
  const canvases = useFrameCanvases(loaded, "asinh", NO_ADJUST);
  const [index, setIndex] = useState(0);
  const current = count > 0 ? Math.min(index, count - 1) : 0;

  const reducedMotion = useReducedMotion();
  const storeFps = useUserStore((s) => s.settings.blinkFps);
  const fps = fpsOverride ?? storeFps;
  const setBlinkFps = useUserStore((s) => s.setBlinkFps);
  const playing = useViewerUiStore((s) => s.playing);
  const setPlaying = useViewerUiStore((s) => s.setPlaying);
  const zoom = useViewerUiStore((s) => s.zoom);
  const panX = useViewerUiStore((s) => s.panX);
  const panY = useViewerUiStore((s) => s.panY);
  const pan = useViewerUiStore((s) => s.pan);

  usePlayback({ count, fps, onTick: () => setIndex((i) => (count > 0 ? (i + 1) % count : 0)) });

  const autoStarted = useRef(false);
  useEffect(() => {
    if (reducedMotion) {
      setPlaying(false);
      return;
    }
    if (autoplay && count >= 2 && !autoStarted.current) {
      autoStarted.current = true;
      setPlaying(true);
    }
  }, [autoplay, count, reducedMotion, setPlaying]);

  const description =
    count > 0
      ? fill(t("explore.describe"), {
          index: current + 1,
          total: count,
          date: frames[current].meta.obsDate,
          det: target.detector,
        })
      : t("common.loading");

  return (
    <div className="flex flex-col">
      {load.status === "error" ? (
        <p
          role="alert"
          className="rounded-[var(--radius-md)] bg-danger-subtle p-4 text-body-sm text-danger"
        >
          {t("explore.errorBody")}
        </p>
      ) : (
        <SkyViewer
          frames={canvases}
          index={current}
          zoom={zoom}
          panX={panX}
          panY={panY}
          reducedMotion={reducedMotion}
          simulated={loaded?.field.isSimulated ?? true}
          simulatedLabel={t("common.simulatedSky")}
          ariaLabel={label ?? fill(t("explore.viewerLabel"), { description })}
          frameCounter={count ? `${current + 1} / ${count}` : "–"}
          zoomLabel={`${Math.round(zoom * 100)}%`}
          onPan={pan}
          onKeyDown={() => undefined}
          className="h-[min(60vh,640px)]"
        >
          {load.status === "loading" && count === 0 && (
            <div className="absolute inset-0 grid place-items-center">
              <Skeleton className="size-20 rounded-full" />
            </div>
          )}
        </SkyViewer>
      )}
      {count > 0 && showPlayer && (
        <PlayerBar
          frames={frames.map((f) => f.meta)}
          index={current}
          playing={playing}
          fps={fps}
          onPrev={() => setIndex((current - 1 + count) % count)}
          onNext={() => setIndex((current + 1) % count)}
          onTogglePlay={() => setPlaying(!playing)}
          onSelect={setIndex}
          onSpeed={setBlinkFps}
        />
      )}
    </div>
  );
}
