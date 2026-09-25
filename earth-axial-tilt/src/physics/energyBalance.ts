import { normalizeOrbit, type OrbitParameters } from './orbit';
import { clamp, dailyMeanInsolation } from './solar';

/** A dry, zonally averaged seasonal EBM. Parameters are illustrative, not a city fit. */
export const EBM = Object.freeze({
  A: 210, B: 2, D: 0.55, albedo0: 0.3, albedo2: 0.078,
  waterHeatCapacity: 4e6, secondsPerDay: 86400,
  bands: 90, stepsPerDay: 2, tolerance: 1e-6, maxYears: 80,
});
export const HEAT_STORAGE = [
  { depth: 2.5, label: 'Fast · 2.5 m equivalent' },
  { depth: 10, label: 'Mixed · 10 m equivalent' },
  { depth: 50, label: 'Slow · 50 m equivalent' },
] as const;
export interface ClimateGrid {
  x: Float64Array;
  latitude: Float64Array;
  weight: Float64Array;
  lower: Float64Array;
  upper: Float64Array;
}
export interface ThermalSolution {
  orbit?: OrbitParameters;
  tilt: number;
  depth: number;
  x: Float64Array;
  /** Day-major: day 1 through 365, at each latitude-band centre. */
  temperatures: Float64Array;
  years: number;
  periodicError: number;
  /** Area/time-weighted TOA absorbed minus outgoing radiation, W/m². */
  energyResidual: number;
  minimum: number;
  maximum: number;
}
export interface SolverOptions { bands?: number; stepsPerDay?: number; orbit?: OrbitParameters }

function finiteRange(value: number, min: number, max: number, name: string): void {
  if (!Number.isFinite(value) || value < min || value > max) {
    throw new RangeError(`${name} must be finite and between ${min} and ${max}.`);
  }
}

/** Finite volumes in x = sin(latitude); no energy flows through either pole. */
export function buildClimateGrid(bands: number = EBM.bands, diffusion: number = EBM.D): ClimateGrid {
  finiteRange(bands, 12, 180, 'Latitude bands');
  if (!Number.isInteger(bands)) throw new RangeError('Latitude bands must be an integer.');
  finiteRange(diffusion, 0, 2, 'Diffusion');
  const edges = Float64Array.from({ length: bands + 1 }, (_, i) => Math.sin(-Math.PI / 2 + Math.PI * i / bands));
  const x = new Float64Array(bands), latitude = new Float64Array(bands), weight = new Float64Array(bands);
  const lower = new Float64Array(bands), upper = new Float64Array(bands);
  for (let i = 0; i < bands; i += 1) {
    x[i] = (edges[i] + edges[i + 1]) / 2;
    latitude[i] = Math.asin(x[i]) * 180 / Math.PI;
    weight[i] = edges[i + 1] - edges[i];
  }
  for (let i = 0; i < bands - 1; i += 1) {
    const conductance = diffusion * (1 - edges[i + 1] ** 2) / (x[i + 1] - x[i]);
    upper[i] = conductance / weight[i];
    lower[i + 1] = conductance / weight[i + 1];
  }
  return { x, latitude, weight, lower, upper };
}

/** Transport redistributes energy only; its area-weighted global sum is zero. */
export function heatTransport(temperature: ArrayLike<number>, grid: ClimateGrid): Float64Array {
  if (temperature.length !== grid.x.length) throw new RangeError('Temperature/grid size mismatch.');
  return Float64Array.from(grid.x, (_, i) =>
    (i ? grid.lower[i] * (temperature[i - 1] - temperature[i]) : 0) +
    (i + 1 < temperature.length ? grid.upper[i] * (temperature[i + 1] - temperature[i]) : 0));
}

export function planetaryAlbedo(x: number): number {
  return EBM.albedo0 + EBM.albedo2 * (3 * x * x - 1) / 2;
}

/** Factor once; reuse the strictly diagonally dominant tridiagonal operator. */
function factor(grid: ClimateGrid, timeFactor: number, identity: number) {
  const n = grid.x.length;
  const inverse = new Float64Array(n), upper = new Float64Array(n), lower = new Float64Array(n);
  for (let i = 0; i < n; i += 1) {
    lower[i] = -timeFactor * grid.lower[i];
    const diagonal = identity + timeFactor * (EBM.B + grid.lower[i] + grid.upper[i]);
    inverse[i] = 1 / (diagonal - (i ? lower[i] * upper[i - 1] : 0));
    upper[i] = -timeFactor * grid.upper[i] * inverse[i];
  }
  return (rhs: Float64Array, output: Float64Array): void => {
    for (let i = 0; i < n; i += 1) output[i] = (rhs[i] - (i ? lower[i] * output[i - 1] : 0)) * inverse[i];
    for (let i = n - 2; i >= 0; i -= 1) output[i] -= upper[i] * output[i + 1];
  };
}

/**
 * C dT/dt = (1-alpha)Q - (A+B*T) + D d/dx[(1-x²)dT/dx].
 * Implicit time stepping, with the solar forcing evaluated at each step end.
 * Spin-up stops only when the same phase agrees between consecutive years.
 * No temperature clamp and no artificial 28-day lag are used in this model.
 */
export function solveSeasonalClimate(tilt: number, depth: number, options: SolverOptions = {}): ThermalSolution {
  const orbit = normalizeOrbit(options.orbit);
  finiteRange(tilt, 0, 90, 'Obliquity');
  finiteRange(depth, 2.5, 50, 'Equivalent water depth');
  const grid = buildClimateGrid(options.bands ?? EBM.bands);
  const steps = options.stepsPerDay ?? EBM.stepsPerDay;
  finiteRange(steps, 1, 8, 'Steps per day');
  if (!Number.isInteger(steps)) throw new RangeError('Steps per day must be an integer.');
  const n = grid.x.length, count = 365 * steps;
  const h = EBM.secondsPerDay / steps / (EBM.waterHeatCapacity * depth);
  const forcing = new Float64Array(count * n), mean = new Float64Array(n);
  for (let s = 0; s < count; s += 1) {
    const day = 1 + (s + 1) / steps;
    for (let i = 0; i < n; i += 1) {
      const absorbed = (1 - planetaryAlbedo(grid.x[i])) * dailyMeanInsolation(grid.latitude[i], day, tilt, orbit);
      forcing[s * n + i] = absorbed - EBM.A;
      mean[i] += (absorbed - EBM.A) / count;
    }
  }
  // A stationary annual-mean solution is a good initial condition, not the final answer.
  let temperature = new Float64Array(n), next = new Float64Array(n);
  factor(grid, 1, 0)(mean, temperature);
  const integrate = factor(grid, h, 1);
  const rhs = new Float64Array(n), cycleStart = new Float64Array(n);
  const temperatures = new Float64Array(365 * n);
  let periodicError = Infinity, energyResidual = Infinity, years = 0;
  for (years = 1; years <= EBM.maxYears; years += 1) {
    cycleStart.set(temperature);
    let radiationSum = 0;
    for (let s = 0; s < count; s += 1) {
      if (s % steps === 0) temperatures.set(temperature, (s / steps) * n);
      for (let i = 0; i < n; i += 1) rhs[i] = temperature[i] + h * forcing[s * n + i];
      integrate(rhs, next);
      [temperature, next] = [next, temperature];
      for (let i = 0; i < n; i += 1) radiationSum += grid.weight[i] * (forcing[s * n + i] - EBM.B * temperature[i]);
    }
    periodicError = 0;
    for (let i = 0; i < n; i += 1) periodicError = Math.max(periodicError, Math.abs(temperature[i] - cycleStart[i]));
    energyResidual = radiationSum / (2 * count);
    if (periodicError < EBM.tolerance) break;
  }
  if (!Number.isFinite(periodicError) || periodicError >= EBM.tolerance) {
    throw new Error('Thermal model did not converge to a periodic year.');
  }
  let minimum = Infinity, maximum = -Infinity;
  for (const t of temperatures) {
    if (!Number.isFinite(t)) throw new Error('Thermal model produced a non-finite temperature.');
    minimum = Math.min(minimum, t); maximum = Math.max(maximum, t);
  }
  return { tilt, depth, orbit, x: grid.x, temperatures, years, periodicError, energyResidual, minimum, maximum };
}

/** Interpolate the periodic daily field, linearly in equal-area coordinate x. */
export function sampleThermalTemperature(solution: ThermalSolution, latitude: number, day: number): number {
  finiteRange(latitude, -90, 90, 'Latitude');
  if (!Number.isFinite(day)) throw new RangeError('Day must be finite.');
  const phase = ((day - 1) % 365 + 365) % 365;
  const firstDay = Math.floor(phase), nextDay = (firstDay + 1) % 365, t = phase - firstDay;
  const x = Math.sin(latitude * Math.PI / 180), n = solution.x.length;
  let low = 0, high = n - 1;
  while (high - low > 1) { const mid = (low + high) >> 1; if (solution.x[mid] <= x) low = mid; else high = mid; }
  const f = clamp((x - solution.x[low]) / (solution.x[high] - solution.x[low]), 0, 1);
  const a = solution.temperatures[firstDay * n + low] * (1 - f) + solution.temperatures[firstDay * n + high] * f;
  const b = solution.temperatures[nextDay * n + low] * (1 - f) + solution.temperatures[nextDay * n + high] * f;
  return a * (1 - t) + b * t;
}
