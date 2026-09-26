import { buildClimateGrid, EBM, planetaryAlbedo, type ClimateGrid } from '../physics/energyBalance';
import { normalizeOrbit, type OrbitParameters } from '../physics/orbit';
import { dailyMeanInsolation } from '../physics/solar';

/** Distinct zonal teaching model. Never substitutes for the 2D geography solver. */
export const FEEDBACK_MODEL = 'zonal90-ice-albedo-halfday-v1';
export const FEEDBACK = Object.freeze({ bands: 90, stepsPerDay: 2, maxYears: 80,
  iceAlbedo: .62, threshold: -10, warmSeed: 20, coldSeed: -60, tolerance: 1e-6 });
export interface FeedbackConditions { tilt: number; depth: 2.5 | 10 | 50; orbit: OrbitParameters; enabled: boolean; solarScale: number }
export interface FeedbackSolution {
  model: typeof FEEDBACK_MODEL; conditions: FeedbackConditions; bands: number; stepsPerDay: number;
  latitude: Float64Array; weight: Float64Array; temperatures: Float64Array;
  /** Actual initial and final day-1-phase states; essential for continued histories. */
  initialState: Float64Array; endState: Float64Array;
  /** Area below the proxy threshold at each daily output, not mass/volume. */
  dailyIceArea: Float64Array;
  mean: number; meanIceArea: number; minimum: number; maximum: number;
  years: number; converged: boolean; periodicError: number; maskRepeated: boolean;
  energyResidual: number; maxStepEnergyResidual: number;
}
export interface FeedbackOptions { bands?: number; stepsPerDay?: number; maxYears?: number; onYear?: (year: number) => void }

export function feedbackConditions(c: FeedbackConditions): FeedbackConditions {
  if (!c || !Number.isFinite(c.tilt) || c.tilt < 0 || c.tilt > 90 || ![2.5, 10, 50].includes(c.depth) ||
      typeof c.enabled !== 'boolean' || !Number.isFinite(c.solarScale) || c.solarScale < .7 || c.solarScale > 1.5 || !c.orbit)
    throw new RangeError('Invalid feedback conditions.');
  return { tilt: c.tilt, depth: c.depth, orbit: normalizeOrbit(c.orbit), enabled: c.enabled, solarScale: c.solarScale };
}
/** Tf is a teaching snow/ice proxy threshold, NOT seawater's freezing point. Equality is warm. */
export function feedbackAlbedo(temperature: number, x: number, enabled: boolean): number {
  if (!Number.isFinite(temperature) || !Number.isFinite(x) || Math.abs(x) > 1) throw new RangeError('Invalid albedo input.');
  return enabled && temperature < FEEDBACK.threshold ? FEEDBACK.iceAlbedo : planetaryAlbedo(x);
}

/** Reusable tridiagonal backward-Euler step. Diffusion/radiation implicit;
 * albedo uses the OLD state, as does the discrete energy diagnostic. */
export function feedbackStepper(grid: ClimateGrid, depth: number, stepsPerDay: number, enabled: boolean) {
  if (!Number.isFinite(depth) || depth <= 0 || !Number.isInteger(stepsPerDay) || stepsPerDay < 1 || stepsPerDay > 8)
    throw new RangeError('Invalid feedback step.');
  const n = grid.x.length, dt = EBM.secondsPerDay / stepsPerDay, capacity = EBM.waterHeatCapacity * depth;
  const h = dt / capacity, inverse = new Float64Array(n), lower = new Float64Array(n), upper = new Float64Array(n);
  const absorbed = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    lower[i] = -h * grid.lower[i];
    const pivot = 1 + h * (EBM.B + grid.lower[i] + grid.upper[i]) - (i ? lower[i] * upper[i - 1] : 0);
    if (!Number.isFinite(pivot) || pivot <= 0) throw new Error('Invalid feedback matrix.');
    inverse[i] = 1 / pivot; upper[i] = -h * grid.upper[i] * inverse[i];
  }
  return (old: Float64Array, q: Float64Array, next: Float64Array): { radiation: number; energyError: number; iceArea: number } => {
    if (old.length !== n || q.length !== n || next.length !== n || old.buffer === next.buffer) throw new RangeError('Feedback array mismatch.');
    let iceArea = 0;
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(q[i]) || q[i] < 0) throw new RangeError('Invalid solar forcing.');
      const a = feedbackAlbedo(old[i], grid.x[i], enabled);
      absorbed[i] = (1 - a) * q[i] - EBM.A;
      const rhs = old[i] + h * absorbed[i];
      next[i] = (rhs - (i ? lower[i] * next[i - 1] : 0)) * inverse[i];
      if (enabled && old[i] < FEEDBACK.threshold) iceArea += grid.weight[i] / 2;
    }
    for (let i = n - 2; i >= 0; i--) next[i] -= upper[i] * next[i + 1];
    let radiation = 0, storage = 0;
    for (let i = 0; i < n; i++) {
      if (!Number.isFinite(next[i])) throw new Error('Nonfinite feedback solution.');
      radiation += grid.weight[i] * (absorbed[i] - EBM.B * next[i]) / 2;
      storage += grid.weight[i] * capacity * (next[i] - old[i]) / (2 * dt);
    }
    return { radiation, energyError: Math.abs(radiation - storage), iceArea };
  };
}

/** Last simulated year is returned explicitly as unsettled at the finite bound.
 * Numerical failures throw. Nonconvergence is NOT converted into an ice-free fallback. */
export function solveFeedback(c: FeedbackConditions, seed: 'warm' | 'cold' | Float64Array,
  options: FeedbackOptions = {}): FeedbackSolution {
  const conditions = feedbackConditions(c);
  const bands = options.bands ?? FEEDBACK.bands, steps = options.stepsPerDay ?? FEEDBACK.stepsPerDay;
  const maxYears = options.maxYears ?? FEEDBACK.maxYears;
  if (!Number.isInteger(steps) || steps < 1 || steps > 8 || !Number.isInteger(maxYears) || maxYears < 2 || maxYears > 80)
    throw new RangeError('Invalid feedback run bound.');
  const grid = buildClimateGrid(bands), count = 365 * steps;
  let old: Float64Array;
  if (seed === 'warm' || seed === 'cold') old = new Float64Array(bands).fill(seed === 'warm' ? FEEDBACK.warmSeed : FEEDBACK.coldSeed);
  else if (seed instanceof Float64Array && seed.length === bands && seed.every(Number.isFinite)) old = seed.slice();
  else throw new RangeError('Invalid initial day-1 state.');
  const initialState = old.slice(), previous = new Float64Array(count * bands), masks = new Uint8Array(count * bands);
  let next: Float64Array = new Float64Array(bands);
  const temperatures = new Float64Array(365 * bands), dailyIceArea = new Float64Array(365);
  const q = Array.from({ length: count }, (_, step) => Float64Array.from(grid.latitude, latitude =>
    conditions.solarScale * dailyMeanInsolation(latitude, 1 + (step + 1) / steps, conditions.tilt, conditions.orbit)));
  const advance = feedbackStepper(grid, conditions.depth, steps, conditions.enabled);
  let years = 0, converged = false, maskRepeated = false, periodicError = Infinity;
  let energyResidual = 0, maxStepEnergyResidual = 0, meanIceArea = 0;
  for (years = 1; years <= maxYears; years++) {
    periodicError = years > 1 ? 0 : Infinity; maskRepeated = years > 1;
    energyResidual = 0; meanIceArea = 0;
    for (let step = 0; step < count; step++) {
      const offset = step * bands;
      if (step % steps === 0) {
        const day = step / steps; temperatures.set(old, day * bands);
        dailyIceArea[day] = 0;
        for (let i = 0; i < bands; i++) if (conditions.enabled && old[i] < FEEDBACK.threshold) dailyIceArea[day] += grid.weight[i] / 2;
      }
      for (let i = 0; i < bands; i++) {
        const mask = Number(conditions.enabled && old[i] < FEEDBACK.threshold);
        if (years > 1 && masks[offset + i] !== mask) maskRepeated = false;
        masks[offset + i] = mask;
      }
      const diagnostic = advance(old, q[step], next);
      maxStepEnergyResidual = Math.max(maxStepEnergyResidual, diagnostic.energyError);
      energyResidual += diagnostic.radiation / count; meanIceArea += diagnostic.iceArea / count;
      for (let i = 0; i < bands; i++) {
        if (years > 1) periodicError = Math.max(periodicError, Math.abs(next[i] - previous[offset + i]));
        previous[offset + i] = next[i];
      }
      [old, next] = [next, old];
    }
    options.onYear?.(years);
    converged = periodicError < FEEDBACK.tolerance && maskRepeated;
    if (converged || years === maxYears) break;
  }
  if (!Number.isFinite(periodicError) || !Number.isFinite(energyResidual) || maxStepEnergyResidual > 1e-5)
    throw new Error('Feedback numerical energy/finite-value check failed.');
  let minimum = Infinity, maximum = -Infinity, mean = 0;
  for (let k = 0; k < temperatures.length; k++) {
    const t = temperatures[k]; minimum = Math.min(minimum, t); maximum = Math.max(maximum, t);
    mean += t * grid.weight[k % bands] / (2 * 365);
  }
  return { model: FEEDBACK_MODEL, conditions, bands, stepsPerDay: steps,
    latitude: grid.latitude, weight: grid.weight, temperatures, initialState, endState: old.slice(), dailyIceArea,
    mean, meanIceArea, minimum, maximum, years, converged, periodicError, maskRepeated, energyResidual, maxStepEnergyResidual };
}

export function feedbackBand(latitude: number): number {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) throw new RangeError('Invalid feedback latitude.');
  return Math.min(89, Math.floor((latitude + 90) / 2));
}
export function sampleFeedback(s: FeedbackSolution, latitude: number, day: number): number {
  if (s.bands !== 90 || !Number.isFinite(day)) throw new RangeError('Invalid feedback sampling.');
  const band = feedbackBand(latitude), phase = ((day - 1) % 365 + 365) % 365, first = Math.floor(phase);
  const a = s.temperatures[first * 90 + band], b = s.temperatures[((first + 1) % 365) * 90 + band];
  return a + (phase - first) * (b - a);
}
