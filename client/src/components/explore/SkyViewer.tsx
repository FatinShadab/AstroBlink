"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { DataBadge } from "@/components/ui/DataBadge";
import { cn } from "@/lib/utils/cn";

export interface SkyViewerProps {
  frames: HTMLCanvasElement[];
  index: number;
  /** Optional glitch-flag canvas for the shown frame, same size as the frame. */
  flags?: HTMLCanvasElement | null;
  zoom: number;
  panX: number;
  panY: number;
  reducedMotion: boolean;
  simulated: boolean;
  simulatedLabel: string;
  ariaLabel: string;
  frameCounter: string;
  zoomLabel: string;
  onPan: (dx: number, dy: number) => void;
  /** Called with image-pixel coordinates when the user clicks without dragging. */
  onPick?: (x: number, y: number) => void;
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
  className?: string;
}

const FADE_MS = 600;
const CLICK_SLOP_PX = 4;

interface Size {
  w: number;
  h: number;
  dpr: number;
}

/**
 * Three stacked layers (design §10): image, overlay (flags and reticle), interaction (pan, click, keys).
 * Two image layers cross-fade in reduced motion; in normal blink they swap instantly.
 */
export function SkyViewer(props: SkyViewerProps) {
  const {
    frames,
    index,
    flags,
    zoom,
    panX,
    panY,
    reducedMotion,
    simulated,
    simulatedLabel,
    ariaLabel,
    frameCounter,
    zoomLabel,
    onPan,
    onPick,
    onKeyDown,
    children,
    className,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const layerA = useRef<HTMLCanvasElement>(null);
  const layerB = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const activeLayer = useRef(0);
  const shownIndex = useRef(-1);
  const shownFrames = useRef<HTMLCanvasElement[] | null>(null);
  const dragging = useRef<{
    x: number;
    y: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  const [size, setSize] = useState<Size>({ w: 0, h: 0, dpr: 1 });

  // Track the container size (the callback updates state; no synchronous setState in the effect body).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () =>
      setSize({ w: el.clientWidth, h: el.clientHeight, dpr: window.devicePixelRatio || 1 });
    const observer = new ResizeObserver(update);
    observer.observe(el);
    update();
    return () => observer.disconnect();
  }, []);

  // Draw the current frame. A new frame cross-fades in; a pan or zoom redraws in place.
  useEffect(() => {
    const a = layerA.current;
    const b = layerB.current;
    const overlay = overlayRef.current;
    if (!a || !b || !overlay || size.w === 0 || frames.length === 0) return;

    const current = frames[Math.min(index, frames.length - 1)];
    const frameChanged = shownIndex.current !== index || shownFrames.current !== frames;
    const fadeMs = reducedMotion ? FADE_MS : 0;
    const target = frameChanged
      ? activeLayer.current === 0
        ? b
        : a
      : activeLayer.current === 0
        ? a
        : b;

    drawImage(target, current, size, zoom, panX, panY);
    a.style.transition = `opacity ${fadeMs}ms linear`;
    b.style.transition = `opacity ${fadeMs}ms linear`;

    if (frameChanged) {
      const next = activeLayer.current === 0 ? 1 : 0;
      activeLayer.current = next;
      target.style.opacity = "1";
      (next === 0 ? b : a).style.opacity = "0";
      shownIndex.current = index;
      shownFrames.current = frames;
    }
    drawOverlay(overlay, size, current, flags ?? null, zoom, panX, panY);
  }, [frames, index, flags, zoom, panX, panY, size, reducedMotion]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = {
      x: event.clientX,
      y: event.clientY,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragging.current;
    if (!drag) return;
    if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > CLICK_SLOP_PX) {
      drag.moved = true;
    }
    onPan(event.clientX - drag.x, event.clientY - drag.y);
    dragging.current = { ...drag, x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const drag = dragging.current;
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    const frame = frames[Math.min(index, frames.length - 1)];
    if (!drag || drag.moved || !onPick || !frame || event.type === "pointercancel") return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = (Math.min(rect.width, rect.height) / frame.width) * zoom;
    const originX = rect.width / 2 + panX - (frame.width / 2) * scale;
    const originY = rect.height / 2 + panY - (frame.height / 2) * scale;
    const px = Math.floor((event.clientX - rect.left - originX) / scale);
    const py = Math.floor((event.clientY - rect.top - originY) / scale);
    if (px >= 0 && py >= 0 && px < frame.width && py < frame.height) onPick(px, py);
  }

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="sky viewer"
      aria-label={ariaLabel}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        "relative h-[min(60vh,calc(100vw-2rem))] w-full cursor-crosshair overflow-hidden rounded-[var(--radius-md)] bg-viewer-bg touch-none select-none md:h-[min(68vh,720px)]",
        className,
      )}
    >
      <canvas
        ref={layerA}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-0 [image-rendering:pixelated]"
      />
      <canvas
        ref={layerB}
        aria-hidden="true"
        className="absolute inset-0 h-full w-full opacity-0 [image-rendering:pixelated]"
      />
      <canvas
        ref={overlayRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
      />

      {/* Data source: grey "Simulated sky" or cyan "Real NASA data". */}
      <div className="absolute top-3 left-3 z-10 rounded-full bg-surface-1/90" title={simulated ? simulatedLabel : undefined}>
        <DataBadge real={!simulated} />
      </div>
      <div className="absolute top-3 right-3 z-10 rounded-[var(--radius-sm)] bg-surface-1/90 px-2 py-1 font-mono text-mono tabular-nums text-text-primary">
        {frameCounter}
      </div>
      <div className="absolute right-3 bottom-3 z-10 rounded-[var(--radius-sm)] bg-surface-1/90 px-2 py-1 font-mono text-mono tabular-nums text-text-primary">
        {zoomLabel}
      </div>
      {children}
    </div>
  );
}

/** Draw a frame with the zoom and pan transform (nearest-neighbour, black background). */
function drawImage(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  size: Size,
  zoom: number,
  panX: number,
  panY: number,
) {
  const { w, h, dpr } = size;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = "#000000"; // viewer-bg token; canvas cannot read CSS variables directly
  ctx.fillRect(0, 0, w, h);
  const n = source.width;
  const scale = (Math.min(w, h) / n) * zoom;
  const x = w / 2 + panX - (n / 2) * scale;
  const y = h / 2 + panY - (n / 2) * scale;
  ctx.drawImage(source, x, y, n * scale, n * scale);
}

/** Overlay: glitch flags (drawn with the same transform as the image), then the reticle. */
function drawOverlay(
  canvas: HTMLCanvasElement,
  size: Size,
  frame: HTMLCanvasElement,
  flags: HTMLCanvasElement | null,
  zoom: number,
  panX: number,
  panY: number,
) {
  const { w, h, dpr } = size;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  if (flags) {
    const n = frame.width;
    const scale = (Math.min(w, h) / n) * zoom;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      flags,
      w / 2 + panX - (n / 2) * scale,
      h / 2 + panY - (n / 2) * scale,
      n * scale,
      n * scale,
    );
  }

  const style = getComputedStyle(document.documentElement);
  const colour = style.getPropertyValue("--reticle").trim() || "#ffb547";
  const cx = w / 2 + panX;
  const cy = h / 2 + panY;
  ctx.strokeStyle = colour;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    ctx.moveTo(cx + dx * 12, cy + dy * 12);
    ctx.lineTo(cx + dx * 22, cy + dy * 22);
  }
  ctx.stroke();
}
