"use client";

export type Band = "swir" | "mwir" | "rgb";

interface BandSelectorProps {
  currentBand?: Band;
  onBandChange?: (band: Band) => void;
}

const BANDS: { id: Band; label: string }[] = [
  { id: "swir", label: "SWIR" },
  { id: "mwir", label: "MWIR" },
  { id: "rgb", label: "RGB" },
];

export default function BandSelector({
  currentBand = "swir",
  onBandChange,
}: BandSelectorProps) {
  return (
    <div className="flex gap-2" role="group" aria-label="Spectral band selector">
      {BANDS.map(({ id, label }) => {
        const active = currentBand === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onBandChange?.(id)}
            className={`px-4 py-2 border rounded text-sm font-medium transition ${
              active
                ? "bg-blue-600 border-blue-400 text-white"
                : "bg-astro-surface border-gray-700 text-gray-300 hover:bg-gray-800"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
