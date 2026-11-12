"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { useT } from "@/lib/i18n/LangProvider";
import { AdvancedToolsPanel, type AdvancedProps } from "./AdvancedToolsPanel";

/**
 * The advanced features, beside the player (70% player, 30% this panel). Hidden until the Advanced
 * features button is pressed; then every feature opens at once with a flow animation. Hide closes it.
 */
export function AdvancedSidePanel(props: AdvancedProps) {
  const { t } = useT();
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface-1 p-4 md:p-5">
        <p className="text-body-sm text-text-secondary">{t("explore.advancedHelp")}</p>
        <div>
          <Button variant="secondary" aria-expanded={false} onClick={() => setOpen(true)}>
            {t("explore.advancedButton")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <section
      aria-labelledby="advanced-title"
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-border bg-surface-1 p-4 md:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="advanced-title" className="font-sans text-h4 font-medium text-text-primary">
          {t("explore.advanced")}
        </h2>
        <Button variant="secondary" size="sm" aria-expanded aria-controls="advanced-body" onClick={() => setOpen(false)}>
          {t("explore.advancedHide")}
        </Button>
      </div>
      <div id="advanced-body" className="animate-flow-in">
        <AdvancedToolsPanel {...props} expanded />
      </div>
    </section>
  );
}
