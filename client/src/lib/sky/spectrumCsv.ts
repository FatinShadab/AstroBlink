import type { SpectrumPoint } from "@/lib/data/types";

/** CSV text for a spectrum (design §8.2 "Export CSV"). */
export function spectrumCsv(points: SpectrumPoint[]): string {
  const rows = points.map((p) => `${p.wavelengthUm},${p.flux},${p.fluxErr}`);
  return ["wavelength_um,relative_brightness,error", ...rows].join("\n");
}
