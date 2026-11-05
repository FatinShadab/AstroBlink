"use client";

import { MASK_COLORS } from "@/lib/render/pixelMath";
import type { OverlayFlags } from "@/lib/url-state";

export interface OverlayControlsProps {
  overlays: OverlayFlags;
  onChange: (key: keyof OverlayFlags, value: boolean) => void;
  /** Number of Gaia / WISE sources currently available, for the badges. */
  counts?: { gaia: number; wise: number; wiseInFrame: number };
  maskWarning?: boolean;
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  badge,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  badge?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-lg px-1 py-1.5 transition hover:bg-white/5">
      <span className="min-w-0">
        <span className="flex items-center gap-2 text-xs font-medium text-slate-100">
          {label}
          {badge && <span className="rounded bg-slate-800 px-1.5 py-px font-mono text-[10px] text-slate-300">{badge}</span>}
        </span>
        <span className="block text-[11px] leading-snug text-slate-400">{description}</span>
      </span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 accent-cyan-400"
      />
    </label>
  );
}

export default function OverlayControls({ overlays, onChange, counts, maskWarning }: OverlayControlsProps) {
  return (
    <div className="flex flex-col gap-1">
      <Toggle
        label="Gaia DR3"
        description="Cyan circles with proper-motion direction arrows (arrows scaled for visibility)."
        checked={overlays.gaia}
        onChange={(v) => onChange("gaia", v)}
        badge={counts ? `${counts.gaia}` : undefined}
      />
      <Toggle
        label="WISE / AllWISE"
        description="Amber diamonds at 2010–2024 positions with dashed drift lines to the 2025–26 epochs."
        checked={overlays.wise}
        onChange={(v) => onChange("wise", v)}
        badge={counts ? `${counts.wiseInFrame}/${counts.wise} in frame` : undefined}
      />
      <Toggle
        label="Contamination mask"
        description="SPHEREx bitmask: cosmic rays, saturation, stray light, dead / hot pixels."
        checked={overlays.mask}
        onChange={(v) => onChange("mask", v)}
      />
      {overlays.mask && (
        <ul className="ml-1 mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-300">
          {MASK_COLORS.map((m) => (
            <li key={m.bit} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: `rgb(${m.rgb.join(",")})` }}
                aria-hidden="true"
              />
              {m.label}
            </li>
          ))}
        </ul>
      )}
      {overlays.mask && maskWarning && (
        <p role="status" className="mt-1 rounded-md border border-rose-400/30 bg-rose-500/10 px-2 py-1.5 text-[11px] text-rose-200">
          Flagged pixels in this view — check the mask before classifying a source as real.
        </p>
      )}
      <Toggle
        label="WCS grid"
        description="RA / Dec graticule aligned to the frame's world coordinates."
        checked={overlays.grid}
        onChange={(v) => onChange("grid", v)}
      />
      <Toggle
        label="Compass rose"
        description="North up, East left."
        checked={overlays.compass}
        onChange={(v) => onChange("compass", v)}
      />
    </div>
  );
}
