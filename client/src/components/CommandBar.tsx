"use client";

/**
 * Top command bar: coordinate / name resolver, benchmark pills, FoV selector,
 * live transfer badge and the share button.
 */

import { useState, type FormEvent } from "react";
import { Search, Share2 } from "lucide-react";
import type { BenchmarkView } from "@/lib/api/types";
import { FOV_CHOICES, type FovChoice } from "@/lib/url-state";

export interface CommandBarProps {
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: (raw: string) => string | null;
  error: string | null;
  benchmarks: BenchmarkView[];
  activeBenchmarkId: string | null;
  onPickBenchmark: (b: BenchmarkView) => void;
  fov: FovChoice;
  onFovChange: (fov: FovChoice) => void;
  transferMB: number;
  motionTag: string;
  onShare: () => void;
  resolvedLabel: string | null;
}

export default function CommandBar({
  input,
  onInputChange,
  onSubmit,
  error,
  benchmarks,
  activeBenchmarkId,
  onPickBenchmark,
  fov,
  onFovChange,
  transferMB,
  motionTag,
  onShare,
  resolvedLabel,
}: CommandBarProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const shown = localError ?? error;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setLocalError(onSubmit(input));
  };

  return (
    <header className="flex flex-col gap-2 border-b border-white/10 bg-slate-950/80 px-4 py-2.5 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-2.5">
        <form onSubmit={handleSubmit} className="relative min-w-[220px] flex-1" role="search">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            aria-label="Coordinates or target name"
            aria-invalid={shown ? true : undefined}
            value={input}
            onChange={(e) => {
              setLocalError(null);
              onInputChange(e.target.value);
            }}
            placeholder="RA, Dec, or a target name"
            className="w-full rounded-xl border border-white/10 bg-slate-900/70 py-2 pl-9 pr-3 font-mono text-xs tabular-nums text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none focus:ring-2 focus:ring-cyan-400/30"
          />
        </form>

        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-slate-700/70"
        >
          <Share2 size={14} aria-hidden="true" />
          <span className="hidden sm:inline">Share / Embed</span>
          <span className="sr-only sm:hidden">Share or embed</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Benchmark targets" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible">
          {benchmarks.map((b) => {
            const on = activeBenchmarkId === b.id;
            return (
              <button
                key={b.id}
                type="button"
                title={b.description}
                aria-pressed={on}
                onClick={() => onPickBenchmark(b)}
                className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[11px] font-medium transition ${
                  on
                    ? "border-amber-400/60 bg-amber-500/15 text-amber-100"
                    : "border-white/10 bg-slate-900/60 text-slate-300 hover:border-white/25 hover:text-slate-100"
                }`}
              >
                {b.name}
              </button>
            );
          })}
        </div>

        <div role="group" aria-label="Field of view" className="ml-auto flex rounded-xl bg-slate-900/70 p-0.5 ring-1 ring-white/10">
          {FOV_CHOICES.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={fov === f}
              onClick={() => onFovChange(f)}
              className={`rounded-lg px-2.5 py-1 font-mono text-xs tabular-nums transition ${
                fov === f ? "bg-cyan-500/25 text-cyan-100" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {f}′
            </button>
          ))}
        </div>

        <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] tabular-nums text-emerald-200" aria-live="polite">
          ~{transferMB.toFixed(1)} MB • {motionTag}
        </span>
      </div>

      {(shown || resolvedLabel) && (
        <p className="text-[11px]" aria-live="polite">
          {shown ? (
            <span role="alert" className="text-rose-300">{shown}</span>
          ) : (
            <span className="text-slate-400">Resolved to <span className="text-cyan-200">{resolvedLabel}</span></span>
          )}
        </p>
      )}
    </header>
  );
}
