"use client";

import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  ReferenceArea,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpectrumPoint } from "@/lib/data/types";
import { useT } from "@/lib/i18n/LangProvider";
import { fill } from "@/lib/i18n/format";
import { cleanSpectrum, paddedRange } from "@/lib/sky/cleanSpectrum";

/**
 * Molecule bands from design §8.2: H₂O 3.0 μm, CH₄ 3.3 μm, CO₂ 4.27 μm, CO 4.67 μm.
 * Short labels on two alternating rows, so neighbouring bands never overlap.
 */
export const MOLECULE_BANDS = [
  { label: "H₂O", centre: 3.0, row: 0 },
  { label: "CH₄", centre: 3.3, row: 1 },
  { label: "CO₂", centre: 4.27, row: 0 },
  { label: "CO", centre: 4.67, row: 1 },
] as const;

const BAND_HALF_WIDTH_UM = 0.05;

/** Axis numbers without scientific notation: whole numbers from 100 up, three significant digits below. */
function formatFlux(v: number): string {
  const n = Number(v);
  return Math.abs(n) >= 100 ? Math.round(n).toLocaleString("en-US") : n.toPrecision(3);
}

/**
 * Brightness against wavelength (design §11). Markers only: no connecting line and no smoothing, which
 * would invent values between measurements. Clear outliers are removed first (cleanSpectrum), the y-axis
 * fits the data with ~10% padding so nothing draws outside the chart, and both axes carry units.
 */
export function SpectrumChart({ points, unit }: { points: SpectrumPoint[]; unit: string }) {
  const { t } = useT();
  const { kept, dropped } = cleanSpectrum(points);
  const domain = paddedRange(kept);
  const summary = kept.map((p) => `${p.wavelengthUm.toFixed(2)} μm ${p.flux.toPrecision(3)} ${unit}`).join("; ");
  return (
    <div className="flex flex-col gap-1">
      <div className="h-64 w-full" role="img" aria-label={`${t("explore.spectrum")}. ${summary}`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={kept} margin={{ top: 34, right: 16, bottom: 18, left: 8 }}>
            <CartesianGrid horizontal vertical={false} stroke="var(--chart-grid)" />
            {MOLECULE_BANDS.map((band) => (
              <ReferenceArea
                key={band.label}
                x1={band.centre - BAND_HALF_WIDTH_UM}
                x2={band.centre + BAND_HALF_WIDTH_UM}
                y1={domain[0]}
                y2={domain[1]}
                fill="var(--accent)"
                fillOpacity={0.08}
                stroke="none"
                ifOverflow="hidden"
                label={{
                  value: band.label,
                  position: "top",
                  offset: band.row === 0 ? 4 : 18,
                  fill: "var(--text-secondary)",
                  fontSize: 11,
                }}
              />
            ))}
            <XAxis
              dataKey="wavelengthUm"
              type="number"
              domain={[0.75, 5]}
              tickFormatter={(v: number) => v.toFixed(1)}
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              stroke="var(--chart-grid)"
              label={{
                value: t("explore.axisWavelength"),
                position: "insideBottom",
                offset: -12,
                fill: "var(--text-muted)",
                fontSize: 12,
              }}
            />
            <YAxis
              dataKey="flux"
              type="number"
              domain={domain}
              allowDataOverflow={false}
              tickFormatter={formatFlux}
              tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
              stroke="var(--chart-grid)"
              width={64}
              label={{
                value: unit,
                angle: -90,
                position: "insideLeft",
                fill: "var(--text-muted)",
                fontSize: 12,
                style: { textAnchor: "middle" },
              }}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                color: "var(--text-primary)",
                fontSize: 12,
              }}
              labelFormatter={(value) => `${Number(value).toFixed(3)} μm`}
              formatter={(value) => [`${Number(value).toPrecision(4)} ${unit}`, t("explore.relativeBrightness")]}
            />
            <Scatter dataKey="flux" fill="var(--data-1)" isAnimationActive={false}>
              <ErrorBar dataKey="fluxErr" width={4} strokeWidth={1} stroke="var(--data-1)" direction="y" />
            </Scatter>
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      {dropped > 0 && (
        <p className="text-caption text-text-muted">{fill(t("explore.spectrumDropped"), { count: dropped })}</p>
      )}
    </div>
  );
}
