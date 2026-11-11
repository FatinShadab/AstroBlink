"use client";

import { detectorInfo } from "@/lib/sky/detectors";
import { formatDegrees } from "@/lib/sky/coords";
import { formatDate, fill } from "@/lib/i18n/format";
import { useLang, useT } from "@/lib/i18n/LangProvider";
import type { Detector, FrameMeta } from "@/lib/data/types";

/** One line under the player: date, detector band, FoV and position (design §8.2). */
export function FrameMetaStrip({
  frame,
  detector,
  fovArcmin,
  raDeg,
  decDeg,
}: {
  frame: FrameMeta | null;
  detector: Detector;
  fovArcmin: number;
  raDeg: number;
  decDeg: number;
}) {
  const { t } = useT();
  const { lang } = useLang();
  const band = detectorInfo(detector);
  const parts = [
    frame ? formatDate(frame.obsDate, lang) : null,
    `${t("explore.detector")} ${detector} (${fill(t("explore.detectorRange"), {
      min: band.minUm.toFixed(1),
      max: band.maxUm.toFixed(1),
    })})`,
    `FoV ${fovArcmin}′`,
    `RA ${formatDegrees(raDeg)} Dec ${decDeg < 0 ? "−" : "+"}${Math.abs(decDeg).toFixed(3)}°`,
  ].filter(Boolean);

  return (
    <p className="px-3 font-mono text-mono text-text-secondary md:px-4">{parts.join(" · ")}</p>
  );
}
