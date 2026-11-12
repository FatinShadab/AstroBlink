"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { CoordError, parseCoordinatePair } from "@/lib/sky/coords";
import { presetByName } from "@/data/presets";
import { useT } from "@/lib/i18n/LangProvider";
import type { DictKey } from "@/lib/i18n/en";

/**
 * Hero search: type coordinates, press Enter, and the explore page opens on that spot. Uses the same
 * parser as the explore page, so the formats match (for example "08h55m10.8s -07d14m42s" or "133.795 -7.245").
 */
export function HeroSearch() {
  const { t } = useT();
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<DictKey | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const { raDeg, decDeg } = parseCoordinatePair(draft);
      setError(null);
      router.push(`/explore?ra=${raDeg}&dec=${decDeg}&fov=5&det=D2`);
    } catch (caught) {
      // Not coordinates: try a target name ("Barnard's Star", "WISE 0855", "R Dra").
      const named = presetByName(draft);
      if (named) {
        setError(null);
        router.push(`/explore?preset=${named.id}`);
        return;
      }
      const code = caught instanceof CoordError ? caught.code : "format";
      setError(`explore.err.${code}` as DictKey);
    }
  }

  return (
    <div className="mb-8 flex max-w-xl flex-col gap-3 sm:mb-10">
      <form onSubmit={submit} className="flex flex-col gap-2" noValidate>
        <label htmlFor="hero-coords" className="text-body-sm font-medium text-text-primary">
          {t("explore.searchLabel")}
        </label>
        <div className="flex gap-2">
          <Input
            id="hero-coords"
            mono
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={t("explore.searchPlaceholder")}
            invalid={error !== null}
            aria-describedby={error ? "hero-coords-error" : "hero-coords-help"}
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" className="shrink-0">
            {t("explore.searchSubmit")}
          </Button>
        </div>
        {error ? (
          <p id="hero-coords-error" role="alert" className="flex items-start gap-1 text-body-sm text-danger">
            <span aria-hidden="true">⚠</span>
            <span>{t(error)}</span>
          </p>
        ) : (
          <p id="hero-coords-help" className="text-body-sm text-text-muted">
            {t("explore.searchHelp")}
          </p>
        )}
      </form>
      <Link href="/explore" className="self-start text-body-sm font-medium text-text-primary underline-offset-4 hover:underline">
        {t("nav.explore")} →
      </Link>
    </div>
  );
}
