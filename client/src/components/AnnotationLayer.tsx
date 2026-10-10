"use client";

/**
 * AnnotationLayer — Click-to-mark overlay for object identification.
 *
 * Renders on top of BlinkCanvas. Converts pixel coordinates to RA/Dec
 * using the WCS JSON sidecar.
 *
 * See PRD §FR-2 (Classification Workflow), ARCHITECTURE.md §4.2.
 */
export default function AnnotationLayer() {
  return (
    <div
      className="absolute inset-0 cursor-crosshair"
      role="button"
      aria-label="Click to mark an object"
    >
      {/* Marks will be rendered as circles overlaid on the canvas */}
    </div>
  );
}
