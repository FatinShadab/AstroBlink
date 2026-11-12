/**
 * Brightness at the centre of a frame, for the light curve (design §11).
 * Aperture = a 5×5 box at the centre, minus the median sky of the whole frame.
 */
export interface PhotometryPoint {
  flux: number;
  fluxErr: number;
}

export function centreAperture(data: Float32Array, side: number, radius = 2): PhotometryPoint {
  const finite: number[] = [];
  for (let i = 0; i < data.length; i++) if (Number.isFinite(data[i])) finite.push(data[i]);
  if (finite.length === 0) return { flux: Number.NaN, fluxErr: Number.NaN };

  const sorted = finite.slice().sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];

  const cx = Math.floor(side / 2);
  const cy = Math.floor(side / 2);
  let sum = 0;
  let count = 0;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const x = cx + dx;
      const y = cy + dy;
      if (x < 0 || y < 0 || x >= side || y >= side) continue;
      const v = data[y * side + x];
      if (Number.isFinite(v)) {
        sum += v;
        count++;
      }
    }
  }
  const mean = count > 0 ? sum / count : Number.NaN;

  let variance = 0;
  const mu = finite.reduce((a, b) => a + b, 0) / finite.length;
  for (const v of finite) variance += (v - mu) * (v - mu);
  const sigma = Math.sqrt(variance / finite.length);

  return { flux: mean - median, fluxErr: sigma / Math.sqrt(Math.max(1, count)) };
}
