"use client";

import { Badge, Card } from "@/components/ui/Surfaces";
import type { Preset } from "@/data/presets";
import { useT } from "@/lib/i18n/LangProvider";

/** Explainer for the current target (design §8.2 object card). */
export function ObjectCard({ preset }: { preset: Preset | null }) {
  const { t } = useT();
  if (!preset) {
    return (
      <Card className="flex flex-col gap-2">
        <h3 className="text-h3 font-medium text-text-primary">{t("explore.customSpot")}</h3>
        <p className="text-body-sm text-text-secondary">{t("explore.customBody")}</p>
      </Card>
    );
  }
  const kindLabel = t(preset.kind === "mover" ? "explore.kind.mover" : "explore.kind.variable");
  return (
    <Card className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={preset.kind === "mover" ? "primary" : "warning"}>{kindLabel}</Badge>
      </div>
      <h3 className="text-h3 font-medium text-text-primary">{preset.name}</h3>
      <p className="text-body-sm text-text-secondary">{t(preset.descriptionKey)}</p>
      <p className="text-body-sm text-text-primary">
        <span className="font-medium">{t("explore.lookFor")}: </span>
        {t(preset.lookKey)}
      </p>
    </Card>
  );
}
