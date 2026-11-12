"use client";

import { Badge } from "@/components/ui/Surfaces";
import { useT } from "@/lib/i18n/LangProvider";

/** Shown next to every number that is not produced by this user's own actions (rules §2.2). */
export function DemoDataBadge() {
  const { t } = useT();
  return <Badge tone="accent">{t("common.demoData")}</Badge>;
}
