"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Badge } from "@/components/ui/Surfaces";
import { cn } from "@/lib/utils/cn";

interface SkyViewerProps {
  frames: HTMLCanvasElement[];
  index: number;
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
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => void;
  children?: React.ReactNode;
}

const FADE_MS = 600;

/**
 * Three stacked layers (design §10): image, overlay (reticle), interaction (pan, keys).
 * Two image layers cross-fade in reduced motion; in normal blink they swap instantly.
 */
export function SkyViewer(props: SkyViewerProps) {
  const {
    frames,
    index,
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
    onKeyDown,
    children,
  } = props;

  const containerRef = useRef<HTMLDivElement>(null);
  const layerA = useRef<HTMLCanvasElement>(null);
  const layerB = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const activeLayer = useRef(0);
  const shownIndex = useRef(-1);
  const shownFrames = useRef<HTMLCanvasElement[] | null>(null);
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0, dpr: 1 });

  // Track the container size (ResizeObserver callbacks are not synchronous setState in an effect).
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

    drawLayer(target, current, size, zoom, panX, panY);
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
    drawOverlay(overlay, size, panX, panY);
  }, [frames, index, zoom, panX, panY, size, reducedMotion]);

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    dragging.current = { x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = dragging.current;
    if (!start) return;
    onPan(event.clientX - start.x, event.clientY - start.y);
    dragging.current = { x: event.clientX, y: event.clientY };
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    dragging.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
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
        "relative h-[min(60vh,calc(100vw-2rem))] w-full cursor-grab overflow-hidden rounded-[var(--radius-md)] bg-viewer-bg touch-none select-none active:cursor-grabbing md:h-[min(68vh,720px)]",
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

      {simulated && (
        <div className="absolute top-3 left-3 z-10">
          <Badge tone="accent" className="bg-surface-1/90">
            {simulatedLabel}
          </Badge>
        </div>
      )}
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

function drawLayer(
  canvas: HTMLCanvasElement,
  source: HTMLCanvasElement,
  size: { w: number; h: number; dpr: number },
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

/** Reticle: four 10px ticks with a 12px gap at the centre, 1.5px stroke (design §10). */
function drawOverlay(
  canvas: HTMLCanvasElement,
  size: { w: number; h: number; dpr: number },
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
  const colour =
    getComputedStyle(document.documentElement).getPropertyValue("--reticle").trim() || "#ffb547";
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
