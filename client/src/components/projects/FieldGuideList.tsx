"use client";

import { Activity, Equal, MoveUpRight, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Surfaces";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";

/** Field guide examples (design §8.6). Shown on /guide and in the dialog from classify pages. */
export const GUIDE_EXAMPLES = ["real", "variable", "cosmic", "spikes", "nothing"] as const;

type Kind = "signal" | "artefact" | "none";

const META: Record<(typeof GUIDE_EXAMPLES)[number], { icon: LucideIcon; kind: Kind }> = {
  real: { icon: MoveUpRight, kind: "signal" },
  variable: { icon: Activity, kind: "signal" },
  cosmic: { icon: Zap, kind: "artefact" },
  spikes: { icon: Sparkles, kind: "artefact" },
  nothing: { icon: Equal, kind: "none" },
};

/**
 * One card per example: a header row (number, icon, what kind of thing it is), the title and what it looks
 * like, then "How to tell" in its own footer section. Cards in a row share one height.
 */
export function FieldGuideList() {
  const { t } = useT();
  return (
    <ol className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {GUIDE_EXAMPLES.map((key, i) => {
        const { icon: Icon, kind } = META[key];
        const titleId = `guide-${key}-title`;
        return (
          <li key={key} className="flex">
            <Card
              aria-labelledby={titleId}
              className="flex w-full flex-col gap-4 transition-colors hover:border-border-strong"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="grid size-10 place-items-center rounded-[var(--radius-sm)] border border-border bg-surface-2 text-text-primary"
                  >
                    <Icon className="size-5" />
                  </span>
                  <span className="font-mono text-caption text-text-muted">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="rounded-full border border-border px-2 py-0.5 text-caption text-text-secondary">
                  {t(`guide.kind.${kind}` as DictKey)}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <h3 id={titleId} className="font-sans text-h4 font-medium text-text-primary">
                  {t(`guide.${key}.title` as DictKey)}
                </h3>
                <p className="text-body-sm text-text-secondary">{t(`guide.${key}.body` as DictKey)}</p>
              </div>

              <div className="mt-auto flex flex-col gap-1 border-t border-border pt-4">
                <p className="text-caption font-medium tracking-wide text-text-muted uppercase">
                  {t("guide.howTo")}
                </p>
                <p className="text-body-sm text-text-primary">{t(`guide.${key}.how` as DictKey)}</p>
              </div>
            </Card>
          </li>
        );
      })}
    </ol>
  );
}
