"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryStates } from "nuqs";
import { PlayerBar } from "@/components/explore/PlayerBar";
import { SkyViewer } from "@/components/explore/SkyViewer";
import { useFrameCanvases } from "@/components/explore/useFrameCanvases";
import { usePlayback } from "@/components/explore/usePlayback";
import { Logo } from "@/components/layout/Logo";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";
import { useFieldFrames } from "@/lib/data/useFieldFrames";
import type { Detector, SkyTarget } from "@/lib/data/types";
import { fill } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import { NO_ADJUST, type StretchKind } from "@/lib/sky/stretch";
import { useUserStore } from "@/lib/state/useUserStore";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";
import { resolveTarget, viewerParsers } from "@/lib/state/viewerParams";

/**
 * Embed view (design §8.12): viewer and player only, in a 600×400 frame. Reads the same URL
 * parameters as /explore and links back to it with those parameters.
 */
export function EmbedView() {
  const { t } = useT();
  const [params] = useQueryStates(viewerParsers, { history: "replace", shallow: true });
  const resolved = resolveTarget(params);
  const raDeg = resolved.ok ? resolved.target.raDeg : null;
  const decDeg = resolved.ok ? resolved.target.decDeg : null;
  const fov = resolved.ok ? resolved.target.fovArcmin : (params.fov ?? 5);
  const detector: Detector = resolved.ok ? resolved.target.detector : (params.det ?? "D2");
  const targetKey =
    raDeg === null || decDeg === null ? null : `${raDeg}|${decDeg}|${fov}|${detector}`;
  const target = useMemo<SkyTarget | null>(() => {
    if (targetKey === null) return null;
    const [ra, dec, f, d] = targetKey.split("|");
    return {
      raDeg: Number(ra),
      decDeg: Number(dec),
      fovArcmin: Number(f),
      detector: d as Detector,
    };
  }, [targetKey]);

  const { load } = useFieldFrames(target);
  const loaded = load.status === "ready" ? load.data : null;
  const count = loaded?.frames.length ?? 0;
  const canvases = useFrameCanvases(loaded, params.st as StretchKind, NO_ADJUST);
  const [index, setIndex] = useState(() => params.f ?? 0);
  const current = count > 0 ? Math.min(index, count - 1) : 0;

  const reducedMotion = useReducedMotion();
  const fps = useUserStore((s) => s.settings.blinkFps);
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
    if (count >= 2 && !autoStarted.current) {
      autoStarted.current = true;
      setPlaying(true);
    }
  }, [count, reducedMotion, setPlaying]);

  const frames = loaded?.frames.map((f) => f.meta) ?? [];
  const link = `/explore${typeof window === "undefined" ? "" : window.location.search}`;

  return (
    <div className="flex h-full min-h-screen flex-col bg-bg text-text-primary">
      <div className="flex h-10 items-center justify-between gap-2 border-b border-border bg-surface-1 px-3">
        <Logo height={22} alt={t("brand.mark")} />
        <Link
          href={link}
          target="_blank"
          rel="noreferrer"
          className="rounded-[var(--radius-sm)] text-body-sm font-medium text-primary hover:underline"
        >
          {t("embed.openInApp")}
        </Link>
      </div>

      <SkyViewer
        frames={canvases}
        index={current}
        zoom={zoom}
        panX={panX}
        panY={panY}
        reducedMotion={reducedMotion}
        simulated={loaded?.field.isSimulated ?? true}
        simulatedLabel={t("common.simulatedSky")}
        ariaLabel={fill(t("explore.viewerLabel"), {
          description: count ? `${current + 1} / ${count}` : "",
        })}
        frameCounter={count ? `${current + 1} / ${count}` : "–"}
        zoomLabel={`${Math.round(zoom * 100)}%`}
        onPan={pan}
        onKeyDown={() => undefined}
        className="h-[280px] md:h-[300px]"
      >
        {load.status === "loading" && (
          <div className="absolute inset-0 grid place-items-center">
            <p className="text-body-sm text-text-secondary">{t("common.loading")}</p>
          </div>
        )}
      </SkyViewer>

      {count > 0 && (
        <PlayerBar
          frames={frames}
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
