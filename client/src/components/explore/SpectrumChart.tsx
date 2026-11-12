"use client";

import {
  CartesianGrid,
  ComposedChart,
  ErrorBar,
  Line,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpectrumPoint } from "@/lib/data/types";
import { useT } from "@/lib/i18n/LangProvider";

/**
 * Molecule bands from design §8.2: H₂O 3.0 μm, CH₄ 3.3 μm, CO₂ 4.27 μm, CO 4.67 μm.
 * Labels are short and alternate between two heights, so neighbouring bands never overlap.
 */
export const MOLECULE_BANDS = [
  { label: "H₂O", title: "H₂O 3.0 μm", centre: 3.0, row: 0 },
  { label: "CH₄", title: "CH₄ 3.3 μm", centre: 3.3, row: 1 },
  { label: "CO₂", title: "CO₂ 4.27 μm", centre: 4.27, row: 0 },
  { label: "CO", title: "CO 4.67 μm", centre: 4.67, row: 1 },
] as const;

const BAND_HALF_WIDTH_UM = 0.05;

/**
 * Brightness against wavelength (design §11): one marker per measurement with its error bar, joined by a
 * thin straight line (no smoothing, which would invent values between points). Client-only.
 */
export function SpectrumChart({ points }: { points: SpectrumPoint[] }) {
  const { t } = useT();
  const sorted = [...points].sort((a, b) => a.wavelengthUm - b.wavelengthUm);
  const summary = sorted.map((p) => `${p.wavelengthUm.toFixed(2)} μm ${p.flux.toFixed(2)}`).join("; ");
  return (
    <div className="h-64 w-full" role="img" aria-label={`${t("explore.spectrum")}. ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={sorted} margin={{ top: 30, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke="var(--border)" />
          {MOLECULE_BANDS.map((band) => (
            <ReferenceArea
              key={band.label}
              x1={band.centre - BAND_HALF_WIDTH_UM}
              x2={band.centre + BAND_HALF_WIDTH_UM}
              fill="var(--accent)"
              fillOpacity={0.12}
              stroke="none"
              ifOverflow="visible"
              label={{
                value: band.label,
                position: "top",
                offset: band.row === 0 ? 4 : 16,
                fill: "var(--text-secondary)",
                fontSize: 11,
              }}
            />
          ))}
          <XAxis
            dataKey="wavelengthUm"
            type="number"
            domain={[0.75, 5]}
            unit=" μm"
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            stroke="var(--border)"
          />
          <YAxis tick={{ fill: "var(--text-secondary)", fontSize: 12 }} stroke="var(--border)" width={48} />
          <Tooltip
            contentStyle={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
            labelFormatter={(value) => `${Number(value).toFixed(3)} μm`}
            formatter={(value) => [Number(value).toFixed(3), t("explore.relativeBrightness")]}
          />
          <Line
            dataKey="flux"
            type="linear"
            stroke="var(--data-1)"
            strokeWidth={1}
            dot={{ r: 3, fill: "var(--data-1)", stroke: "var(--data-1)" }}
            activeDot={{ r: 4 }}
            isAnimationActive={false}
          >
            <ErrorBar dataKey="fluxErr" width={4} strokeWidth={1} stroke="var(--data-1)" direction="y" />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
