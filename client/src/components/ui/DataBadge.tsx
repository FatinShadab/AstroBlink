"use client";

import { useT } from "@/lib/i18n/LangProvider";
import { cn } from "@/lib/utils/cn";

/**
 * Where the pixels come from: "Real NASA data" (cyan, tinted background) for real SPHEREx observations,
 * "Simulated sky" (muted grey) for the simulated sky. Used in Explore, Embed and the target chips.
 */
export function DataBadge({ real, className }: { real: boolean; className?: string }) {
  const { t } = useT();
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium",
        real ? "bg-badge-real-bg text-badge-real" : "bg-badge-sim-bg text-badge-sim",
        className,
      )}
    >
      {real ? t("common.realData") : t("common.simulatedSky")}
    </span>
  );
}
