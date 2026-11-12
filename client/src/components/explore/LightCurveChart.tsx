"use client";

import {
  CartesianGrid,
  ErrorBar,
  ResponsiveContainer,
  Scatter,
  ComposedChart,
  Line,
  ReferenceDot,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/i18n/format";
import { useLang, useT } from "@/lib/i18n/LangProvider";
import { paddedRange } from "@/lib/sky/cleanSpectrum";

export interface LightPoint {
  obsDate: string;
  flux: number;
  fluxErr: number;
}

interface Row {
  t: number;
  flux: number;
  err: number;
  date: string;
}

/**
 * Brightness over time (design §8.2, §11). Points with error bars, a thin dashed connector,
 * and the current frame ringed. Client-only: loaded with next/dynamic (rules §4.2.2).
 */
export function LightCurveChart({
  points,
  current,
  caption,
}: {
  points: LightPoint[];
  current: number;
  /** Replaces the default caption, e.g. to describe real aperture photometry. */
  caption?: string;
}) {
  const { t } = useT();
  const { lang } = useLang();
  const rows: Row[] = points
    .filter((p) => Number.isFinite(p.flux))
    .map((p) => ({
      t: Date.parse(`${p.obsDate}T00:00:00Z`),
      flux: p.flux,
      err: p.fluxErr,
      date: formatDate(p.obsDate, lang),
    }));
  const currentRow = rows[Math.min(current, rows.length - 1)];
  const summary = rows.map((r) => `${r.date}: ${r.flux.toFixed(1)}`).join("; ");

  return (
    <div className="flex flex-col gap-2">
      <div className="h-56 w-full" role="img" aria-label={`${t("explore.lightCurve")}. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey="t"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(v: number) =>
                formatDate(new Date(v).toISOString().slice(0, 10), lang)
              }
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              stroke="var(--chart-grid)"
            />
            <YAxis
              dataKey="flux"
              type="number"
              domain={paddedRange(rows.map((r) => ({ wavelengthUm: 0, flux: r.flux, fluxErr: r.err })))}
              tickFormatter={(v: number) =>
                Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-US") : Number(v).toPrecision(3)
              }
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              stroke="var(--chart-grid)"
              width={56}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              labelFormatter={(v) =>
                formatDate(new Date(Number(v)).toISOString().slice(0, 10), lang)
              }
              formatter={(value) => [Number(value).toFixed(1), t("explore.brightness")]}
            />
            <Line
              dataKey="flux"
              type="linear"
              stroke="var(--data-1)"
              strokeDasharray="4 4"
              strokeWidth={1}
              dot={false}
              isAnimationActive={false}
            />
            <Scatter dataKey="flux" fill="var(--data-1)" isAnimationActive={false}>
              <ErrorBar dataKey="err" direction="y" stroke="var(--data-1)" strokeWidth={1} />
            </Scatter>
            {currentRow && (
              <ReferenceDot
                x={currentRow.t}
                y={currentRow.flux}
                r={7}
                fill="none"
                stroke="var(--primary)"
                strokeWidth={2}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <p className="text-caption text-text-muted">{caption ?? t("explore.brightnessCaption")}</p>
    </div>
  );
}
