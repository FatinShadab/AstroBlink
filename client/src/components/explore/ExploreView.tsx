"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import dynamic from "next/dynamic";
import { useQueryStates } from "nuqs";
import { Button } from "@/components/ui/Button";
import { Banner, Card, EmptyState, Skeleton } from "@/components/ui/Surfaces";
import { useToast } from "@/components/ui/Toast";

import Link from "next/link";
import { PRESETS, hasRealData, type PresetId } from "@/data/presets";
import { useFieldFrames } from "@/lib/data/useFieldFrames";
import type { Detector, SkyTarget, StretchKind, ViewMode } from "@/lib/data/types";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";
import { fill, formatDate } from "@/lib/i18n/format";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { countFlagged, type DiffStyle } from "@/lib/sky/modes";
import { centreAperture } from "@/lib/sky/lightCurve";
import { downloadCanvasPng, embedSnippet } from "@/lib/sky/export";
import { useUserStore } from "@/lib/state/useUserStore";
import { useViewerUiStore } from "@/lib/state/useViewerUiStore";
import { resolveTarget, viewerParsers, type ViewerParams } from "@/lib/state/viewerParams";
import { useFrameCanvases } from "./useFrameCanvases";
import { useModeCanvases } from "./useModeCanvases";
import { useSpectrum } from "./useSpectrum";
import { usePlayback } from "./usePlayback";
import { AdvancedSidePanel } from "./AdvancedSidePanel";
import { FrameMetaStrip } from "./FrameMetaStrip";
import { ObjectCard } from "./ObjectCard";
import { PlayerBar } from "./PlayerBar";
import { PresetChips } from "./PresetChips";
import { SearchPanel } from "./SearchPanel";
import { SkyViewer } from "./SkyViewer";
import { ViewerToolbar } from "./ViewerToolbar";

/** Stable placeholder pixel: the real-data spectrum is of the target star, whatever was clicked. */
const TARGET_PIXEL = { x: 0, y: 0 } as const;

const LightCurveChart = dynamic(() => import("./LightCurveChart").then((m) => m.LightCurveChart), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

const ERROR_KEY: Partial<Record<string, DictKey>> = {
  "ra-range": "explore.err.ra-range",
  "dec-range": "explore.err.dec-range",
  "bad-fov": "explore.err.format",
};

const MODE_LABEL: Record<ViewMode, DictKey> = {
  blink: "explore.mode.blink",
  side: "explore.mode.side",
  merge: "explore.mode.merge",
  diff: "explore.mode.diff",
  stack: "explore.mode.stack",
};

/**
 * The Explore page (design §8.2). URL state is the source of truth; this component turns it into
 * a field, loads every frame, and shows it in the chosen view mode. Client-only, because it uses canvas.
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
  const detector: Detector = resolved.ok ? resolved.target.detector : (params.det ?? "D2");
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
  const frames = useMemo(() => loaded?.frames ?? [], [loaded]);
  const count = frames.length;
  const colourblind = useUserStore((s) => s.settings.colorblindMerge);
  const mode = params.mode as ViewMode;
  const a = Math.min(params.a ?? 0, Math.max(0, count - 1));
  const b = Math.min(params.b ?? Math.max(0, count - 1), Math.max(0, count - 1));

  const brightness = useViewerUiStore((s) => s.brightness);
  const contrast = useViewerUiStore((s) => s.contrast);
  const adjust = useMemo(() => ({ brightness, contrast }), [brightness, contrast]);
  const stackIds = useViewerUiStore((s) => s.stackIds);
  const pick = useViewerUiStore((s) => s.pick);
  const setPick = useViewerUiStore((s) => s.setPick);
  const showFlags = params.fl === 1;

  const { views, flags } = useModeCanvases({
    loaded,
    mode,
    a,
    b,
    stackIds,
    diffStyle: params.ds as DiffStyle,
    colourblind,
    stretch: params.st as StretchKind,
    adjust,
    showFlags,
  });
  const blinkCanvases = useFrameCanvases(
    mode === "blink" ? loaded : null,
    params.st as StretchKind,
    adjust,
  );
  const frameCanvases = mode === "blink" ? blinkCanvases : views;

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

  const blinking = mode === "blink" && count > 1;
  usePlayback({
    count: blinking ? count : 0,
    fps,
    onTick: () => setIndex((i) => (count > 0 ? (i + 1) % count : 0)),
  });

  // Autoplay once frames are ready in Blink, unless reduced motion is on (rules §3.3).
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

  // Light curve (design §11). Real data uses the aperture photometry from the data files; a saturated
  // frame has no point (NaN) rather than a guessed value. The simulated sky uses the frame centre.
  // Real data with aperture photometry in its files; older real data without it is measured like the simulated sky.
  const realField = loaded?.field.isSimulated === false && loaded.field.lightCurve ? loaded.field : null;
  const lightPoints = useMemo(
    () =>
      frames.map((f) => {
        if (realField) {
          const p = realField.lightCurve?.find((lc) => lc.frameId === f.meta.id);
          return { obsDate: f.meta.obsDate, flux: p ? p.flux : Number.NaN, fluxErr: p ? p.fluxErr : 0 };
        }
        return { obsDate: f.meta.obsDate, ...centreAperture(f.data, f.meta.width) };
      }),
    [frames, realField],
  );
  // Stars that saturate SPHEREx are measured on their unsaturated outer ring; the captions say so.
  const wingPhotometry = realField?.lightCurve?.some((p) => p.method === "wing") ?? false;

  // Spectrum (design §8.2). Real data has the target star's spectrum, so it loads without a click;
  // the simulated sky gives the clicked pixel's spectrum.
  const realTarget = target !== null && hasRealData(target);
  const spectrum = useSpectrum(target, realTarget ? TARGET_PIXEL : pick);

  // ---- Actions. Each user action may write the URL; autoplay never does. ----
  function newTarget(next: Partial<ViewerParams>) {
    setIndex(0);
    setPlaying(false);
    setPick(null);
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
        if (blinking) togglePlay();
        break;
      case "ArrowLeft":
        event.preventDefault();
        if (blinking) step(-1);
        break;
      case "ArrowRight":
        event.preventDefault();
        if (blinking) step(1);
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

  async function copyText(text: string, doneKey: DictKey) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: t(doneKey) });
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
  const frameLabels = frames.map((f, i) => `${i + 1}. ${formatDate(f.meta.obsDate, lang)}`);
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const search = typeof window === "undefined" ? "" : window.location.search;
  const shownFlags = showFlags && blinking && flags[current] ? flags[current] : null;
  const zoomLabel = fill(t("explore.zoomLevel"), { percent: Math.round(zoom * 100) });
  const frameCounter = count ? `${current + 1} / ${count}` : "–";

  const views2 = (() => {
    if (mode === "side") {
      const left = frameCanvases[0];
      const right = frameCanvases[1];
      return { left, right };
    }
    return null;
  })();

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h1 font-semibold text-text-primary">{t("explore.title")}</h1>

      <SearchPanel
        // Remount when the target changes, so the box shows the chosen preset's coordinates.
        key={`${raDeg ?? ""},${decDeg ?? ""}`}
        raDeg={raDeg}
        decDeg={decDeg}
        fov={fov}
        detector={detector}
        onSearch={onSearch}
        onPreset={onPreset}
        onFov={(value) => newTarget({ fov: value })}
        onDetector={(value) => newTarget({ det: value })}
        shareSlot={
          <Button
            variant="secondary"
            className="shrink-0"
            onClick={() => void copyText(`${origin}/explore${search}`, "explore.linkCopied")}
          >
            {t("explore.copyLink")}
          </Button>
        }
      />

      {/* Highlighted for a chosen preset and for typed coordinates that land on one. */}
      <PresetChips selected={preset?.id ?? null} onSelect={onPreset} />

      {errorKey && (
        <Banner tone="danger" icon="⚠">
          {t(errorKey)}
        </Banner>
      )}
      {target && !hasRealData(target) && (
        <Banner tone="info" icon="ℹ">
          <span>{t("explore.simulatedBanner")} </span>
          <span>{t("explore.realTargets")} </span>
          {PRESETS.map((p, i) => (
            <span key={p.id}>
              <Link
                href={`/explore?preset=${p.id}`}
                className="font-medium text-text-primary underline underline-offset-2"
              >
                {p.name}
              </Link>
              {i < PRESETS.length - 1 ? ", " : "."}
            </span>
          ))}
        </Banner>
      )}
      {pendingName && (
        <Banner tone="warning" icon="⚠">
          {fill(t("explore.pendingBanner"), { name: pendingName })}
        </Banner>
      )}
      {showFewFrames && (
        <p className="text-caption text-text-muted">{fill(t("explore.fewFrames"), { count })}</p>
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
          {/* The specific reason (for example no matching wavelengths on this detector). */}
          <span className="mt-1 block text-caption">{load.message}</span>
        </Banner>
      )}
      {reducedMotion && ready && count > 1 && (
        <p className="text-body-sm text-text-muted">{t("explore.reducedMotion")}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,3fr)] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
      <ViewerToolbar
        mode={mode}
        onMode={(next) => void setParams({ mode: next })}
        zoomLabel={zoomLabel}
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
          {mode === "side" && views2 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {[
                { canvas: views2.left, label: `A · ${frameLabels[a] ?? ""}` },
                { canvas: views2.right, label: `B · ${frameLabels[b] ?? ""}` },
              ].map((pane, i) => (
                <SkyViewer
                  key={i}
                  frames={pane.canvas ? [pane.canvas] : []}
                  index={0}
                  zoom={zoom}
                  panX={panX}
                  panY={panY}
                  reducedMotion={reducedMotion}
                  simulated={loaded?.field.isSimulated ?? true}
                  simulatedLabel={t("common.simulatedSky")}
                  ariaLabel={pane.label}
                  frameCounter={pane.label}
                  zoomLabel={zoomLabel}
                  onPan={pan}
                  onKeyDown={onKeyDown}
                  className="h-[min(50vh,480px)] md:h-[min(60vh,560px)]"
                />
              ))}
            </div>
          ) : (
            <SkyViewer
              frames={frameCanvases}
              index={mode === "blink" ? current : 0}
              flags={shownFlags}
              zoom={zoom}
              panX={panX}
              panY={panY}
              reducedMotion={reducedMotion}
              simulated={loaded?.field.isSimulated ?? true}
              simulatedLabel={t("common.simulatedSky")}
              ariaLabel={
                mode === "blink"
                  ? fill(t("explore.viewerLabel"), { description: viewerDescription })
                  : fill(t("explore.viewerLabel"), { description: t(MODE_LABEL[mode]) })
              }
              frameCounter={mode === "blink" ? frameCounter : t(MODE_LABEL[mode])}
              zoomLabel={zoomLabel}
              onPan={pan}
              onPick={mode === "blink" ? (x, y) => setPick({ x, y }) : undefined}
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
                        ? fill(t("explore.loadingFrames"), {
                            index: load.loaded,
                            total: load.total,
                          })
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
          )}

          {ready && count > 0 && (
            <>
              {mode === "blink" && (
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
              )}
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

      <div className="flex flex-col gap-6">
        <div>
          <Card className="flex flex-col gap-3">
            <h2 className="font-sans text-h4 font-medium text-text-primary">
              {t("explore.lightCurve")}
            </h2>
            {ready && count > 0 ? (
              <LightCurveChart
                points={lightPoints}
                current={current}
                caption={
                  realField
                    ? t(wingPhotometry ? "explore.brightnessCaptionWing" : "explore.brightnessCaptionReal")
                    : undefined
                }
              />
            ) : (
              <p className="text-body-sm text-text-muted">{t("common.loading")}</p>
            )}
          </Card>
        </div>
        <div>
          <ObjectCard preset={preset} />
        </div>
      </div>

        </div>

        {/* Sticky with its own scroll: a tall tools panel never leaves an empty area beside the viewer. */}
        <div className="min-w-0 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain">
          <AdvancedSidePanel
            detector={detector}
            onDetector={(value) => newTarget({ det: value })}
            stretch={params.st as StretchKind}
            onStretch={(value) => void setParams({ st: value })}
            frameLabels={frameLabels}
            a={a}
            b={b}
            onA={(i) => void setParams({ a: i })}
            onB={(i) => void setParams({ b: i })}
            diffStyle={params.ds as DiffStyle}
            onDiffStyle={(value) => void setParams({ ds: value })}
            showFlags={showFlags}
            onShowFlags={(on) => void setParams({ fl: on ? 1 : 0 })}
            flagCount={ready && frames[current] ? countFlagged(frames[current].flags) : 0}
            spectrum={spectrum}
            pick={pick}
            spectrumOfTarget={realTarget}
            spectrumUnit={
              realField ? (wingPhotometry ? t("explore.unitWing") : "mJy") : realTarget ? t("explore.unitTargetPixel") : t("explore.unitRelative")
            }
            shareUrl={`${origin}/explore${search}`}
            embedSnippet={embedSnippet(origin, search)}
            onCopy={(text, doneKey) => void copyText(text, doneKey)}
            onDownloadPng={() => {
              const source = frameCanvases[mode === "blink" ? current : 0];
              if (source)
                downloadCanvasPng(
                  source,
                  `astroblink-${detector}-${frameLabels.length ? current + 1 : 0}.png`,
                );
            }}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1 text-caption text-text-muted">
        <p>{loaded?.field.isSimulated === false ? t("data.credit") : t("explore.simulatedNote")}</p>
        <p>{t("explore.keys")}</p>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {announce}
      </p>
    </div>
  );
}
