"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import type { EpochView } from "@/lib/api/types";
import type { LoopMode } from "@/lib/url-state";

export interface PlaybackControlsProps {
  playing: boolean;
  onTogglePlay: () => void;
  onStep: (delta: number) => void;
  speed: number;
  onSpeedChange: (fps: number) => void;
  loop: LoopMode;
  onLoopChange: (loop: LoopMode) => void;
  epochIndex: number;
  onEpochChange: (index: number) => void;
  epochs: EpochView[];
  compact?: boolean;
}

const BTN = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-slate-800/60 text-slate-200 transition hover:bg-slate-700/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400";

export default function PlaybackControls({
  playing,
  onTogglePlay,
  onStep,
  speed,
  onSpeedChange,
  loop,
  onLoopChange,
  epochIndex,
  onEpochChange,
  epochs,
  compact = false,
}: PlaybackControlsProps) {
  const current = epochs[epochIndex];
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={BTN} onClick={() => onStep(-1)} aria-label="Previous epoch">
          <SkipBack size={16} />
        </button>
        <button
          type="button"
          className={`${BTN} h-10 w-10 border-cyan-400/50 bg-cyan-500/20 text-cyan-100`}
          onClick={onTogglePlay}
          aria-label={playing ? "Pause blink" : "Play blink"}
          aria-pressed={playing}
        >
          {playing ? <Pause size={18} /> : <Play size={18} />}
        </button>
        <button type="button" className={BTN} onClick={() => onStep(1)} aria-label="Next epoch">
          <SkipForward size={16} />
        </button>

        <div className="ml-1 flex min-w-0 flex-1 items-center gap-2">
          <span className="font-mono text-[11px] text-slate-400">{speed.toFixed(1)} fps</span>
          <input
            type="range"
            aria-label="Playback speed"
            min={0.5}
            max={10}
            step={0.5}
            value={speed}
            onChange={(e) => onSpeedChange(Number(e.target.value))}
            className="h-1 min-w-0 flex-1 cursor-pointer accent-cyan-400"
          />
        </div>

        {!compact && (
          <div role="group" aria-label="Loop mode" className="flex rounded-lg bg-slate-950/60 p-0.5 text-xs">
            {(
              [
                ["forward", "Forward"],
                ["pingpong", "Ping-pong"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={loop === value}
                onClick={() => onLoopChange(value)}
                className={`rounded-md px-2.5 py-1 transition ${
                  loop === value ? "bg-cyan-500/20 text-cyan-100" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Epoch timeline scrubber */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-2 font-mono text-[11px] tabular-nums text-slate-300">
          <span className="text-cyan-200">{current ? current.iso_date : "—"}</span>
          <span className="text-slate-400">MJD {current ? current.mjd.toFixed(1) : "—"}</span>
        </div>
        <div className="relative">
          <input
            type="range"
            aria-label="Epoch timeline"
            min={0}
            max={Math.max(0, epochs.length - 1)}
            step={1}
            value={epochIndex}
            onChange={(e) => onEpochChange(Number(e.target.value))}
            className="w-full cursor-pointer accent-amber-400"
          />
        </div>
        <div className="flex justify-between font-mono text-[10px] text-slate-500">
          {epochs.map((e) => (
            <button
              key={e.index}
              type="button"
              onClick={() => onEpochChange(e.index)}
              className={`rounded px-1 transition ${e.index === epochIndex ? "text-amber-300" : "hover:text-slate-300"}`}
            >
              {e.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
