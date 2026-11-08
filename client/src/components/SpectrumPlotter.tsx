"use client";

/**
 * SpectrumPlotter — 102-band spectrophotometry drawer.
 *
 * Renders observed flux (µJy) against wavelength (µm) as a 2D SVG chart, with
 * molecular absorption regions, per-epoch comparison and template overlays.
 */

import { useMemo, useState, type PointerEvent } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { SpectrumResponse } from "@/lib/api/types";
import {
  COMPARISON_TEMPLATES,
  MOLECULAR_BANDS,
  TEMPLATE_LABELS,
  TEMPLATE_REF_UM,
  WAVELENGTHS_UM,
  templateSpectrum,
  type TemplateId,
} from "@/lib/mock/spherexMockEngine";

export interface EpochSpectrum {
  epochIndex: number;
  label: string;
  spectrum: SpectrumResponse | null;
}

export interface SpectrumPlotterProps {
  open: boolean;
  onToggleOpen: () => void;
  onClose: () => void;
  pixel: { x: number; y: number } | null;
  ra: number | null;
  dec: number | null;
  epochSpectra: EpochSpectrum[];
  loading?: boolean;
  visibleEpochs: boolean[];
  onToggleEpoch: (index: number) => void;
  templates: TemplateId[];
  onToggleTemplate: (id: TemplateId) => void;
}

const EPOCH_COLORS = ["#38BDF8", "#F59E0B", "#10B981", "#F472B6"];
const TEMPLATE_COLORS: Record<TemplateId, string> = {
  t_dwarf: "#A78BFA",
  y_dwarf: "#C4B5FD",
  m_dwarf: "#FB7185",
  star: "#FCD34D",
  comet: "#67E8F9",
  quasar: "#F9A8D4",
};

const W = 900;
const H = 320;
const M = { l: 62, r: 18, t: 16, b: 44 };
const X_MIN = 0.75;
const X_MAX = 5.0;

function xOf(um: number): number {
  return M.l + ((um - X_MIN) / (X_MAX - X_MIN)) * (W - M.l - M.r);
}

export default function SpectrumPlotter({
  open,
  onToggleOpen,
  onClose,
  pixel,
  ra,
  dec,
  epochSpectra,
  loading = false,
  visibleEpochs,
  onToggleEpoch,
  templates,
  onToggleTemplate,
}: SpectrumPlotterProps) {
  const [hover, setHover] = useState<number | null>(null);

  const series = useMemo(() => {
    const observed = epochSpectra
      .filter((e) => visibleEpochs[e.epochIndex] && e.spectrum)
      .map((e) => ({
        key: `epoch-${e.epochIndex}`,
        label: e.label,
        color: EPOCH_COLORS[e.epochIndex % EPOCH_COLORS.length],
        flux: e.spectrum!.flux_ujy,
        dashed: false,
      }));
    // Scale templates to the observed flux at the reference wavelength so their shapes can be compared directly.
    const ref = epochSpectra.find((e) => e.spectrum)?.spectrum;
    const refIdx = WAVELENGTHS_UM.findIndex((w) => w >= TEMPLATE_REF_UM);
    const scale = ref && refIdx >= 0 ? Math.max(5, ref.flux_ujy[refIdx]) : 100;
    const tpl = templates.map((id) => ({
      key: `tpl-${id}`,
      label: TEMPLATE_LABELS[id],
      color: TEMPLATE_COLORS[id],
      flux: templateSpectrum(id, scale),
      dashed: true,
    }));
    return [...observed, ...tpl];
  }, [epochSpectra, visibleEpochs, templates]);

  const yMax = useMemo(() => {
    let m = 10;
    for (const s of series) for (const v of s.flux) if (v > m) m = v;
    return m * 1.1;
  }, [series]);
  const yMin = useMemo(() => {
    let m = 0;
    for (const s of series) for (const v of s.flux) if (v < m) m = v;
    return m;
  }, [series]);
  const yOf = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - M.t - M.b);

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const vx = ((e.clientX - rect.left) / rect.width) * W;
    const um = X_MIN + ((vx - M.l) / (W - M.l - M.r)) * (X_MAX - X_MIN);
    if (um < X_MIN || um > X_MAX) return setHover(null);
    let best = 0;
    WAVELENGTHS_UM.forEach((w, i) => {
      if (Math.abs(w - um) < Math.abs(WAVELENGTHS_UM[best] - um)) best = i;
    });
    setHover(best);
  };

  const hasData = epochSpectra.some((e) => e.spectrum);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => yMin + t * (yMax - yMin));

  return (
    <section
      aria-label="Spectrophotometry"
      className="pointer-events-auto flex max-h-[55vh] flex-col overflow-y-auto rounded-t-2xl border border-b-0 border-white/10 bg-slate-950/90 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.9)] backdrop-blur-xl lg:max-h-[38vh]"
    >
      <header className="flex flex-wrap items-center gap-2 px-4 py-2.5">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex items-center gap-2 text-left"
        >
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          <span className="text-sm font-semibold text-slate-100">102-band spectrophotometry</span>
        </button>
        <span className="font-mono text-[11px] tabular-nums text-slate-400">
          {pixel && ra !== null && dec !== null
            ? `px (${Math.floor(pixel.x)}, ${Math.floor(pixel.y)}) · RA ${ra.toFixed(5)}° · Dec ${dec.toFixed(5)}°`
            : "Click the image to load a spectrum"}
        </span>
        <button type="button" onClick={onClose} aria-label="Close spectrum drawer" className="ml-auto rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-slate-100">
          <X size={15} />
        </button>
      </header>

      {open && (
        <div className="grid gap-3 px-4 pb-4 lg:grid-cols-[1fr_220px]">
          <div className="min-w-0">
            {hasData ? (
              <svg
                viewBox={`0 0 ${W} ${H}`}
                className="h-auto w-full touch-none"
                role="img"
                aria-label="Flux versus wavelength chart"
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
              >
                {MOLECULAR_BANDS.flatMap((m) =>
                  m.ranges.map(([lo, hi]) => (
                    <g key={`${m.id}-${lo}`}>
                      <rect x={xOf(lo)} y={M.t} width={xOf(hi) - xOf(lo)} height={H - M.t - M.b} fill="#8B5CF6" opacity={0.12} />
                      <text x={(xOf(lo) + xOf(hi)) / 2} y={M.t + 11} textAnchor="middle" fontSize={11} fill="#C4B5FD" opacity={0.85}>
                        {m.id}
                      </text>
                    </g>
                  )),
                )}

                {yTicks.map((v) => (
                  <g key={v}>
                    <line x1={M.l} x2={W - M.r} y1={yOf(v)} y2={yOf(v)} stroke="#fff" strokeOpacity={0.07} />
                    <text x={M.l - 8} y={yOf(v) + 4} textAnchor="end" fontSize={11} fill="#94A3B8" className="font-mono">
                      {v.toFixed(0)}
                    </text>
                  </g>
                ))}
                {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((um) => (
                  <g key={um}>
                    <line x1={xOf(um)} x2={xOf(um)} y1={M.t} y2={H - M.b} stroke="#fff" strokeOpacity={0.05} />
                    <text x={xOf(um)} y={H - M.b + 16} textAnchor="middle" fontSize={11} fill="#94A3B8" className="font-mono">
                      {um.toFixed(1)}
                    </text>
                  </g>
                ))}
                <text x={W / 2} y={H - 6} textAnchor="middle" fontSize={12} fill="#CBD5E1">
                  Wavelength (µm)
                </text>
                <text transform={`translate(14 ${H / 2}) rotate(-90)`} textAnchor="middle" fontSize={12} fill="#CBD5E1">
                  Flux density (µJy)
                </text>

                {series.map((s) => {
                  const d = s.flux.map((v, i) => `${i === 0 ? "M" : "L"}${xOf(WAVELENGTHS_UM[i]).toFixed(1)},${yOf(v).toFixed(1)}`).join(" ");
                  return (
                    <path
                      key={s.key}
                      d={d}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={s.dashed ? 1.5 : 2}
                      strokeDasharray={s.dashed ? "6 4" : undefined}
                      strokeLinejoin="round"
                    />
                  );
                })}

                {hover !== null && (
                  <g>
                    <line x1={xOf(WAVELENGTHS_UM[hover])} x2={xOf(WAVELENGTHS_UM[hover])} y1={M.t} y2={H - M.b} stroke="#fff" strokeOpacity={0.4} />
                    {series
                      .filter((s) => !s.dashed)
                      .map((s) => (
                        <circle key={s.key} cx={xOf(WAVELENGTHS_UM[hover])} cy={yOf(s.flux[hover])} r={3.5} fill={s.color} />
                      ))}
                    <text x={Math.min(xOf(WAVELENGTHS_UM[hover]) + 8, W - 200)} y={M.t + 26} fontSize={12} fill="#F1F5F9" className="font-mono">
                      λ {WAVELENGTHS_UM[hover].toFixed(4)} µm · ch {hover + 1}
                    </text>
                  </g>
                )}
              </svg>
            ) : (
              <div className="flex h-24 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-white/10 px-4 text-center text-sm text-slate-400">
                {loading ? (
                  "Reading spectrum…"
                ) : pixel ? (
                  <>
                    <span className="text-slate-200">No spectrophotometry for this pixel</span>
                    <span className="text-xs text-slate-500">102-band photometry appears once SPHEREx data is connected.</span>
                  </>
                ) : (
                  "Click the image to inspect a pixel."
                )}
              </div>
            )}
          </div>

          <aside className="flex flex-col gap-3 text-xs text-slate-300">
            <div className="flex flex-col gap-1.5">
              <span className="font-medium uppercase tracking-wider text-[10px] text-slate-400">Epochs</span>
              {epochSpectra.map((e) => (
                <label key={e.epochIndex} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={visibleEpochs[e.epochIndex]}
                    onChange={() => onToggleEpoch(e.epochIndex)}
                    className="accent-cyan-400"
                  />
                  <span className="h-2 w-2 rounded-full" style={{ background: EPOCH_COLORS[e.epochIndex % EPOCH_COLORS.length] }} />
                  <span>{e.label}</span>
                </label>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="font-medium uppercase tracking-wider text-[10px] text-slate-400">Template comparison</span>
              {COMPARISON_TEMPLATES.map((id) => (
                <label key={id} className="flex items-center gap-2">
                  <input type="checkbox" checked={templates.includes(id)} onChange={() => onToggleTemplate(id)} className="accent-violet-400" />
                  <span className="h-0.5 w-3 border-t border-dashed" style={{ borderColor: TEMPLATE_COLORS[id] }} />
                  <span>{TEMPLATE_LABELS[id]}</span>
                </label>
              ))}
            </div>

            <p className="text-[10px] leading-snug text-slate-500">
              Templates are scaled to the observed flux at 3.5 µm. Shaded regions mark H₂O, CH₄, CO₂, CO and PAH features.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}
