/**
 * /classify — Blink comparator page.
 *
 * Placeholder. The real page will contain:
 * - BlinkCanvas: epoch-switching canvas with tile images
 * - BandSelector: SWIR / MWIR / RGB toggle
 * - AnnotationLayer: click-to-mark overlays with WCS conversion
 * - Classification form: category selection + submit
 * - Keyboard shortcuts for blink (1/2/3 or arrow keys)
 *
 * See PRD §FR-1 and §FR-2.
 */
export default function ClassifyPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-3xl font-bold">🔍 Blink Comparator</h1>
      <p className="text-gray-400 max-w-md text-center">
        Compare multi-epoch SPHEREx images to spot moving or anomalous sources.
      </p>
      <div className="w-full max-w-2xl aspect-square bg-astro-surface rounded-lg border border-gray-700 flex items-center justify-center">
        <span className="text-gray-500">
          BlinkCanvas placeholder — see PRD §FR-1
        </span>
      </div>
    </div>
  );
}
