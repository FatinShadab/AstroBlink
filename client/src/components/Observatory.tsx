"use client";

/**
 * Observatory — the orchestrator for the AstroBlink HUD.
 *
 * Owns view state (mirrored to the URL), loads subjects / overlays / spectra
 * through the API client, drives playback, and lays out either the full
 * observatory HUD or the compact embeddable blinker (`?embed=true`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { api } from "@/lib/api/client";
import { createFrameLoader } from "@/lib/api/frames";
import type { BenchmarkView, OverlaysResponse, SpectrumResponse, TaggedCandidate } from "@/lib/api/types";
import type { SubjectResponse } from "@/lib/api/generated/types";
import { formatDecDms, formatRaHms, makeWcs, normalizeRa, parseCoordinateInput } from "@/lib/coords";
import {
  bandCountFor,
  channelForWavelength,
  estimateTransferMB,
  motionTag,
  resolveTargetName,
  canonicalTargetName,
  type BandKey,
  type TemplateId,
} from "@/lib/mock/spherexMockEngine";
import { DEFAULT_STATE, parseState, serializeState, type ObservatoryState } from "@/lib/url-state";
import { candidatesToCsv, candidatesToJson, downloadText } from "@/lib/export";
import { ANNOTATION_CATEGORIES } from "@/lib/api/types";
import type { DisplayMode, StretchSettings } from "@/lib/render/pixelMath";
import BlinkCanvas, { type PixelMark } from "@/components/BlinkCanvas";
import BandSelector, { bandLabel } from "@/components/BandSelector";
import CommandBar from "@/components/CommandBar";
import PlaybackControls from "@/components/PlaybackControls";
import TransferControls from "@/components/TransferControls";
import OverlayControls from "@/components/OverlayControls";
import SpectrumPlotter, { type EpochSpectrum } from "@/components/SpectrumPlotter";
import AnnotationLayer, { type PendingMark } from "@/components/AnnotationLayer";
import ConsensusBadge from "@/components/ConsensusBadge";
import GlassPanel from "@/components/GlassPanel";
import ShareModal from "@/components/ShareModal";
import type { OverlayFlags } from "@/lib/url-state";

const TAG_STORAGE_KEY = "astroblink.tags.v1";

/** Pure playback step: forward loop or ping-pong bounce. */
export function nextEpoch(
  index: number,
  count: number,
  loop: ObservatoryState["loop"],
  dir: 1 | -1,
): { index: number; dir: 1 | -1 } {
  if (count <= 1) return { index: 0, dir: 1 };
  if (loop === "forward") return { index: (index + 1) % count, dir: 1 };
  let d = dir;
  let next = index + d;
  if (next >= count || next < 0) {
    d = (d * -1) as 1 | -1;
    next = index + d;
  }
  return { index: next, dir: d };
}

function labelForPosition(ra: number, dec: number, benchmarks: BenchmarkView[]): string | null {
  const hit = benchmarks.find((b) => Math.abs(b.ra - ra) < 1e-3 && Math.abs(b.dec - dec) < 1e-3);
  return hit ? hit.name : null;
}

export default function Observatory() {
  const [state, setState] = useState<ObservatoryState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);
  const [baseUrl, setBaseUrl] = useState("");
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [resolvedLabel, setResolvedLabel] = useState<string | null>(null);

  const [subject, setSubject] = useState<SubjectResponse | null>(null);
  const [overlayData, setOverlayData] = useState<OverlaysResponse | null>(null);
  const [playing, setPlaying] = useState(false);
  const [tagMode, setTagMode] = useState(false);
  const [pendingMark, setPendingMark] = useState<PendingMark | null>(null);
  const [selected, setSelected] = useState<{ x: number; y: number } | null>(null);
  const [spectra, setSpectra] = useState<EpochSpectrum[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [visibleEpochs, setVisibleEpochs] = useState<boolean[]>([true, true, true, true]);
  const [templates, setTemplates] = useState<TemplateId[]>([]);
  const [candidates, setCandidates] = useState<TaggedCandidate[]>([]);
  const [tagsLoaded, setTagsLoaded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const sessionStart = useRef(Date.now());
  const dirRef = useRef<1 | -1>(1);
  const stateRef = useRef(state);

  const epochs = useMemo(() => api.getEpochs(), []);
  const benchmarks = useMemo(() => api.listBenchmarks(), []);

  const view = useMemo(() => ({ ra: state.ra, dec: state.dec, fovArcmin: state.fov }), [state.ra, state.dec, state.fov]);
  const wcs = useMemo(() => makeWcs({ ra: state.ra, dec: state.dec }, state.fov), [state.ra, state.dec, state.fov]);
  const loadFrame = useMemo(() => createFrameLoader(subject, view), [subject, view]);

  const activeBenchmarkId = useMemo(
    () => benchmarks.find((b) => Math.abs(b.ra - state.ra) < 1e-3 && Math.abs(b.dec - state.dec) < 1e-3)?.id ?? null,
    [benchmarks, state.ra, state.dec],
  );

  // â”€â”€ URL hydration and write-back â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const parsed = parseState(new URLSearchParams(window.location.search));
    setState(parsed);
    setBaseUrl(`${window.location.origin}${window.location.pathname}`);
    setInput(labelForPosition(parsed.ra, parsed.dec, api.listBenchmarks()) ?? `${parsed.ra.toFixed(4)}, ${parsed.dec.toFixed(4)}`);
    // The spectrum drawer starts open on desktop and closed on phones, where it would cover the image.
    setDrawerOpen(window.innerWidth >= 1024);
    setHydrated(true);
  }, []);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!hydrated) return;
    const qs = serializeState(state).toString();
    window.history.replaceState(null, "", `${window.location.pathname}?${qs}`);
  }, [state, hydrated]);

  // â”€â”€ Persisted tags (per viewer) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(TAG_STORAGE_KEY);
      if (raw) setCandidates(JSON.parse(raw) as TaggedCandidate[]);
    } catch {
      // Storage unavailable (private mode, blocked) — tags stay in memory.
    }
    setTagsLoaded(true);
  }, []);

  useEffect(() => {
    if (!tagsLoaded) return;
    try {
      window.localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(candidates));
    } catch {
      // Ignore quota / availability errors.
    }
  }, [candidates, tagsLoaded]);

  // â”€â”€ Data loading â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    let cancelled = false;
    api
      .getSubject(view)
      .then((s) => {
        if (!cancelled) setSubject(s);
      })
      .catch(() => {
        if (!cancelled) setSubject(null);
      });
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (!state.overlays.gaia && !state.overlays.wise) return;
    let cancelled = false;
    api
      .getOverlays(view, state.epochIndex)
      .then((d) => {
        if (!cancelled) setOverlayData(d);
      })
      .catch(() => {
        if (!cancelled) setOverlayData(null);
      });
    return () => {
      cancelled = true;
    };
  }, [view, state.epochIndex, state.overlays.gaia, state.overlays.wise]);

  useEffect(() => {
    if (!selected) {
      setSpectra([]);
      return;
    }
    let cancelled = false;
    Promise.all(epochs.map((e) => api.getSpectrum(view, e.index, selected.x, selected.y)))
      .then((list: SpectrumResponse[]) => {
        if (!cancelled) setSpectra(list.map((s, i) => ({ epochIndex: i, label: epochs[i].label, spectrum: s })));
      })
      .catch(() => {
        if (!cancelled) setSpectra([]);
      });
    return () => {
      cancelled = true;
    };
  }, [selected, view, epochs]);

  // â”€â”€ Playback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      const cur = stateRef.current;
      const step = nextEpoch(cur.epochIndex, epochs.length, cur.loop, dirRef.current);
      dirRef.current = step.dir;
      setState((prev) => ({ ...prev, epochIndex: step.index }));
    }, 1000 / state.speed);
    return () => window.clearInterval(id);
  }, [playing, state.speed, epochs.length]);

  // â”€â”€ Keyboard shortcuts (ignored while typing) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === "ArrowLeft") {
        setPlaying(false);
        setState((prev) => ({ ...prev, epochIndex: (prev.epochIndex - 1 + epochs.length) % epochs.length }));
      } else if (e.key === "ArrowRight") {
        setPlaying(false);
        setState((prev) => ({ ...prev, epochIndex: (prev.epochIndex + 1) % epochs.length }));
      } else if (e.key === "t" || e.key === "T") {
        setTagMode((t) => !t);
      } else if (e.key === "Escape") {
        setSelected(null);
        setPendingMark(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [epochs.length]);

  // â”€â”€ Derived view data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const epochCount = epochs.length;
  const currentEpoch = epochs[state.epochIndex];
  const currentSpectrum = spectra[state.epochIndex]?.spectrum ?? null;
  const transferMB = estimateTransferMB(state.fov, bandCountFor(state.band), epochCount);

  const consensus = useMemo(() => {
    if (!subject) return null;
    const count = subject.classification_count ?? 0;
    const status = count === 0 ? "new" : count < 5 ? "under_review" : "confirmed";
    return { status, count, reliability: count ? Math.min(0.95, 0.5 + 0.05 * Math.min(count, 10)) : undefined };
  }, [subject]);

  const overlayCounts = useMemo(
    () =>
      overlayData
        ? {
            gaia: overlayData.gaia.length,
            wise: overlayData.wise.length,
            wiseInFrame: overlayData.wise.filter((w) => w.in_frame).length,
          }
        : undefined,
    [overlayData],
  );

  const marks: PixelMark[] = useMemo(() => {
    const saved: PixelMark[] = candidates
      .filter((c) => c.subject_id === subject?.id && c.epoch === currentEpoch?.epoch)
      .map((c) => ({
        id: c.id,
        x: c.pixel_x,
        y: c.pixel_y,
        label: ANNOTATION_CATEGORIES.find((a) => a.value === c.category)?.label.split(" /")[0],
        variant: "saved",
      }));
    if (pendingMark && pendingMark.epochIndex === state.epochIndex) {
      saved.push({ id: "pending", x: pendingMark.x, y: pendingMark.y, label: "Pending", variant: "pending" as const });
    }
    return saved;
  }, [candidates, subject?.id, currentEpoch, pendingMark, state.epochIndex]);

  const shareUrl = `${baseUrl}?${serializeState({ ...state, embed: false }).toString()}`;
  const embedUrl = `${baseUrl}?${serializeState({ ...state, embed: true }).toString()}`;

  // â”€â”€ Actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const navigate = (ra: number, dec: number) => {
    setState((prev) => ({ ...prev, ra: normalizeRa(ra), dec }));
    setSelected(null);
    setPendingMark(null);
  };

  const handleSubmit = (raw: string): string | null => {
    const parsed = parseCoordinateInput(raw, resolveTargetName, canonicalTargetName);
    if (parsed.kind === "error") return parsed.message;
    if (parsed.kind === "name") {
      navigate(parsed.resolved.ra, parsed.resolved.dec);
      setResolvedLabel(parsed.name);
      setInput(parsed.name);
      return null;
    }
    navigate(parsed.ra, parsed.dec);
    setResolvedLabel(`${formatRaHms(parsed.ra)} ${formatDecDms(parsed.dec)}`);
    setInput(`${parsed.ra.toFixed(5)}, ${parsed.dec.toFixed(5)}`);
    return null;
  };

  const pickBenchmark = (b: BenchmarkView) => {
    navigate(b.ra, b.dec);
    setInput(b.name);
    setResolvedLabel(b.name);
    setInputError(null);
  };

  const onPixelClick = (x: number, y: number) => {
    setSelected({ x, y });
    setDrawerOpen(true);
    if (tagMode && currentEpoch) {
      const world = wcs.pixelToWorld(x, y);
      setPendingMark({ x, y, ra: world.ra, dec: world.dec, epochIndex: state.epochIndex, epoch: currentEpoch.epoch });
    }
  };

  const onSaved = (candidate: TaggedCandidate, result: { subject_classification_count: number; subject_retired: boolean }) => {
    setCandidates((prev) => [candidate, ...prev]);
    setSubject((prev) => (prev ? { ...prev, classification_count: result.subject_classification_count, retired: result.subject_retired } : prev));
  };

  const exportTags = (kind: "json" | "csv") => {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    if (kind === "json") downloadText(`astroblink-candidates-${stamp}.json`, "application/json", candidatesToJson(candidates));
    else downloadText(`astroblink-candidates-${stamp}.csv`, "text/csv", candidatesToCsv(candidates));
  };

  const updateOverlay = (key: keyof OverlayFlags, value: boolean) =>
    setState((prev) => ({ ...prev, overlays: { ...prev.overlays, [key]: value } }));

  const updateStretch = (patch: Partial<StretchSettings>) =>
    setState((prev) => ({ ...prev, stretch: { ...prev.stretch, ...patch } }));

  const setBand = (band: BandKey) => setState((prev) => ({ ...prev, band }));
  const setMode = (mode: DisplayMode) => setState((prev) => ({ ...prev, mode }));

  const stepEpoch = (delta: number) => {
    setPlaying(false);
    setState((prev) => ({ ...prev, epochIndex: (prev.epochIndex + delta + epochCount) % epochCount }));
  };

  const togglePlay = () => setPlaying((p) => !p);

  const toggleEpochVisible = (i: number) => setVisibleEpochs((v) => v.map((x, idx) => (idx === i ? !x : x)));
  const toggleTemplate = (id: TemplateId) =>
    setTemplates((t) => (t.includes(id) ? t.filter((x) => x !== id) : [...t, id]));

  const canvas = (compact: boolean) => (
    <BlinkCanvas
      loadFrame={loadFrame}
      epochIndex={state.epochIndex}
      epochCount={epochCount}
      epochLabel={currentEpoch?.label ?? ""}
      band={state.band}
      bandLabel={bandLabel(state.band, state.rgb)}
      rgb={state.rgb}
      mode={state.mode}
      stretch={state.stretch}
      overlays={state.overlays}
      overlayData={overlayData}
      wcs={wcs}
      selectedPixel={selected}
      marks={marks}
      tagMode={tagMode}
      onPixelClick={onPixelClick}
      compact={compact}
    />
  );

  // â”€â”€ Embed layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (state.embed) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 p-2">
        {canvas(true)}
        <div className="flex w-full max-w-[640px] items-center gap-2 px-1 text-xs text-slate-300">
          <button
            type="button"
            onClick={togglePlay}
            aria-label={playing ? "Pause" : "Play"}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-slate-800/70"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <span className="font-mono tabular-nums">
            {currentEpoch?.label} · {currentEpoch?.iso_date}
          </span>
          <a
            href={`${baseUrl}?${serializeState({ ...state, embed: false }).toString()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-cyan-300 underline-offset-2 hover:underline"
          >
            Open in AstroBlink
          </a>
        </div>
      </div>
    );
  }

  // â”€â”€ Full observatory layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div className="flex min-h-screen flex-col lg:h-screen lg:overflow-hidden">
      <CommandBar
        input={input}
        onInputChange={(v) => {
          setInput(v);
          setInputError(null);
        }}
        onSubmit={(raw) => {
          const err = handleSubmit(raw);
          setInputError(err);
          return err;
        }}
        error={inputError}
        benchmarks={benchmarks}
        activeBenchmarkId={activeBenchmarkId}
        onPickBenchmark={pickBenchmark}
        fov={state.fov}
        onFovChange={(fov) => setState((prev) => ({ ...prev, fov }))}
        transferMB={transferMB}
        motionTag={motionTag(state.fov)}
        onShare={() => setShareOpen(true)}
        resolvedLabel={resolvedLabel}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[272px_minmax(0,1fr)_300px]">
        <div className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
          <GlassPanel eyebrow="Display" title="Arithmetic & transfer">
            <TransferControls
              mode={state.mode}
              onModeChange={setMode}
              stretch={state.stretch}
              onStretchChange={updateStretch}
            />
          </GlassPanel>
          <GlassPanel eyebrow="Catalogues" title="Overlays & masks">
            <OverlayControls overlays={state.overlays} onChange={updateOverlay} counts={overlayCounts} />
          </GlassPanel>
        </div>

        <main className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto lg:pr-1">
          <div className="flex flex-col items-center gap-1">
            {canvas(false)}
            <p className="font-mono text-[10px] text-slate-500">
              Space play/pause · ←/→ step · T tag mode · Esc clear
            </p>
          </div>
          <GlassPanel eyebrow="Time domain" title="Blink playback">
            <PlaybackControls
              playing={playing}
              onTogglePlay={togglePlay}
              onStep={stepEpoch}
              speed={state.speed}
              onSpeedChange={(speed) => setState((prev) => ({ ...prev, speed }))}
              loop={state.loop}
              onLoopChange={(loop) => setState((prev) => ({ ...prev, loop }))}
              epochIndex={state.epochIndex}
              onEpochChange={(i) => {
                setPlaying(false);
                setState((prev) => ({ ...prev, epochIndex: i }));
              }}
              epochs={epochs}
            />
          </GlassPanel>
          <GlassPanel eyebrow="SPHEREx" title="Detector arrays & 102 channels">
            <BandSelector
              band={state.band}
              onBandChange={setBand}
              rgb={state.rgb}
              onRgbChange={(rgb) => setState((prev) => ({ ...prev, rgb }))}
            />
            <p className="mt-3 text-[11px] text-slate-500">
              Nearest channel to 1.6 µm: {channelForWavelength(1.6) + 1}. Click any pixel for its 102-band spectrum.
            </p>
          </GlassPanel>
        </main>

        <aside className="flex min-h-0 flex-col gap-3 lg:overflow-y-auto">
          <GlassPanel
            eyebrow="Citizen science"
            title="Annotate & export"
            actions={
              <button
                type="button"
                onClick={() => setTagMode((t) => !t)}
                aria-pressed={tagMode}
                className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                  tagMode ? "border-cyan-400/60 bg-cyan-500/20 text-cyan-100" : "border-white/10 text-slate-300 hover:bg-white/5"
                }`}
              >
                Tag mode {tagMode ? "on" : "off"}
              </button>
            }
          >
            <AnnotationLayer
              subjectId={subject?.id ?? null}
              pending={pendingMark}
              onClearPending={() => setPendingMark(null)}
              spectrum={currentSpectrum}
              candidates={candidates.filter((c) => c.subject_id === subject?.id)}
              onSaved={onSaved}
              onRemove={(id) => setCandidates((prev) => prev.filter((c) => c.id !== id))}
              onExport={exportTags}
              consensus={consensus}
              sessionStartMs={sessionStart.current}
              epochLabel={currentEpoch?.label ?? ""}
            />
          </GlassPanel>
          <GlassPanel eyebrow="Target" title="Subject">
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 font-mono text-[11px] tabular-nums text-slate-300">
              <dt className="text-slate-500">RA</dt>
              <dd>{state.ra.toFixed(5)}° · {formatRaHms(state.ra)}</dd>
              <dt className="text-slate-500">Dec</dt>
              <dd>{state.dec.toFixed(5)}° · {formatDecDms(state.dec)}</dd>
              <dt className="text-slate-500">FoV</dt>
              <dd>{state.fov}′ · {wcs.arcsecPerPx.toFixed(2)}″/px</dd>
              <dt className="text-slate-500">Span</dt>
              <dd>{currentEpoch?.iso_date} â†’ {epochs[epochCount - 1]?.iso_date}</dd>
            </dl>
            {subject && consensus && (
              <div className="mt-3">
                <ConsensusBadge status={consensus.status} count={consensus.count} reliability={consensus.reliability} />
              </div>
            )}
          </GlassPanel>
        </aside>
      </div>

      <div className="sticky bottom-0 z-20 px-3 pb-3">
        <SpectrumPlotter
          open={drawerOpen}
          onToggleOpen={() => setDrawerOpen((o) => !o)}
          onClose={() => {
            setSelected(null);
            setDrawerOpen(false);
          }}
          pixel={selected}
          ra={selected ? wcs.pixelToWorld(selected.x, selected.y).ra : null}
          dec={selected ? wcs.pixelToWorld(selected.x, selected.y).dec : null}
          epochSpectra={spectra}
          visibleEpochs={visibleEpochs}
          onToggleEpoch={toggleEpochVisible}
          templates={templates}
          onToggleTemplate={toggleTemplate}
        />
      </div>

      <ShareModal open={shareOpen} onClose={() => setShareOpen(false)} shareUrl={shareUrl} embedUrl={embedUrl} />
      {!hydrated && <span className="sr-only">Loading observatory</span>}
    </div>
  );
}
