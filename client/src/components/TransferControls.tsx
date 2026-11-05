"use client";

import type { DisplayMode, StretchKind, StretchSettings } from "@/lib/render/pixelMath";

export interface TransferControlsProps {
  mode: DisplayMode;
  onModeChange: (mode: DisplayMode) => void;
  stretch: StretchSettings;
  onStretchChange: (patch: Partial<StretchSettings>) => void;
}

const MODES: Array<{ value: DisplayMode; label: string; hint: string }> = [
  { value: "blink", label: "Blink", hint: "Show each epoch in turn" },
  { value: "coadd", label: "Co-add", hint: "Mean of all epochs — boosts SNR of faint, stationary sources" },
  { value: "diff", label: "Difference", hint: "Epoch − Epoch 1 — stars cancel to grey; movers become dipoles" },
];

const STRETCHES: Array<{ value: StretchKind; label: string }> = [
  { value: "linear", label: "Linear" },
  { value: "log", label: "Log" },
  { value: "asinh", label: "Asinh" },
  { value: "zscale", label: "ZScale" },
];

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: Array<{ value: T; label: string; title?: string }>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1 rounded-xl bg-slate-950/50 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0,1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={`min-w-0 truncate rounded-lg px-2 py-1.5 text-xs font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
            value === o.value ? "bg-cyan-500/20 text-cyan-100 ring-1 ring-cyan-400/50" : "text-slate-300 hover:bg-white/5"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export default function TransferControls({ mode, onModeChange, stretch, onStretchChange }: TransferControlsProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Image arithmetic</span>
        <Segmented label="Image arithmetic" options={MODES} value={mode} onChange={onModeChange} />
        <p className="text-[11px] leading-snug text-slate-400">{MODES.find((m) => m.value === mode)?.hint}</p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Stretch</span>
        <Segmented
          label="Stretch transfer function"
          options={STRETCHES}
          value={stretch.kind}
          onChange={(kind) => onStretchChange({ kind })}
        />
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-pressed={stretch.invert}
            onClick={() => onStretchChange({ invert: !stretch.invert })}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
              stretch.invert
                ? "border-amber-400/50 bg-amber-500/15 text-amber-100"
                : "border-white/10 bg-slate-800/50 text-slate-300 hover:bg-slate-700/60"
            }`}
          >
            Night-vision invert {stretch.invert ? "on" : "off"}
          </button>
          <button
            type="button"
            onClick={() => onStretchChange({ brightness: 0, contrast: 1 })}
            className="text-[11px] text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
          >
            Reset
          </button>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between font-mono tabular-nums">
          <span>Brightness</span>
          <span className="text-slate-400">{stretch.brightness.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={-0.5}
          max={0.5}
          step={0.01}
          value={stretch.brightness}
          onChange={(e) => onStretchChange({ brightness: Number(e.target.value) })}
          className="cursor-pointer accent-cyan-400"
        />
      </label>

      <label className="flex flex-col gap-1 text-xs text-slate-300">
        <span className="flex justify-between font-mono tabular-nums">
          <span>Contrast</span>
          <span className="text-slate-400">{stretch.contrast.toFixed(2)}×</span>
        </span>
        <input
          type="range"
          min={0.5}
          max={3}
          step={0.05}
          value={stretch.contrast}
          onChange={(e) => onStretchChange({ contrast: Number(e.target.value) })}
          className="cursor-pointer accent-cyan-400"
        />
      </label>
    </div>
  );
}
