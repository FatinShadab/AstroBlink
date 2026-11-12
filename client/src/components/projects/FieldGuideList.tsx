"use client";

import { Card } from "@/components/ui/Surfaces";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";

/** Field guide examples (design §8.6). Shown on /guide and in the dialog from classify pages. */
export const GUIDE_EXAMPLES = ["real", "variable", "cosmic", "spikes", "nothing"] as const;

export function FieldGuideList() {
  const { t } = useT();
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
      {GUIDE_EXAMPLES.map((key) => (
        <Card key={key} className="flex flex-col gap-2">
          <h3 className="font-sans text-h4 font-medium text-text-primary">
            {t(`guide.${key}.title` as DictKey)}
          </h3>
          <p className="text-body-sm text-text-secondary">{t(`guide.${key}.body` as DictKey)}</p>
          <p className="text-body-sm text-text-primary">
            <span className="font-medium">{t("guide.howTo")}: </span>
            {t(`guide.${key}.how` as DictKey)}
          </p>
        </Card>
      ))}
    </div>
  );
}
