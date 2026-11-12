"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { SpectrumPoint } from "@/lib/data/types";
import { useT } from "@/lib/i18n/LangProvider";

/** Molecule bands from design §8.2: H₂O 3.0 μm, CH₄ 3.3 μm, CO₂ 4.27 μm, CO 4.67 μm. */
export const MOLECULE_BANDS = [
  { label: "H₂O 3.0 μm", centre: 3.0 },
  { label: "CH₄ 3.3 μm", centre: 3.3 },
  { label: "CO₂ 4.27 μm", centre: 4.27 },
  { label: "CO 4.67 μm", centre: 4.67 },
] as const;

const BAND_HALF_WIDTH_UM = 0.05;

/** Relative brightness against wavelength, with shaded molecule bands (design §11). Client-only. */
export function SpectrumChart({ points }: { points: SpectrumPoint[] }) {
  const { t } = useT();
  const summary = points
    .map((p) => `${p.wavelengthUm.toFixed(2)} μm ${p.flux.toFixed(2)}`)
    .join("; ");
  return (
    <div className="h-64 w-full" role="img" aria-label={`${t("explore.spectrum")}. ${summary}`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 16, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid horizontal vertical={false} stroke="var(--border)" />
          {MOLECULE_BANDS.map((band) => (
            <ReferenceArea
              key={band.label}
              x1={band.centre - BAND_HALF_WIDTH_UM}
              x2={band.centre + BAND_HALF_WIDTH_UM}
              fill="var(--accent)"
              fillOpacity={0.14}
              stroke="none"
              label={{
                value: band.label,
                position: "insideTop",
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
          <YAxis
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            stroke="var(--border)"
            width={48}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface-3)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontSize: 12,
            }}
            formatter={(value) => [Number(value).toFixed(3), t("explore.relativeBrightness")]}
          />
          <Line
            dataKey="flux"
            type="monotone"
            stroke="var(--data-1)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
