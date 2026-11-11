"use client";

import { Maximize2, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";
import { VIEW_MODES } from "@/lib/state/viewerParams";
import type { ViewMode } from "@/lib/data/types";

/** Only Blink works in this phase. The other modes arrive in Phase 3 and stay disabled until then. */
const LIVE_MODES: readonly ViewMode[] = ["blink"];

export function ViewerToolbar({
  mode,
  onMode,
  zoomLabel,
  onZoomIn,
  onZoomOut,
  onFit,
}: {
  mode: ViewMode;
  onMode: (mode: ViewMode) => void;
  zoomLabel: string;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
}) {
  const { t } = useT();
  const options = VIEW_MODES.map((value) => ({
    value,
    label: t(`explore.mode.${value}` as DictKey),
    disabled: !LIVE_MODES.includes(value),
  }));

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <SegmentedControl<ViewMode>
        label={t("explore.modeLabel")}
        options={options}
        value={mode}
        onChange={onMode}
      />
      <div className="flex items-center gap-1">
        <span className="mr-2 font-mono text-mono tabular-nums text-text-secondary">
          {zoomLabel}
        </span>
        <Button variant="icon" aria-label={t("explore.zoomOut")} onClick={onZoomOut}>
          <Minus aria-hidden="true" className="size-5" />
        </Button>
        <Button variant="icon" aria-label={t("explore.zoomIn")} onClick={onZoomIn}>
          <Plus aria-hidden="true" className="size-5" />
        </Button>
        <Button variant="icon" aria-label={t("explore.fit")} onClick={onFit}>
          <Maximize2 aria-hidden="true" className="size-5" />
        </Button>
      </div>
    </div>
  );
}
