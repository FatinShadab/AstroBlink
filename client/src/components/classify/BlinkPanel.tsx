"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AdvancedSidePanel } from "@/components/explore/AdvancedSidePanel";
import { PlayerBar } from "@/components/explore/PlayerBar";
import { SkyViewer } from "@/components/explore/SkyViewer";
import { useFrameCanvases } from "@/components/explore/useFrameCanvases";
import { usePlayback } from "@/components/explore/usePlayback";
import { useSpectrum } from "@/components/explore/useSpectrum";
import { Skeleton } from "@/components/ui/Surfaces";
import { useToast } from "@/components/ui/Toast";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";
import { useFieldFrames } from "@/lib/data/useFieldFrames";
import type { SkyTarget, StretchKind } from "@/lib/data/types";
import { downloadCanvasPng, embedSnippet } from "@/lib/sky/export";
import { fill, formatDate } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { countFlagged, flagOverlayRgba } from "@/lib/sky/modes";
import { makeRgbaCanvas } from "@/lib/sky/render";
import { NO_ADJUST, percentileRange } from "@/lib/sky/stretch";
import { useUserStore, type BlinkFps } from "@/lib/state/useUserStore";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";
import { cn } from "@/lib/utils";

/** Tools that work on the contributor pages. Compare, stack and difference need the explore page's views. */
const CONTRIBUTE_TABS = ["image", "flags", "spectrum", "overlays", "share"];
const noop = () => undefined;

/**
 * A blink viewer for the training and classify flows. With `advanced`, the viewer takes about 70% of
 * the width and the advanced features sit beside it in the other 30% (stretch, brightness/contrast,
 * glitch flags, spectrum, sharing), so changes show live. Autoplays once frames are ready, unless
 * reduced motion is on (rules §3.3).
 */
export function BlinkPanel({
  target,
  showPlayer = true,
  fps: fpsOverride,
  autoplay = true,
  label,
  advanced = false,
  actions,
  glitches = false,
}: {
  target: SkyTarget;
  showPlayer?: boolean;
  /** Overrides the user's blink speed (the landing demo is slower). */
  fps?: BlinkFps;
  autoplay?: boolean;
  /** Replaces the default viewer label, e.g. "Simulated example". */
  label?: string;
  /** Shows the advanced features beside the viewer. */
  advanced?: boolean;
  /** Answer buttons and confirm, kept in view next to the media (with `advanced`). */
  actions?: React.ReactNode;
  /** Simulated cosmic-ray hits in the field: only Glitch patrol (and demos of glitches) use them. */
  glitches?: boolean;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const toast = useToast();
  // Classify and train stay on the labelled synthetic sky: their answers come from the synthetic model.
  const { load } = useFieldFrames(target, glitches ? "synthetic-glitches" : "synthetic");
  const loaded = load.status === "ready" ? load.data : null;
  const frames = useMemo(() => loaded?.frames ?? [], [loaded]);
  const count = frames.length;

  // Softer default than Explore: a log stretch from the sky level (median, so noise stays dark) up to the
  // brightest pixel, so bright stars keep a core with a falloff instead of clipping to flat white
  // squares. The Image tab can still change the stretch.
  const [stretch, setStretch] = useState<StretchKind>("log");
  const softRange = useMemo(
    () => (loaded ? percentileRange(loaded.frames.map((f) => f.data), 50, 100) : null),
    [loaded],
  );
  const [showFlags, setShowFlags] = useState(false);
  const brightness = useViewerUiStore((s) => s.brightness);
  const contrast = useViewerUiStore((s) => s.contrast);
  const adjust = useMemo(
    () => (brightness === 0 && contrast === 1 ? NO_ADJUST : { brightness, contrast }),
    [brightness, contrast],
  );
  const canvases = useFrameCanvases(loaded, stretch, adjust, softRange);
  const flagCanvases = useMemo(() => {
    if (!loaded || !showFlags) return [];
    return loaded.frames.map((f) =>
      makeRgbaCanvas(
        flagOverlayRgba(f.flags, f.meta.width, f.meta.height, [204, 121, 167]),
        f.meta.width,
        f.meta.height,
      ),
    );
  }, [loaded, showFlags]);

  const [index, setIndex] = useState(0);
  const current = count > 0 ? Math.min(index, count - 1) : 0;

  const reducedMotion = useReducedMotion();
  const storeFps = useUserStore((s) => s.settings.blinkFps);
  const setBlinkFps = useUserStore((s) => s.setBlinkFps);
  const fps = fpsOverride ?? storeFps;
  const playing = useViewerUiStore((s) => s.playing);
  const setPlaying = useViewerUiStore((s) => s.setPlaying);
  const zoom = useViewerUiStore((s) => s.zoom);
  const panX = useViewerUiStore((s) => s.panX);
  const panY = useViewerUiStore((s) => s.panY);
  const pan = useViewerUiStore((s) => s.pan);
  const pick = useViewerUiStore((s) => s.pick);
  const setPick = useViewerUiStore((s) => s.setPick);
  const spectrum = useSpectrum(target, pick, "synthetic");

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

  // Links for the advanced tools: the explore page with this field.
  const search = `?ra=${target.raDeg}&dec=${target.decDeg}&fov=${target.fovArcmin}&det=${target.detector}`;
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const goToDetector = (det: SkyTarget["detector"]) =>
    router.push(
      `/explore?ra=${target.raDeg}&dec=${target.decDeg}&fov=${target.fovArcmin}&det=${det}`,
    );
  const copy = async (text: string, doneKey: DictKey) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t(doneKey) });
    } catch {
      toast({ title: t("explore.linkFailed") });
    }
  };

  const description =
    count > 0
      ? fill(t("explore.describe"), {
          index: current + 1,
          total: count,
          date: formatDate(frames[current].meta.obsDate, lang),
          det: target.detector,
        })
      : t("common.loading");

  const viewer = (
    <div className="flex min-w-0 flex-col">
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
          flags={showFlags ? (flagCanvases[current] ?? null) : null}
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
          onPick={(x, y) => setPick({ x, y })}
          onKeyDown={() => undefined}
          className="h-[min(50vh,560px)] lg:h-[min(60vh,640px)]"
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

  if (!advanced) return viewer;

  return (
    <div className={cn("grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start")}>
      {viewer}
      {/*
        Answers and the confirm button stay in view while the media plays: on wide screens they sit at the
        top of the sticky right column; on narrow screens (where the column is "contents") they are a bar
        stuck to the bottom of the screen until the viewer has scrolled past.
      */}
      <aside
        aria-label={t("classify.answerArea")}
        className="contents lg:sticky lg:top-20 lg:flex lg:max-h-[calc(100vh-6rem)] lg:min-w-0 lg:flex-col lg:gap-6 lg:self-start lg:overflow-y-auto lg:overscroll-contain"
      >
        {actions && (
          <div className="sticky bottom-0 z-20 -mx-4 border-t border-border bg-surface-1/95 px-4 py-3 backdrop-blur-[12px] sm:-mx-6 sm:px-6 lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
            {actions}
          </div>
        )}
        <div className="min-w-0">
        <AdvancedSidePanel
          tabs={CONTRIBUTE_TABS}
          detector={target.detector}
          onDetector={goToDetector}
          stretch={stretch}
          onStretch={setStretch}
          frameLabels={[]}
          a={0}
          b={0}
          onA={noop}
          onB={noop}
          diffStyle="grey"
          onDiffStyle={noop}
          showFlags={showFlags}
          onShowFlags={setShowFlags}
          flagCount={loaded && frames[current] ? countFlagged(frames[current].flags) : 0}
          spectrum={spectrum}
          pick={pick}
          shareUrl={`${origin}/explore${search}`}
          embedSnippet={embedSnippet(origin, search)}
          onCopy={(text, doneKey) => void copy(text, doneKey)}
          onDownloadPng={() => {
            const source = canvases[current];
            if (source) downloadCanvasPng(source, `astroblink-${target.detector}-${current + 1}.png`);
          }}
        />
        </div>
      </aside>
    </div>
  );
}
