/**
 * Export helpers for tagged candidates: JSON (nested, with spectra) and CSV
 * (one row per candidate, one flux column per SPHEREx channel).
 */

import type { TaggedCandidate } from "@/lib/api/types";
import { WAVELENGTHS_UM } from "@/lib/mock/spherexMockEngine";

export function candidatesToJson(candidates: TaggedCandidate[]): string {
  return JSON.stringify(
    {
      schema: "astroblink.candidates.v1",
      exported_at: new Date().toISOString(),
      count: candidates.length,
      candidates,
    },
    null,
    2,
  );
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function candidatesToCsv(candidates: TaggedCandidate[]): string {
  const meta = [
    "id",
    "subject_id",
    "category",
    "notes",
    "epoch",
    "pixel_x",
    "pixel_y",
    "ra_deg",
    "dec_deg",
    "created_at",
    "nearest_source",
  ];
  const fluxCols = WAVELENGTHS_UM.map((w) => `flux_ujy_${w.toFixed(4)}um`);
  const header = [...meta, ...fluxCols].map(csvCell).join(",");
  const rows = candidates.map((c) => {
    const base = [
      c.id,
      c.subject_id,
      c.category,
      c.notes,
      c.epoch,
      c.pixel_x,
      c.pixel_y,
      c.ra.toFixed(6),
      c.dec.toFixed(6),
      c.created_at,
      c.spectrum?.nearest_source ?? "",
    ];
    const flux = WAVELENGTHS_UM.map((_, i) => (c.spectrum ? c.spectrum.flux_ujy[i] : ""));
    return [...base, ...flux].map(csvCell).join(",");
  });
  return [header, ...rows].join("\r\n");
}

/** Triggers a client-side file download. Safe to call only in the browser. */
export function downloadText(filename: string, mime: string, text: string): void {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
