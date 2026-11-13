"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { visibleLabels } from "./timelineLabels";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useLang, useT } from "@/lib/i18n/LangProvider";
import { formatDate, formatMonthYear } from "@/lib/i18n/format";
import type { BlinkFps } from "@/lib/state/useUserStore";
import type { FrameMeta } from "@/lib/data/types";
import { cn } from "@/lib/utils/cn";

const SPEEDS = [
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
] as const;

/** Space a month-year label needs ("Sept ’26" in the caption size), plus a small gap. */
const LABEL_MIN_GAP_PX = 64;

interface PlayerBarProps {
  frames: FrameMeta[];
  index: number;
  playing: boolean;
  fps: BlinkFps;
  onPrev: () => void;
  onNext: () => void;
  onTogglePlay: () => void;
  onSelect: (index: number) => void;
  onSpeed: (fps: BlinkFps) => void;
}

/**
 * Player: prev, play/pause, next (44px targets), a timeline with one dot per frame placed by date,
 * and a speed control (design §10).
 */
export function PlayerBar(props: PlayerBarProps) {
  const { frames, index, playing, fps, onPrev, onNext, onTogglePlay, onSelect, onSpeed } = props;
  const { t } = useT();
  const { lang } = useLang();
  const count = frames.length;
  const times = frames.map((f) => Date.parse(`${f.obsDate}T00:00:00Z`));
  const min = count ? Math.min(...times) : 0;
  const max = count ? Math.max(...times) : 0;
  const position = (i: number) => {
    if (count <= 1 || max === min) return 50;
    return ((times[i] - min) / (max - min)) * 100;
  };

  // Date labels: all of them unless two would overlap; then only first, middle and last.
  const timelineRef = useRef<HTMLDivElement>(null);
  const [timelineWidth, setTimelineWidth] = useState(0);
  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setTimelineWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const labelled = visibleLabels(
    frames.map((_, i) => (position(i) / 100) * timelineWidth),
    LABEL_MIN_GAP_PX,
  );

  return (
    <div className="flex flex-col gap-3 border-t border-border bg-surface-1 px-3 py-3 md:px-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="icon"
            aria-label={t("explore.prevFrame")}
            onClick={onPrev}
            disabled={count < 2}
          >
            <SkipBack aria-hidden="true" className="size-5" />
          </Button>
          <Button
            variant="icon"
            aria-label={playing ? t("explore.pause") : t("explore.play")}
            aria-pressed={playing}
            onClick={onTogglePlay}
            disabled={count < 2}
          >
            {playing ? (
              <Pause aria-hidden="true" className="size-5" />
            ) : (
              <Play aria-hidden="true" className="size-5" />
            )}
          </Button>
          <Button
            variant="icon"
            aria-label={t("explore.nextFrame")}
            onClick={onNext}
            disabled={count < 2}
          >
            <SkipForward aria-hidden="true" className="size-5" />
          </Button>
        </div>

        <div
          ref={timelineRef}
          role="group"
          aria-label={t("explore.timeline")}
          className="relative h-11 min-w-[200px] flex-1"
        >
          <div className="absolute top-1/2 right-0 left-0 h-px -translate-y-1/2 bg-border-strong" />
          {frames.map((frame, i) => {
            const selected = i === index;
            return (
              <button
                key={frame.id}
                type="button"
                onClick={() => onSelect(i)}
                aria-label={formatDate(frame.obsDate, lang)}
                aria-current={selected ? "step" : undefined}
                className="absolute top-0 flex h-11 w-11 -translate-x-1/2 flex-col items-center justify-center"
                style={{ left: `${position(i)}%` }}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "block rounded-full",
                    selected
                      ? "size-3 bg-primary"
                      : "size-2 border border-border-strong bg-surface-3",
                  )}
                />
                {labelled.has(i) && (
                  <span
                    aria-hidden="true"
                    className="absolute top-8 text-caption whitespace-nowrap text-text-muted"
                  >
                    {formatMonthYear(frame.obsDate, lang)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-caption text-text-muted">{t("explore.speed")}</span>
          <SegmentedControl<string>
            label={t("explore.speed")}
            options={SPEEDS}
            value={String(fps)}
            onChange={(v) => onSpeed(Number(v) as BlinkFps)}
          />
        </div>
      </div>
    </div>
  );
}
