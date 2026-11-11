"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQueryStates } from "nuqs";
import { Button } from "@/components/ui/Button";
import { Banner, Card, EmptyState, Skeleton } from "@/components/ui/Surfaces";
import { useToast } from "@/components/ui/Toast";
import type { PresetId } from "@/data/presets";
import { useFieldFrames } from "@/lib/data/useFieldFrames";
import type { Detector, SkyTarget, ViewMode } from "@/lib/data/types";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";
import { fill, formatDate } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { useUserStore } from "@/lib/state/useUserStore";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";
import { resolveTarget, viewerParsers, type ViewerParams } from "@/lib/state/viewerParams";
import { useFrameCanvases } from "./useFrameCanvases";
import { usePlayback } from "./usePlayback";
import { FrameMetaStrip } from "./FrameMetaStrip";
import { ObjectCard } from "./ObjectCard";
import { PlayerBar } from "./PlayerBar";
import { PresetChips } from "./PresetChips";
import { SearchPanel } from "./SearchPanel";
import { SkyViewer } from "./SkyViewer";
import { ViewerToolbar } from "./ViewerToolbar";

const ERROR_KEY: Partial<Record<string, DictKey>> = {
  "ra-range": "explore.err.ra-range",
  "dec-range": "explore.err.dec-range",
  "bad-fov": "explore.err.format",
};

/**
 * The Explore page (design §8.2). URL state is the source of truth; this component turns it into
 * a field, loads every frame, and plays them. Client-only, because it uses canvas.
 */
export function ExploreView() {
  const { t, lang } = useT();
  const toast = useToast();
  const [params, setParams] = useQueryStates(viewerParsers, { history: "replace", shallow: true });
  const resolved = resolveTarget(params);
  const preset = resolved.preset;

  const raDeg = resolved.ok ? resolved.target.raDeg : null;
  const decDeg = resolved.ok ? resolved.target.decDeg : null;
  const fov = resolved.ok ? resolved.target.fovArcmin : (params.fov ?? 5);
  const detector = resolved.ok ? resolved.target.detector : (params.det ?? "D2");
  // A string key keeps the memo dependency primitive, so the target object is stable.
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

  const { load, retry } = useFieldFrames(target);
  const loaded = load.status === "ready" ? load.data : null;
  const frames = loaded?.frames ?? [];
  const count = frames.length;
  const canvases = useFrameCanvases(loaded, params.st);

  const [index, setIndex] = useState(() => params.f ?? 0);
  const current = count > 0 ? Math.min(index, count - 1) : 0;
  const [announce, setAnnounce] = useState("");

  const reducedMotion = useReducedMotion();
  const fps = useUserStore((s) => s.settings.blinkFps);
  const setBlinkFps = useUserStore((s) => s.setBlinkFps);
  const playing = useViewerUiStore((s) => s.playing);
  const setPlaying = useViewerUiStore((s) => s.setPlaying);
  const zoom = useViewerUiStore((s) => s.zoom);
  const panX = useViewerUiStore((s) => s.panX);
  const panY = useViewerUiStore((s) => s.panY);
  const zoomBy = useViewerUiStore((s) => s.zoomBy);
  const pan = useViewerUiStore((s) => s.pan);
  const fit = useViewerUiStore((s) => s.fit);

  usePlayback({
    count,
    fps,
    onTick: () => setIndex((i) => (count > 0 ? (i + 1) % count : 0)),
  });

  // Autoplay once frames are ready, unless reduced motion is on (rules §3.3). Never during reduced motion.
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

  const describe = (i: number) =>
    frames[i]
      ? fill(t("explore.describe"), {
          index: i + 1,
          total: count,
          date: formatDate(frames[i].meta.obsDate, lang),
          det: detector,
        })
      : "";

  // ---- Actions. Each one that the user takes may write the URL; autoplay never does. ----
  function newTarget(next: Partial<ViewerParams>) {
    setIndex(0);
    setPlaying(false);
    void setParams({ f: null, ...next });
  }

  function commitFrame(i: number) {
    setIndex(i);
    void setParams({ f: i });
    setAnnounce(describe(i));
  }

  function togglePlay() {
    const next = !playing;
    setPlaying(next);
    if (!next && count > 0) void setParams({ f: current });
  }

  function step(delta: number) {
    if (count < 2) return;
    setPlaying(false);
    commitFrame((current + delta + count) % count);
  }

  function onSearch(ra: number, dec: number) {
    newTarget({ ra, dec, preset: null });
  }

  function onPreset(id: PresetId) {
    newTarget({ preset: id, ra: null, dec: null, fov: null, det: null });
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) return; // let buttons inside keep their keys
    switch (event.key) {
      case " ":
        event.preventDefault();
        togglePlay();
        break;
      case "ArrowLeft":
        event.preventDefault();
        step(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        step(1);
        break;
      case "+":
      case "=":
        zoomBy(1.25);
        break;
      case "-":
      case "_":
        zoomBy(0.8);
        break;
      case "0":
        fit();
        break;
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: t("explore.linkCopied") });
    } catch {
      toast({ title: t("explore.linkFailed") });
    }
  }

  // ---- What to show ----
  const failCode = resolved.ok ? null : resolved.code;
  const errorKey = failCode ? ERROR_KEY[failCode] : undefined;
  const pendingName = failCode === "pending-preset" && preset ? preset.name : null;
  const viewerDescription = frames.length ? describe(current) : t("explore.noCoords");
  const showFewFrames = count > 0 && count <= 2;
  const ready = load.status === "ready";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1 font-semibold text-text-primary">{t("explore.title")}</h1>

      <SearchPanel
        raDeg={raDeg}
        decDeg={decDeg}
        fov={fov}
        detector={detector}
        onSearch={onSearch}
        onFov={(value) => newTarget({ fov: value })}
        onDetector={(value) => newTarget({ det: value })}
        shareSlot={
          <Button variant="tertiary" size="sm" onClick={copyLink} className="self-end">
            {t("explore.share")}
          </Button>
        }
      />

      <PresetChips selected={(params.preset as PresetId | null) ?? null} onSelect={onPreset} />

      {errorKey && (
        <Banner tone="danger" icon="⚠">
          {t(errorKey)}
        </Banner>
      )}
      {pendingName && (
        <Banner tone="warning" icon="⚠">
          {fill(t("explore.pendingBanner"), { name: pendingName })}
        </Banner>
      )}
      {showFewFrames && (
        <Banner tone="warning" icon="⚠">
          {fill(t("explore.fewFrames"), { count })}
        </Banner>
      )}
      {load.status === "error" && (
        <Banner
          tone="danger"
          icon="✕"
          action={
            <Button variant="secondary" size="sm" onClick={retry}>
              {t("common.tryAgain")}
            </Button>
          }
        >
          {t("explore.errorBody")}
        </Banner>
      )}
      {reducedMotion && ready && count > 1 && (
        <p className="text-body-sm text-text-muted">{t("explore.reducedMotion")}</p>
      )}

      <ViewerToolbar
        mode={params.mode as ViewMode}
        onMode={(mode) => void setParams({ mode })}
        zoomLabel={fill(t("explore.zoomLevel"), { percent: Math.round(zoom * 100) })}
        onZoomIn={() => zoomBy(1.25)}
        onZoomOut={() => zoomBy(0.8)}
        onFit={fit}
      />

      {!target ? (
        <Card>
          <EmptyState title={t("explore.noCoords")} body={t("explore.noCoordsBody")} />
        </Card>
      ) : (
        <div className="flex flex-col">
          <SkyViewer
            frames={canvases}
            index={current}
            zoom={zoom}
            panX={panX}
            panY={panY}
            reducedMotion={reducedMotion}
            simulated={loaded?.field.isSimulated ?? true}
            simulatedLabel={t("common.simulatedSky")}
            ariaLabel={fill(t("explore.viewerLabel"), { description: viewerDescription })}
            frameCounter={count ? `${current + 1} / ${count}` : "–"}
            zoomLabel={fill(t("explore.zoomLevel"), { percent: Math.round(zoom * 100) })}
            onPan={pan}
            onKeyDown={onKeyDown}
          >
            {load.status === "loading" && (
              <div
                className="absolute inset-0 grid place-items-center bg-viewer-bg/80"
                aria-live="off"
              >
                <div className="flex flex-col items-center gap-3">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <p className="text-body-sm text-text-secondary">
                    {load.total > 0
                      ? fill(t("explore.loadingFrames"), { index: load.loaded, total: load.total })
                      : t("common.loading")}
                  </p>
                </div>
              </div>
            )}
            {ready && count === 0 && (
              <div className="absolute inset-0 grid place-items-center">
                <EmptyState title={t("explore.noData")} body={t("explore.noDataBody")} />
              </div>
            )}
          </SkyViewer>

          {ready && count > 0 && (
            <>
              <PlayerBar
                frames={frames.map((f) => f.meta)}
                index={current}
                playing={playing}
                fps={fps}
                onPrev={() => step(-1)}
                onNext={() => step(1)}
                onTogglePlay={togglePlay}
                onSelect={commitFrame}
                onSpeed={setBlinkFps}
              />
              <FrameMetaStrip
                frame={frames[current]?.meta ?? null}
                detector={detector}
                fovArcmin={fov}
                raDeg={raDeg ?? 0}
                decDeg={decDeg ?? 0}
              />
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-12">
        <div className="md:col-span-4">
          <ObjectCard preset={preset} />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-caption text-text-muted">
        <p>{t("explore.simulatedNote")}</p>
        <p>{t("explore.keys")}</p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
