"use client";

/**
 * BlinkCanvas — Epoch-switching image canvas.
 *
 * Displays tile images for a subject, one epoch at a time.
 * User can blink between epochs to spot moving objects.
 *
 * Props:
 * - tileUrls: Map of "{epoch}_{band}" -> URL
 * - currentEpoch: Currently displayed epoch
 * - currentBand: Currently selected band (swir/mwir/rgb)
 * - onEpochChange: Callback for epoch navigation
 *
 * Keyboard shortcuts: 1/2/3 for epochs, arrow keys for prev/next.
 * See PRD §FR-1 (Subject Display & Blink Comparison).
 */
export default function BlinkCanvas() {
  return (
    <div
      className="relative w-full aspect-square bg-black rounded border border-gray-700"
      role="img"
      aria-label="Blink comparator canvas — placeholder"
    >
      <div className="absolute inset-0 flex items-center justify-center text-gray-600">
        BlinkCanvas — stub component
      </div>
    </div>
  );
}
