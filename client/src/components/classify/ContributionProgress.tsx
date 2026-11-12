"use client";

import { Card } from "@/components/ui/Surfaces";

export interface ProgressStat {
  label: string;
  value: string;
}

/**
 * Progress under the contribution area: a wide bar with the percentage inside, a caption, and a row
 * of stats (for example fields checked, fields left, your total). Cobalt fill, neutral text.
 */
export function ContributionProgress({
  title,
  done,
  total,
  caption,
  stats,
}: {
  title: string;
  done: number;
  total: number;
  caption: string;
  stats: ProgressStat[];
}) {
  const pct = total > 0 ? Math.min(100, Math.max(0, Math.round((done / total) * 100))) : 0;
  return (
    <Card className="flex flex-col gap-4">
      <h3 className="font-sans text-body-sm font-semibold uppercase tracking-wide text-text-primary">
        {title}
      </h3>
      <div
        role="progressbar"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="relative h-9 overflow-hidden rounded-[var(--radius-sm)] bg-surface-2"
      >
        <div
          className="h-full bg-border-strong transition-[width] duration-[400ms] ease-[cubic-bezier(0.2,0,0,1)]"
          style={{ width: `${pct}%` }}
        />
        <span className="absolute inset-y-0 right-3 flex items-center font-mono text-body-sm tabular-nums text-text-primary">
          {pct}%
        </span>
      </div>
      <p className="-mt-2 text-right text-caption text-text-muted">{caption}</p>
      <dl className="grid grid-cols-3 gap-4 text-center">
        {stats.map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1">
            <dt className="text-caption text-text-muted">{stat.label}</dt>
            <dd className="font-display text-h4 font-medium tabular-nums text-text-primary">{stat.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
