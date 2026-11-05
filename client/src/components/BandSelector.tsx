"use client";

/**
 * BandSelector — SPHEREx spectral controls.
 *
 *  - Six detector arrays, an all-array stack, and a false-colour RGB composite.
 *  - A 102-channel narrow-band scrubber (0.75–5.00 µm) with molecular markers.
 */

import {
  CHANNEL_COUNT,
  LAMBDA_MAX_UM,
  LAMBDA_MIN_UM,
  MOLECULAR_BANDS,
  SPHEREX_ARRAYS,
  WAVELENGTHS_UM,
  channelForWavelength,
  type ArrayId,
  type BandKey,
} from "@/lib/mock/spherexMockEngine";

export interface BandSelectorProps {
  band: BandKey;
  onBandChange: (band: BandKey) => void;
  rgb: [ArrayId, ArrayId, ArrayId];
  onRgbChange: (rgb: [ArrayId, ArrayId, ArrayId]) => void;
}

const SEG_BTN =
  "min-w-0 rounded-lg px-2.5 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";
const SEG_ON = "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/60";
const SEG_OFF = "text-slate-300 hover:bg-white/5";

export function bandLabel(band: BandKey, rgb: [ArrayId, ArrayId, ArrayId]): string {
  if (band === "stack") return "All-array stack";
  if (band === "rgb") return `RGB · A${rgb[0]}/A${rgb[1]}/A${rgb[2]}`;
  if (band.startsWith("ch")) {
    const i = Number(band.slice(2));
    return `λ ${WAVELENGTHS_UM[i]?.toFixed(3)} µm`;
  }
  return `Array ${band.slice(1)}`;
}

const TRACK_MIN = LAMBDA_MIN_UM;
const TRACK_SPAN = LAMBDA_MAX_UM - LAMBDA_MIN_UM;

function pctOf(um: number): number {
  return ((um - TRACK_MIN) / TRACK_SPAN) * 100;
}

export default function BandSelector({ band, onBandChange, rgb, onRgbChange }: BandSelectorProps) {
  const channelIndex = band.startsWith("ch") ? Number(band.slice(2)) : channelForWavelength(1.6);
  const activeWavelength = WAVELENGTHS_UM[channelIndex];
  const isNarrow = band.startsWith("ch");

  return (
    <div className="flex w-full flex-col gap-3">
      <div role="group" aria-label="Detector array selector" className="grid grid-cols-4 gap-1 rounded-xl bg-slate-950/50 p-1 sm:grid-cols-8">
        {[
          { key: "stack" as BandKey, label: "Stack" },
          ...SPHEREX_ARRAYS.map((a) => ({ key: `a${a.id}` as BandKey, label: `A${a.id}`, title: a.label })),
          { key: "rgb" as BandKey, label: "RGB" },
        ].map((b) => {
          const on = band === b.key;
          return (
            <button
              key={b.key}
              type="button"
              aria-pressed={on}
              title={"title" in b ? b.title : undefined}
              onClick={() => onBandChange(b.key)}
              className={`${SEG_BTN} ${on ? SEG_ON : SEG_OFF}`}
            >
              {b.label}
            </button>
          );
        })}
      </div>

      {band === "rgb" && (
        <div className="grid grid-cols-3 gap-2 text-xs text-slate-300">
          {(["R", "G", "B"] as const).map((ch, idx) => (
            <label key={ch} className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/50 px-2 py-1.5">
              <span className="font-mono font-semibold text-slate-100">{ch}</span>
              <select
                aria-label={`${ch} channel array`}
                value={rgb[idx]}
                onChange={(e) => {
                  const next = [...rgb] as [ArrayId, ArrayId, ArrayId];
                  next[idx] = Number(e.target.value) as ArrayId;
                  onRgbChange(next);
                }}
                className="min-w-0 rounded-md border border-white/10 bg-slate-900 px-1.5 py-0.5 text-slate-100"
              >
                {SPHEREX_ARRAYS.map((a) => (
                  <option key={a.id} value={a.id}>
                    Array {a.id}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-medium text-slate-300">Narrow-band scrubber</span>
          <span className="font-mono tabular-nums text-cyan-200">
            {isNarrow ? `λ ${activeWavelength.toFixed(4)} µm · ch ${channelIndex + 1}/${CHANNEL_COUNT}` : "Select a channel to scrub"}
          </span>
        </div>

        <div className="relative pb-6 pt-3">
          {/* Array-coloured track */}
          <div
            className="h-2 w-full rounded-full"
            style={{
              background:
                "linear-gradient(90deg, #38BDF8 0%, #38BDF8 " +
                pctOf(1.1) +
                "%, #10B981 " +
                pctOf(1.1) +
                "%, #10B981 " +
                pctOf(1.6) +
                "%, #F59E0B " +
                pctOf(1.6) +
                "%, #F59E0B " +
                pctOf(2.4) +
                "%, #EF4444 " +
                pctOf(2.4) +
                "%, #EF4444 100%)",
              opacity: 0.55,
            }}
            aria-hidden="true"
          />

          {/* Molecular absorption markers */}
          {MOLECULAR_BANDS.flatMap((m) =>
            m.ranges.map(([lo, hi]) => (
              <span
                key={`${m.id}-${lo}`}
                title={m.label}
                className="absolute top-2.5 h-2 rounded-sm bg-violet-400/80"
                style={{ left: `${pctOf(lo)}%`, width: `${pctOf(hi) - pctOf(lo)}%` }}
                aria-hidden="true"
              />
            )),
          )}

          <input
            type="range"
            aria-label="Wavelength channel"
            min={0}
            max={CHANNEL_COUNT - 1}
            step={1}
            value={channelIndex}
            onChange={(e) => onBandChange(`ch${Number(e.target.value)}` as BandKey)}
            className="absolute inset-x-0 top-1.5 h-4 w-full cursor-pointer appearance-none bg-transparent accent-cyan-400"
          />

          <div className="pointer-events-none absolute inset-x-0 top-9 flex justify-between font-mono text-[10px] text-slate-500">
            <span>{LAMBDA_MIN_UM.toFixed(2)} µm</span>
            <span>2.40</span>
            <span>{LAMBDA_MAX_UM.toFixed(2)} µm</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 text-[10px]">
          {MOLECULAR_BANDS.map((m) => (
            <span key={m.id} className="rounded-full border border-violet-400/30 bg-violet-500/10 px-2 py-0.5 text-violet-200">
              {m.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
