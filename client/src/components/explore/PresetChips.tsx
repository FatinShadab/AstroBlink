"use client";

import { DataBadge } from "@/components/ui/DataBadge";
import { Chip } from "@/components/ui/Field";
import { PRESETS, isPresetReady, type PresetId } from "@/data/presets";
import { useT } from "@/lib/i18n/LangProvider";

/** The five test targets. Pending ones are shown but disabled, with a note (rules §9.3). */
export function PresetChips({
  selected,
  onSelect,
}: {
  selected: PresetId | null;
  onSelect: (id: PresetId) => void;
}) {
  const { t } = useT();
  return (
    <div role="group" aria-label={t("explore.presets")} className="flex gap-2 overflow-x-auto pb-1">
      {PRESETS.map((preset) => {
        const ready = isPresetReady(preset);
        return (
          <Chip
            key={preset.id}
            selected={selected === preset.id}
            disabled={!ready}
            title={ready ? undefined : t("explore.presetPending")}
            onClick={() => onSelect(preset.id)}
            className="shrink-0"
          >
            {preset.name}
            {ready ? (
              <DataBadge real className="ml-1" />
            ) : (
              <span className="text-caption text-text-muted">· {t("explore.presetPending")}</span>
            )}
          </Chip>
        );
      })}
    </div>
  );
}
