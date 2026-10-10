"use client";

/**
 * BandSelector — Toggle between spectral bands.
 *
 * Bands: SWIR (0.75-2.42µm), MWIR (3.8-5.0µm), False-color RGB.
 * See PRD §FR-1.2.
 */
export default function BandSelector() {
  return (
    <div className="flex gap-2">
      {["SWIR", "MWIR", "RGB"].map((band) => (
        <button
          key={band}
          className="px-4 py-2 bg-astro-surface border border-gray-700 rounded text-sm hover:bg-astro-accent transition"
        >
          {band}
        </button>
      ))}
    </div>
  );
}
