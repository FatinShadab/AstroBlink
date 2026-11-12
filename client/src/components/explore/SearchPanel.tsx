"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Field";
import { DETECTORS } from "@/lib/sky/detectors";
import { CoordError, formatDec, formatRa, parseCoordinatePair } from "@/lib/sky/coords";
import { useT } from "@/lib/i18n/LangProvider";
import { fill } from "@/lib/i18n/format";
import type { DictKey } from "@/lib/i18n/en";
import { FOV_VALUES } from "@/lib/state/viewerParams";
import type { Detector } from "@/lib/data/types";
import { presetByName, type PresetId } from "@/data/presets";

const selectClass =
  "h-11 rounded-[var(--radius-sm)] border border-border-strong bg-surface-2 px-3 text-body text-text-primary focus:border-primary focus:outline-none";

interface SearchPanelProps {
  raDeg: number | null;
  decDeg: number | null;
  fov: number;
  detector: Detector;
  onSearch: (raDeg: number, decDeg: number) => void;
  /** Called when the box holds a target name instead of coordinates. */
  onPreset: (id: PresetId) => void;
  onFov: (fov: number) => void;
  onDetector: (detector: Detector) => void;
  shareSlot: React.ReactNode;
}

/**
 * Coordinate box (checks on blur and Enter), FoV and detector selects, and the share button.
 * The form remounts when the URL coordinates change, so the box always shows the current spot.
 */
export function SearchPanel(props: SearchPanelProps) {
  const { raDeg, decDeg, fov, detector, onSearch, onPreset, onFov, onDetector, shareSlot } = props;
  const { t } = useT();
  const initial =
    raDeg !== null && decDeg !== null ? `${formatRa(raDeg)} ${formatDec(decDeg)}` : "";
  const [draft, setDraft] = useState(initial);
  const [error, setError] = useState<DictKey | null>(null);

  function submit(text: string) {
    try {
      const coords = parseCoordinatePair(text);
      setError(null);
      onSearch(coords.raDeg, coords.decDeg);
    } catch (caught) {
      // Not coordinates: try a target name ("Barnard's Star", "WISE 0855", "R Dra").
      const named = presetByName(text);
      if (named) {
        setError(null);
        onPreset(named.id);
        return;
      }
      const code = caught instanceof CoordError ? caught.code : "format";
      setError(`explore.err.${code}` as DictKey);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
      <form
        key={initial}
        className="flex flex-col gap-1 md:col-span-7"
        onSubmit={(event) => {
          event.preventDefault();
          submit(draft);
        }}
      >
        <label htmlFor="coords" className="text-body-sm font-medium text-text-primary">
          {t("explore.searchLabel")}
        </label>
        <div className="flex gap-2">
          <Input
            id="coords"
            mono
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() !== "" && draft !== initial) submit(draft);
            }}
            placeholder={t("explore.searchPlaceholder")}
            invalid={error !== null}
            aria-describedby={error ? "coords-error" : "coords-help"}
            spellCheck={false}
            autoComplete="off"
          />
          <Button type="submit" variant="secondary" className="shrink-0">
            {t("explore.searchSubmit")}
          </Button>
        </div>
        {error ? (
          <p id="coords-error" className="flex items-start gap-1 text-body-sm text-danger">
            <span aria-hidden="true">⚠</span>
            <span>{t(error)}</span>
          </p>
        ) : (
          <p id="coords-help" className="text-body-sm text-text-muted">
            {t("explore.searchHelp")}
          </p>
        )}
      </form>

      <div className="flex flex-wrap items-end gap-3 md:col-span-5 md:justify-end">
        <label className="flex flex-col gap-1 text-body-sm font-medium text-text-primary">
          {t("explore.fov")}
          <select
            className={selectClass}
            value={fov}
            onChange={(e) => onFov(Number(e.target.value))}
          >
            {FOV_VALUES.map((value) => (
              <option key={value} value={value}>
                {value}′
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-body-sm font-medium text-text-primary">
          {t("explore.detector")}
          <select
            className={`${selectClass} font-mono`}
            value={detector}
            onChange={(e) => onDetector(e.target.value as Detector)}
          >
            {DETECTORS.map((d) => (
              <option key={d.id} value={d.id}>
                {`${d.id} · ${fill(t("explore.detectorRange"), { min: d.minUm.toFixed(2), max: d.maxUm.toFixed(2) })}`}
              </option>
            ))}
          </select>
        </label>
        {shareSlot}
      </div>
    </div>
  );
}
