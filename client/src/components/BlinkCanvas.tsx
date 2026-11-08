"use client";

/**
 * BlinkCanvas — 2D multi-epoch blink comparator.
 *
 * Pixel work happens on an HTML5 canvas at the native 128×128 frame size and is
 * scaled up with nearest-neighbour sampling, so pixels stay crisp. Catalogue,
 * WCS grid, marks and the cursor HUD are 2D SVG / DOM overlays in frame pixel
 * coordinates. No WebGL and no 3D.
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { clamp, formatDecDms, formatDecimal, formatRaHms, normalizeRa, type Wcs } from "@/lib/coords";
import type { FrameLoader } from "@/lib/api/frames";
import type { OverlaysResponse } from "@/lib/api/types";
import { FRAME_SIZE, type ArrayId, type BandKey, type Frame } from "@/lib/mock/spherexMockEngine";
import {
  coaddFrames,
  composeRgbRgba,
  grayscaleRgba,
  maskRgba,
  pixelValue,
  signedRgba,
  subtractFrames,
  type DisplayMode,
  type StretchSettings,
} from "@/lib/render/pixelMath";
import type { OverlayFlags } from "@/lib/url-state";

export type CanvasStatus = "loading" | "ready" | "missing" | "error";

export interface PixelMark {
  id: string;
  x: number;
  y: number;
  label?: string;
  variant?: "saved" | "pending";
}

export interface CursorReadout {
  x: number;
  y: number;
  ra: number;
  dec: number;
  flux: number;
}

export interface BlinkCanvasProps {
  loadFrame: FrameLoader;
  epochIndex: number;
  epochCount: number;
  epochLabel: string;
  band: BandKey;
  bandLabel: string;
  rgb: [ArrayId, ArrayId, ArrayId];
  mode: DisplayMode;
  stretch: StretchSettings;
  overlays: OverlayFlags;
  overlayData: OverlaysResponse | null;
  wcs: Wcs;
  selectedPixel: { x: number; y: number } | null;
  marks: PixelMark[];
  tagMode: boolean;
  onPixelClick?: (x: number, y: number, flux: number) => void;
  onStatusChange?: (status: CanvasStatus) => void;
  onCursorChange?: (cursor: CursorReadout | null) => void;
  /** Hides the cursor readout and grid labels for the embeddable widget. */
  compact?: boolean;
}

/** Which (epoch, band) frames a display mode needs. */
export function planFrames(
  epochIndex: number,
  epochCount: number,
  band: BandKey,
  rgb: [ArrayId, ArrayId, ArrayId],
  mode: DisplayMode,
): Array<[number, BandKey]> {
  if (band === "rgb") return rgb.map((a): [number, BandKey] => [epochIndex, `a${a}`]);
  if (mode === "coadd") return Array.from({ length: epochCount }, (_, e) => [e, band] as [number, BandKey]);
  if (mode === "diff") return epochIndex === 0 ? [[0, band]] : [[epochIndex, band], [0, band]];
  return [[epochIndex, band]];
}

/** Nice grid step (1, 2, 5 × 10ⁿ) for a target spacing in degrees. */
export function niceStepDeg(target: number): number {
  if (!(target > 0)) return 1;
  const e = 10 ** Math.floor(Math.log10(target));
  const m = target / e;
  const nice = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
  return nice * e;
}

function shortRa(raDeg: number): string {
  // Whole seconds, so grid lines spaced by less than a minute of RA stay distinguishable.
  const totalSec = Math.round((normalizeRa(raDeg) / 15) * 3600) % 86400;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h}h${String(m).padStart(2, "0")}m${String(s).padStart(2, "0")}s`;
}

function shortDec(decDeg: number): string {
  const sign = decDeg < 0 ? "−" : "+";
  const abs = Math.abs(decDeg);
  return `${sign}${Math.floor(abs)}°${String(Math.round((abs % 1) * 60)).padStart(2, "0")}′`;
}

interface GridLine {
  key: string;
  a: { x: number; y: number };
  b: { x: number; y: number };
  label: string;
  labelAt: { x: number; y: number };
}

function buildGrid(wcs: Wcs): GridLine[] {
  const fovDeg = wcs.fovArcmin / 60;
  const step = niceStepDeg(fovDeg / 4);
  const cosDec = Math.max(Math.cos((wcs.center.dec * Math.PI) / 180), 0.2);
  const halfRa = fovDeg / 2 / cosDec + step;
  const halfDec = fovDeg / 2 + step;
  const lines: GridLine[] = [];

  const raFrom = Math.floor((wcs.center.ra - halfRa) / step);
  const raTo = Math.ceil((wcs.center.ra + halfRa) / step);
  for (let n = raFrom; n <= raTo; n++) {
    const ra = n * step;
    const a = wcs.worldToPixel(ra, wcs.center.dec - halfDec);
    const b = wcs.worldToPixel(ra, wcs.center.dec + halfDec);
    const labelAt = clampToFrame({ x: b.x, y: b.y + 2.5 });
    lines.push({ key: `ra-${n}`, a, b, label: shortRa(ra), labelAt });
  }

  const decFrom = Math.floor((wcs.center.dec - halfDec) / step);
  const decTo = Math.ceil((wcs.center.dec + halfDec) / step);
  for (let n = decFrom; n <= decTo; n++) {
    const dec = n * step;
    if (dec < -90 || dec > 90) continue;
    const a = wcs.worldToPixel(wcs.center.ra - halfRa, dec);
    const b = wcs.worldToPixel(wcs.center.ra + halfRa, dec);
    const labelAt = clampToFrame({ x: a.x + 1.5, y: a.y - 1.5 });
    lines.push({ key: `dec-${n}`, a, b, label: shortDec(dec), labelAt });
  }
  return lines;
}

function clampToFrame(p: { x: number; y: number }): { x: number; y: number } {
  return { x: clamp(p.x, 2, FRAME_SIZE - 14), y: clamp(p.y, 4, FRAME_SIZE - 3) };
}

export default function BlinkCanvas({
  loadFrame,
  epochIndex,
  epochCount,
  epochLabel,
  band,
  bandLabel,
  rgb,
  mode,
  stretch,
  overlays,
  overlayData,
  wcs,
  selectedPixel,
  marks,
  tagMode,
  onPixelClick,
  onStatusChange,
  onCursorChange,
  compact = false,
}: BlinkCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const maskRef = useRef<HTMLCanvasElement>(null);

  const [loaded, setLoaded] = useState<{ frames: Frame[] } | null>(null);
  const [status, setStatus] = useState<CanvasStatus>("loading");
  const [cursor, setCursor] = useState<CursorReadout | null>(null);

  const rgbKey = rgb.join(",");

  useEffect(() => {
    let cancelled = false;
    const plan = planFrames(epochIndex, epochCount, band, rgb, mode);
    setStatus("loading");
    Promise.all(plan.map(([e, b]) => loadFrame(e, b)))
      .then((frames) => {
        if (cancelled) return;
        if (frames.some((f) => f === null)) {
          setLoaded(null);
          setStatus("missing");
          return;
        }
        setLoaded({ frames: frames as Frame[] });
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setLoaded(null);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
    // rgbKey stands in for `rgb`, which is a fresh array each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadFrame, epochIndex, epochCount, band, rgbKey, mode]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [status, onStatusChange]);

  const display = useMemo(() => {
    if (!loaded) return null;
    const fr = loaded.frames;
    if (band === "rgb") {
      return {
        rgba: composeRgbRgba(fr[0].data, fr[1].data, fr[2].data, stretch),
        field: fr[0].data,
        primary: fr[0],
      };
    }
    if (mode === "coadd") {
      const field = coaddFrames(fr.map((f) => f.data));
      return {
        rgba: grayscaleRgba(field, stretch),
        field,
        primary: fr[Math.min(epochIndex, fr.length - 1)],
      };
    }
    if (mode === "diff") {
      const field = subtractFrames(fr[0].data, fr[fr.length - 1].data);
      return { rgba: signedRgba(field, stretch), field, primary: fr[0] };
    }
    return {
      rgba: grayscaleRgba(fr[0].data, stretch),
      field: fr[0].data,
      primary: fr[0],
    };
  }, [loaded, band, mode, stretch, epochIndex]);

  // Paint the scientific image pixels.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !display) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ImageData === "undefined") return;
    ctx.imageSmoothingEnabled = false;
    const image = new ImageData(new Uint8ClampedArray(display.rgba), FRAME_SIZE, FRAME_SIZE);
    ctx.putImageData(image, 0, 0);
  }, [display]);

  // Paint the bitmask overlay.
  useEffect(() => {
    const canvas = maskRef.current;
    if (!canvas || !display || !overlays.mask) return;
    const ctx = canvas.getContext("2d");
    if (!ctx || typeof ImageData === "undefined") return;
    const image = new ImageData(new Uint8ClampedArray(maskRgba(display.primary.mask)), FRAME_SIZE, FRAME_SIZE);
    ctx.putImageData(image, 0, 0);
  }, [display, overlays.mask]);

  const grid = useMemo(() => (overlays.grid ? buildGrid(wcs) : []), [overlays.grid, wcs]);

  const toFramePixel = (clientX: number, clientY: number): { x: number; y: number } | null => {
    const el = wrapRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return null;
    const x = clamp(((clientX - rect.left) / rect.width) * FRAME_SIZE, 0, FRAME_SIZE - 0.001);
    const y = clamp(((clientY - rect.top) / rect.height) * FRAME_SIZE, 0, FRAME_SIZE - 0.001);
    return { x: Math.floor(x) + 0.5, y: Math.floor(y) + 0.5 };
  };

  const updateCursor = (clientX: number, clientY: number) => {
    const p = toFramePixel(clientX, clientY);
    if (!p) return;
    const world = wcs.pixelToWorld(p.x, p.y);
    const next: CursorReadout = {
      x: p.x,
      y: p.y,
      ra: world.ra,
      dec: world.dec,
      flux: display ? pixelValue(display.field, FRAME_SIZE, p.x, p.y) : Number.NaN,
    };
    setCursor(next);
    onCursorChange?.(next);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const p = toFramePixel(e.clientX, e.clientY);
    if (!p || !onPixelClick) return;
    onPixelClick(p.x, p.y, display ? pixelValue(display.field, FRAME_SIZE, p.x, p.y) : Number.NaN);
  };

  const modeLabel = mode === "blink" ? "Blink" : mode === "coadd" ? "Co-add" : "Difference";
  const viewBox = `0 0 ${FRAME_SIZE} ${FRAME_SIZE}`;

  return (
    <div
      ref={wrapRef}
      role="img"
      aria-label={`Blink comparator — ${epochLabel}, ${bandLabel}, ${modeLabel}`}
      onPointerMove={(e) => updateCursor(e.clientX, e.clientY)}
      onPointerLeave={() => {
        setCursor(null);
        onCursorChange?.(null);
      }}
      onClick={handleClick}
      className={`group relative mx-auto select-none overflow-hidden rounded-2xl border border-white/10 bg-black shadow-[0_0_60px_-18px_rgba(56,189,248,0.45)] ${
        tagMode ? "cursor-crosshair" : "cursor-pointer"
      }`}
      style={{ width: compact ? "min(100%, 640px)" : "min(100%, max(300px, calc(100dvh - 300px)), 720px)", aspectRatio: "1 / 1" }}
    >
      <canvas
        ref={canvasRef}
        width={FRAME_SIZE}
        height={FRAME_SIZE}
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: "pixelated" }}
      />

      {overlays.mask && (
        <canvas
          ref={maskRef}
          width={FRAME_SIZE}
          height={FRAME_SIZE}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
      )}

      <svg
        viewBox={viewBox}
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 h-full w-full overflow-hidden"
        aria-hidden="true"
      >
        {grid.map((line) => (
          <g key={line.key} className="text-sky-200/70">
            <line
              x1={line.a.x}
              y1={line.a.y}
              x2={line.b.x}
              y2={line.b.y}
              stroke="currentColor"
              strokeOpacity={0.28}
              strokeWidth={0.2}
              strokeDasharray="1.2 1.2"
            />
            {!compact && (
              <text x={line.labelAt.x} y={line.labelAt.y} fontSize={2.4} fill="currentColor" className="font-mono">
                {line.label}
              </text>
            )}
          </g>
        ))}

        {overlays.compass && <Compass />}

        {overlays.gaia &&
          overlayData?.gaia.map((g) => {
            const len = clamp(g.pm_px_per_yr * 2, 2, 12);
            const theta = (g.pm_angle_deg * Math.PI) / 180;
            const x2 = g.x - Math.sin(theta) * len;
            const y2 = g.y - Math.cos(theta) * len;
            return (
              <g key={g.id} className="text-cyan-300">
                <circle cx={g.x} cy={g.y} r={1.8} fill="none" stroke="currentColor" strokeWidth={0.35} />
                <line x1={g.x} y1={g.y} x2={x2} y2={y2} stroke="currentColor" strokeWidth={0.3} />
              </g>
            );
          })}

        {overlays.wise &&
          overlayData?.wise.map((w) => (
            <g key={w.id} className="text-amber-400">
              <line
                x1={w.x}
                y1={w.y}
                x2={w.current_x}
                y2={w.current_y}
                stroke="currentColor"
                strokeOpacity={0.6}
                strokeWidth={0.3}
                strokeDasharray="1 1"
              />
              <rect
                x={w.x - 1.6}
                y={w.y - 1.6}
                width={3.2}
                height={3.2}
                transform={`rotate(45 ${w.x} ${w.y})`}
                fill="none"
                stroke="currentColor"
                strokeWidth={0.4}
                opacity={w.in_frame ? 1 : 0.5}
              />
              {!compact && (
                <text x={w.x + 2.4} y={w.y - 2} fontSize={2.2} fill="currentColor" className="font-mono">
                  {w.year.toFixed(1)}
                </text>
              )}
            </g>
          ))}

        {marks.map((m) => (
          <g key={m.id} className={m.variant === "pending" ? "text-cyan-300" : "text-emerald-400"}>
            <circle
              cx={m.x}
              cy={m.y}
              r={4}
              fill="none"
              stroke="currentColor"
              strokeWidth={0.5}
              strokeDasharray={m.variant === "pending" ? "1.5 1" : undefined}
            />
            {m.label && (
              <text x={m.x + 5} y={m.y - 4} fontSize={2.6} fill="currentColor" className="font-mono">
                {m.label}
              </text>
            )}
          </g>
        ))}

        {selectedPixel && (
          <g className="text-white">
            <line x1={selectedPixel.x - 3} y1={selectedPixel.y} x2={selectedPixel.x + 3} y2={selectedPixel.y} stroke="currentColor" strokeWidth={0.35} />
            <line x1={selectedPixel.x} y1={selectedPixel.y - 3} x2={selectedPixel.x} y2={selectedPixel.y + 3} stroke="currentColor" strokeWidth={0.35} />
          </g>
        )}
      </svg>

      {/* HUD: epoch / band / mode */}
      <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5">
        <span className="rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 font-mono text-[11px] tabular-nums text-slate-100 backdrop-blur-md">
          {epochLabel} · {epochIndex + 1}/{epochCount}
        </span>
        <span className="rounded-md border border-white/10 bg-slate-900/70 px-2 py-1 text-[11px] text-slate-200 backdrop-blur-md">
          {bandLabel} · {modeLabel}
        </span>
      </div>

      {status !== "ready" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center">
          <span
            role={status === "error" ? "alert" : "status"}
            className="rounded-lg border border-white/10 bg-slate-900/70 px-3 py-2 text-xs text-slate-300 backdrop-blur-md"
          >
            {status === "loading" && "Loading…"}
            {status === "missing" && (
              <>
                <span className="block font-medium text-slate-200">No image data loaded</span>
                <span className="block text-[11px] text-slate-500">Frames appear here once SPHEREx tiles are connected.</span>
              </>
            )}
            {status === "error" && "Frame failed to load"}
          </span>
        </div>
      )}

      {tagMode && (
        <span className="pointer-events-none absolute right-3 top-3 rounded-md border border-cyan-400/40 bg-cyan-950/70 px-2 py-1 text-[11px] text-cyan-200">
          Tag mode · click to place
        </span>
      )}

      {/* Cursor HUD */}
      {!compact && cursor && (
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:right-auto sm:w-72 rounded-xl border border-white/10 bg-slate-900/60 p-2.5 font-mono text-[11px] leading-relaxed tabular-nums text-slate-200 shadow-lg backdrop-blur-xl">
          <div className="flex justify-between gap-3">
            <span className="text-cyan-300">RA</span>
            <span>
              {formatDecimal(cursor.ra, 5)}° · {formatRaHms(cursor.ra)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-cyan-300">Dec</span>
            <span>
              {formatDecimal(cursor.dec, 5)}° · {formatDecDms(cursor.dec)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-400">X, Y</span>
            <span>
              {Math.floor(cursor.x)}, {Math.floor(cursor.y)}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-amber-300">Flux</span>
            <span>{Number.isFinite(cursor.flux) ? `${cursor.flux.toFixed(1)} µJy` : "—"}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Compass() {
  // North up, east left (sky convention). Origin at lower-left of the frame.
  const ox = 14;
  const oy = 114;
  const L = 9;
  return (
    <g className="text-slate-100" fontSize={3} fontFamily="monospace">
      <line x1={ox} y1={oy} x2={ox} y2={oy - L} stroke="currentColor" strokeWidth={0.4} />
      <line x1={ox} y1={oy} x2={ox - L} y2={oy} stroke="currentColor" strokeWidth={0.4} />
      <text x={ox - 1.2} y={oy - L - 1} fill="currentColor">N</text>
      <text x={ox - L - 4} y={oy + 1} fill="currentColor">E</text>
    </g>
  );
}
