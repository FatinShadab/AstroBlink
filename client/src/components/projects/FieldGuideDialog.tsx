"use client";

import { Button } from "@/components/ui/Button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/Radix";
import { useT } from "@/lib/i18n/LangProvider";
import { FieldGuideList } from "./FieldGuideList";

/** The field guide opened from a classify or training page (design §8.6). */
export function FieldGuideDialog() {
  const { t } = useT();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="tertiary" size="sm">
          {t("guide.open")}
        </Button>
      </DialogTrigger>
      <DialogContent
        title={t("guide.title")}
        description={t("guide.intro")}
        closeLabel={t("common.close")}
        className="max-w-[880px]"
      >
        <FieldGuideList />
      </DialogContent>
    </Dialog>
  );
}
