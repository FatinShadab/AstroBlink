"use client";

import { useEffect, useRef, useState } from "react";
import { Skeleton } from "@/components/ui/Surfaces";
import { useReducedMotion } from "@/lib/a11y/useReducedMotion";
import { formatDate } from "@/lib/i18n/format";
import { useLang, useT } from "@/lib/i18n/LangProvider";
import { loadThumb, type ThumbImage, type ThumbSpec } from "@/lib/sky/thumbnails";
import { cn } from "@/lib/utils/cn";

const BLINK_MS = 900;

/** The glitch overlay colour (--data-6, as in the viewer), read from the tokens. */
function overlayRgb(): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue("--data-6").trim() || "#cc79a7";
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/**
 * A small sky image for the project pages: real SPHEREx data (a 2-frame blink or a still) or a simulated
 * field with its glitch overlay. The square box is reserved before loading, so nothing shifts; with
 * reduced motion a blink shows its first frame only.
 */
export function SkyThumbnail({
  spec,
  label,
  caption,
  aspect = "square",
  className,
}: {
  spec: ThumbSpec;
  /** "wide" shows the centre of the square image in a 16:9 box (cards); "square" shows all of it. */
  aspect?: "square" | "wide";
  /** What the image shows, for screen readers. */
  label: string;
  /** Text under the image, e.g. "Real SPHEREx image · Barnard's Star". */
  caption?: string;
  className?: string;
}) {
  const { t } = useT();
  const { lang } = useLang();
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<ThumbImage | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);
  const simulated = spec.kind === "simulated-glitch";
  const specKey = JSON.stringify(spec);

  useEffect(() => {
    const ctrl = new AbortController();
    loadThumb(JSON.parse(specKey) as ThumbSpec, ctrl.signal)
      .then((img) => {
        if (!ctrl.signal.aborted) setImage(img);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true);
      });
    return () => ctrl.abort();
  }, [specKey]);

  const blinking = image !== null && image.frames.length > 1 && !reducedMotion;
  useEffect(() => {
    if (!blinking) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % 2), BLINK_MS);
    return () => window.clearInterval(id);
  }, [blinking]);
  const shown = blinking ? index : 0;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const frame = image.frames[shown];
    const rgba = new Uint8ClampedArray(image.width * image.height * 4);
    const glitch = simulated ? overlayRgb() : null;
    for (let i = 0, j = 0; i < frame.grey.length; i++, j += 4) {
      const g = frame.grey[i];
      if (glitch && frame.flags[i]) {
        // Glitch overlay on the simulated image: flagged pixels blended with the overlay colour.
        rgba[j] = Math.round(g * 0.4 + glitch[0] * 0.6);
        rgba[j + 1] = Math.round(g * 0.4 + glitch[1] * 0.6);
        rgba[j + 2] = Math.round(g * 0.4 + glitch[2] * 0.6);
      } else {
        rgba[j] = g;
        rgba[j + 1] = g;
        rgba[j + 2] = g;
      }
      rgba[j + 3] = 255;
    }
    ctx.putImageData(new ImageData(rgba, image.width, image.height), 0, 0);
  }, [image, shown, simulated]);

  const date = image?.frames[shown]?.obsDate;

  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-[var(--radius-md)] border border-border bg-viewer-bg",
          aspect === "wide" ? "aspect-video" : "aspect-square",
        )}
      >
        {image && (
          <canvas
            ref={canvasRef}
            width={image.width}
            height={image.height}
            role="img"
            aria-label={label}
            className="absolute inset-0 size-full object-cover [image-rendering:pixelated]"
          />
        )}
        {!image && !failed && <Skeleton className="absolute inset-0 size-full rounded-none" />}
        {failed && (
          <p className="absolute inset-0 grid place-items-center p-3 text-center text-caption text-text-muted">
            {t("thumb.failed")}
          </p>
        )}
        {simulated && (
          <span className="absolute top-2 left-2 rounded-full border border-border bg-surface-1/90 px-2 py-0.5 text-caption font-medium text-badge-sim">
            {t("thumb.simulated")}
          </span>
        )}
        {date && image && image.frames.length > 1 && (
          <span
            aria-hidden="true"
            className="absolute right-2 bottom-2 rounded-full bg-surface-1/80 px-2 py-0.5 font-mono text-caption text-text-secondary"
          >
            {formatDate(date, lang)}
          </span>
        )}
      </div>
      {caption && <figcaption className="text-caption text-text-muted">{caption}</figcaption>}
    </figure>
  );
}
