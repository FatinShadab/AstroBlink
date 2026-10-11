"use client";

import React from "react";
import type { Band } from "./BandSelector";

export interface ClickedMark {
  epoch: number;
  pixel_x: number;
  pixel_y: number;
  ra: number;
  dec: number;
}

export interface BlinkCanvasProps {
  tileUrls?: Record<string, string>;
  currentEpoch?: number;
  currentBand?: Band;
  lastMark?: ClickedMark | null;
  onImageClick?: (pixelX: number, pixelY: number) => void;
}

/**
 * BlinkCanvas — Epoch-switching image canvas.
 *
 * Only renders and blinks tile images belonging to `currentBand`
 * (`${currentEpoch}_${currentBand}`). Clicking the canvas converts
 * cursor position to 128x128 tile pixel coordinates and triggers `onImageClick`.
 */
export default function BlinkCanvas({
  tileUrls = {},
  currentEpoch = 1,
  currentBand = "swir",
  lastMark = null,
  onImageClick,
}: BlinkCanvasProps) {
  const tileKey = `${currentEpoch}_${currentBand}`;
  const imageUrl = tileUrls[tileKey];

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onImageClick) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const normX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const normY = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const pixelX = Number((normX * 128).toFixed(2));
    const pixelY = Number((normY * 128).toFixed(2));
    onImageClick(pixelX, pixelY);
  };

  return (
    <div
      onClick={handleClick}
      className="relative w-full max-w-lg aspect-square bg-black rounded-lg border border-gray-700 overflow-hidden cursor-crosshair select-none"
      role="img"
      aria-label={`Blink comparator canvas — Epoch ${currentEpoch} (${currentBand.toUpperCase()})`}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={`Subject epoch ${currentEpoch} band ${currentBand}`}
          className="w-full h-full object-contain"
          style={{ imageRendering: "pixelated" }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500">
          No tile available for {tileKey}
        </div>
      )}

      {/* HUD badge showing active epoch and band */}
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded bg-black/75 border border-gray-700 text-xs font-mono text-gray-200">
        Epoch {currentEpoch} · Band {currentBand.toUpperCase()}
      </div>

      {/* Crosshair marker for the last clicked position */}
      {lastMark && (
        <div
          className="pointer-events-none absolute w-6 h-6 -ml-3 -mt-3 rounded-full border-2 border-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
          style={{
            left: `${(lastMark.pixel_x / 128) * 100}%`,
            top: `${(lastMark.pixel_y / 128) * 100}%`,
          }}
        />
      )}
    </div>
  );
}
