import { dailyMeanInsolation } from '../src/physics/solar';

/** Independent 1D phi-midpoint FV / direct tridiagonal reference. Uses neither
 * the production grid, matrix, CG, initial guess nor seasonal solver.
 * Astronomical forcing is shared here; external FFT/Kepler oracle is separate.
 */
export function uniformLatitudeOracle(tilt: number, depth: number, rows = 18): Float64Array {
  const width = Math.PI / rows, w = new Float64Array(rows), phi = new Float64Array(rows);
  const faces = new Float64Array(rows - 1), diagonal = new Float64Array(rows);
  const inverse = new Float64Array(rows), upper = new Float64Array(rows);
  for (let r = 0; r < rows; r += 1) {
    const south = -Math.PI / 2 + r * width, north = south + width;
    phi[r] = (north + south) / 2;
    w[r] = Math.sin(north) - Math.sin(south);
    if (r < rows - 1) faces[r] = 0.55 * Math.cos(north) / width;
  }
  for (let r = 0; r < rows; r += 1) {
    const below = r ? faces[r - 1] : 0, above = r < rows - 1 ? faces[r] : 0;
    diagonal[r] = w[r] * (4e6 * depth / 43200 + 2) + below + above;
    inverse[r] = 1 / (diagonal[r] - (r ? below * upper[r - 1] : 0));
    upper[r] = above * inverse[r];
  }
  const forcing = new Float64Array(730 * rows);
  for (let step = 0; step < 730; step += 1) for (let r = 0; r < rows; r += 1) {
    const x = Math.sin(phi[r]), albedo = 0.3 + 0.078 * (3 * x * x - 1) / 2;
    forcing[step * rows + r] = w[r] * ((1 - albedo) * dailyMeanInsolation(phi[r] * 180 / Math.PI,
      1 + (step + 1) / 2, tilt) - 210);
  }
  let temperature = new Float64Array(rows), next = new Float64Array(rows);
  const phases = new Float64Array(730 * rows), days = new Float64Array(365 * rows);
  for (let year = 1; year <= 80; year += 1) {
    let error = year === 1 ? Infinity : 0;
    for (let step = 0; step < 730; step += 1) {
      if (step % 2 === 0) days.set(temperature, step / 2 * rows);
      for (let r = 0; r < rows; r += 1) {
        const rhs = w[r] * 4e6 * depth / 43200 * temperature[r] + forcing[step * rows + r];
        next[r] = (rhs + (r ? faces[r - 1] * next[r - 1] : 0)) * inverse[r];
      }
      for (let r = rows - 2; r >= 0; r -= 1) next[r] += upper[r] * next[r + 1];
      for (let r = 0; r < rows; r += 1) {
        if (year > 1) error = Math.max(error, Math.abs(next[r] - phases[step * rows + r]));
        phases[step * rows + r] = next[r];
      }
      [temperature, next] = [next, temperature];
    }
    if (error < 1e-6) return days;
  }
  throw new Error('Independent 1D reference did not converge');
}
