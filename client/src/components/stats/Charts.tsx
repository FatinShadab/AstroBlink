"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDate } from "@/lib/i18n/format";
import { useLang } from "@/lib/i18n/LangProvider";

const AXIS = { fill: "var(--text-secondary)", fontSize: 12 };
const TOOLTIP = {
  background: "var(--surface-3)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--text-primary)",
  fontSize: 12,
};

/** Bars per day (design §8.8, last 14 days). Client-only. */
export function ActivityChart({
  data,
  label,
}: {
  data: { date: string; count: number }[];
  label: string;
}) {
  const { lang } = useLang();
  return (
    <div className="h-56 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis
            dataKey="date"
            tick={AXIS}
            stroke="var(--chart-grid)"
            tickFormatter={(v: string) => formatDate(v, lang)}
            minTickGap={24}
          />
          <YAxis allowDecimals={false} tick={AXIS} stroke="var(--chart-grid)" width={32} />
          <Tooltip contentStyle={TOOLTIP} labelFormatter={(v) => formatDate(String(v), lang)} />
          <Bar
            dataKey="count"
            fill="var(--data-1)"
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Classifications per month, with an area fill (design §11, community). Demo data. */
export function MonthlyChart({
  data,
  label,
}: {
  data: { month: string; classifications: number }[];
  label: string;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="month" tick={AXIS} stroke="var(--chart-grid)" />
          <YAxis tick={AXIS} stroke="var(--chart-grid)" width={48} />
          <Tooltip contentStyle={TOOLTIP} />
          <Area
            type="monotone"
            dataKey="classifications"
            stroke="var(--data-1)"
            fill="var(--data-1)"
            fillOpacity={0.1}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal bars by project (design §11). */
export function ProjectBars({
  data,
  label,
}: {
  data: { name: string; value: number }[];
  label: string;
}) {
  return (
    <div className="h-64 w-full" role="img" aria-label={label}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
          <XAxis type="number" allowDecimals={false} tick={AXIS} stroke="var(--chart-grid)" />
          <YAxis type="category" dataKey="name" tick={AXIS} stroke="var(--chart-grid)" width={150} />
          <Tooltip contentStyle={TOOLTIP} />
          <Bar
            dataKey="value"
            fill="var(--data-1)"
            radius={[0, 4, 4, 0]}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
