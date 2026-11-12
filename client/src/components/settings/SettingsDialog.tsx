"use client";

import { Dialog, DialogContent } from "@/components/ui/Radix";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useT } from "@/lib/i18n/LangProvider";
import { useUserStore, type BlinkFps } from "@/lib/state/useUserStore";

const speeds = [
  { value: "0.5", label: "0.5×" },
  { value: "1", label: "1×" },
  { value: "2", label: "2×" },
] as const;

/**
 * Settings dialog (brain §6, design §8.2). Controls write straight into the persisted store.
 * Flashing is capped at 2 changes per second by design (rules §3.2); the speed options respect that.
 */
export function SettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useT();
  const reducedMotion = useUserStore((s) => s.settings.reducedMotion);
  const setReducedMotion = useUserStore((s) => s.setReducedMotion);
  const blinkFps = useUserStore((s) => s.settings.blinkFps);
  const setBlinkFps = useUserStore((s) => s.setBlinkFps);
  const colorblindMerge = useUserStore((s) => s.settings.colorblindMerge);
  const setColorblindMerge = useUserStore((s) => s.setColorblindMerge);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t("settings.title")}
        description={t("settings.description")}
        closeLabel={t("settings.close")}
      >
        <section className="flex flex-col gap-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-text-primary">
            <input
              type="checkbox"
              checked={reducedMotion}
              onChange={(e) => setReducedMotion(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            {t("settings.reducedMotion")}
          </label>
          <p className="pl-8 text-body-sm text-text-muted">{t("settings.reducedMotionHelp")}</p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-body-sm font-medium text-text-primary">{t("settings.blinkSpeed")}</h3>
          <SegmentedControl<string>
            label={t("settings.blinkSpeed")}
            value={String(blinkFps)}
            onChange={(v) => setBlinkFps(Number(v) as BlinkFps)}
            options={speeds}
          />
          <p className="text-body-sm text-text-muted">{t("settings.blinkSpeedHelp")}</p>
        </section>

        <section className="flex flex-col gap-1">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body text-text-primary">
            <input
              type="checkbox"
              checked={colorblindMerge}
              onChange={(e) => setColorblindMerge(e.target.checked)}
              className="size-5 accent-[var(--primary)]"
            />
            {t("settings.colorblindMerge")}
          </label>
          <p className="pl-8 text-body-sm text-text-muted">{t("settings.colorblindMergeHelp")}</p>
        </section>
      </DialogContent>
    </Dialog>
  );
}
