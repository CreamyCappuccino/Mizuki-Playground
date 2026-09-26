import { EBM, planetaryAlbedo } from './energyBalance';
import { buildGeographyGrid, type GeographyGrid } from './geographyGrid';
import { buildGeographySystem } from './geographySystem';
import { solveGeographyPcg, type PcgOptions } from './geographyPcg';
import { normalizeOrbit, type OrbitParameters } from './orbit';
import { dailyMeanInsolation } from './solar';

export interface GeographyMask {
  nlat: number;
  nlon: number;
  fractions: ArrayLike<number>;
  /** Caller supplies immutable source/builder/payload identity, not a UI label. */
  provenance: Readonly<Record<string, string | number>> & { id: string };
}
export interface GeographyClimateOptions {
  orbit?: OrbitParameters;
  stepsPerDay?: number;
  maxYears?: number;
  pcg?: PcgOptions;
}
export interface GeographyClimateSolution {
  tilt: number;
  orbit: OrbitParameters;
  grid: GeographyGrid;
  landFraction: Float64Array;
  /** Day-major at day 1,…,365, before the first half-day step of each day. */
  temperatures: Float64Array;
  years: number;
  stepsPerDay: number;
  /** Maximum difference between consecutive years at ALL step-end phases. */
  periodicError: number;
  energyResidual: number;
  maxStepEnergyResidual: number;
  maxRelativeLinearResidual: number;
  maxLinearIterations: number;
  minimum: number;
  maximum: number;
  provenance: Readonly<Record<string, string | number>>;
}

/** Stationary annual-mean 1D solve is only an initial guess. No final values
 * are substituted: every geography step still solves the full variable-C 2D.
 */
function annualMeanGuess(grid: GeographyGrid, forcing: Float64Array, steps: number): Float64Array {
  const n = grid.nlat, mean = new Float64Array(n), diagonal = new Float64Array(n);
  const upper = new Float64Array(n), result = new Float64Array(n);
  for (let row = 0; row < n; row += 1) {
    for (let step = 0; step < steps; step += 1) mean[row] += forcing[step * n + row] / steps;
    const lower = row > 0 ? grid.northSouth[row - 1] : 0;
    const higher = row + 1 < n ? grid.northSouth[row] : 0;
    diagonal[row] = grid.weight[row] * EBM.B + lower + higher - (row ? lower * upper[row - 1] : 0);
    upper[row] = higher / diagonal[row];
    result[row] = (grid.weight[row] * mean[row] + (row ? lower * result[row - 1] : 0)) / diagonal[row];
  }
  for (let row = n - 2; row >= 0; row -= 1) result[row] += upper[row] * result[row + 1];
  return Float64Array.from({ length: grid.size }, (_, k) => result[Math.floor(k / grid.nlon)]);
}

/** Isolated educational EBM, with no cache, worker, UI or fallback connection. */
export function solveGeographyClimate(
  tilt: number, mask: GeographyMask, options: GeographyClimateOptions = {},
): GeographyClimateSolution {
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 90) throw new RangeError('Obliquity must be finite in [0, 90].');
  // Larger harmonic grids are matvec tests, not annual runs. Bound the
  // all-phase history allocation; 36×72 is an explicit research refinement.
  if (mask.nlat > 36 || mask.nlon > 72) throw new RangeError('Annual geography grid is limited to 36×72 refinement; default science grid is 18×36.');
  const orbit = normalizeOrbit(options.orbit), stepsPerDay = options.stepsPerDay ?? 2;
  const maxYears = options.maxYears ?? 80;
  if (!Number.isInteger(maxYears) || maxYears < 2 || maxYears > 80) throw new RangeError('Maximum years must be an integer in [2, 80].');
  if (!mask.provenance || typeof mask.provenance.id !== 'string' || !mask.provenance.id.trim() ||
      Object.values(mask.provenance).some(v => typeof v !== 'string' && (typeof v !== 'number' || !Number.isFinite(v)))) {
    throw new RangeError('Mask provenance must have a nonempty id and finite scalar metadata.');
  }
  const grid = buildGeographyGrid(mask.nlat, mask.nlon), landFraction = Float64Array.from(mask.fractions);
  const system = buildGeographySystem(grid, landFraction, stepsPerDay);
  const count = 365 * stepsPerDay, n = grid.size;
  const forcing = new Float64Array(count * grid.nlat);
  for (let step = 0; step < count; step += 1) {
    for (let row = 0; row < grid.nlat; row += 1) {
      const x = Math.sin(grid.phi[row]);
      forcing[step * grid.nlat + row] = (1 - planetaryAlbedo(x)) *
        dailyMeanInsolation(grid.phi[row] * 180 / Math.PI, 1 + (step + 1) / stepsPerDay, tilt, orbit) - EBM.A;
    }
  }
  let temperature = annualMeanGuess(grid, forcing, count);
  const rhs = new Float64Array(n), previousYearPhases = new Float64Array(count * n);
  const temperatures = new Float64Array(365 * n);
  let periodicError = Infinity, energyResidual = Infinity, maxStepEnergyResidual = 0;
  let maxRelativeLinearResidual = 0, maxLinearIterations = 0, years = 0;
  for (years = 1; years <= maxYears; years += 1) {
    periodicError = years === 1 ? Infinity : 0;
    let radiationSum = 0;
    for (let step = 0; step < count; step += 1) {
      if (step % stepsPerDay === 0) temperatures.set(temperature, step / stepsPerDay * n);
      for (let k = 0; k < n; k += 1) {
        const row = Math.floor(k / grid.nlon);
        rhs[k] = system.storage[k] * temperature[k] + grid.weight[row] * forcing[step * grid.nlat + row];
      }
      const linear = solveGeographyPcg(system, rhs, temperature, options.pcg), next = linear.solution;
      maxRelativeLinearResidual = Math.max(maxRelativeLinearResidual, linear.relativeResidual);
      maxLinearIterations = Math.max(maxLinearIterations, linear.iterations);
      let stepRadiation = 0, storageChange = 0;
      for (let k = 0; k < n; k += 1) {
        const row = Math.floor(k / grid.nlon), offset = step * n + k;
        if (years > 1) periodicError = Math.max(periodicError, Math.abs(next[k] - previousYearPhases[offset]));
        previousYearPhases[offset] = next[k];
        stepRadiation += grid.weight[row] * (forcing[step * grid.nlat + row] - EBM.B * next[k]);
        storageChange += system.storage[k] * (next[k] - temperature[k]);
      }
      maxStepEnergyResidual = Math.max(maxStepEnergyResidual, Math.abs(stepRadiation - storageChange) / (2 * grid.nlon));
      radiationSum += stepRadiation;
      temperature = next;
    }
    energyResidual = radiationSum / (2 * grid.nlon * count);
    if (Number.isFinite(periodicError) && periodicError < EBM.tolerance) break;
  }
  if (!Number.isFinite(periodicError) || periodicError >= EBM.tolerance) {
    throw new Error(`Geography climate did not converge to a periodic year in ${maxYears} years; error ${periodicError}.`);
  }
  if (!Number.isFinite(energyResidual) || !Number.isFinite(maxStepEnergyResidual) || maxStepEnergyResidual > 1e-5) {
    throw new Error(`Geography climate failed discrete energy balance: ${maxStepEnergyResidual} W/m².`);
  }
  let minimum = Infinity, maximum = -Infinity;
  for (const value of temperatures) {
    if (!Number.isFinite(value)) throw new Error('Geography climate produced nonfinite temperatures.');
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
  }
  return { tilt, orbit, grid, landFraction, temperatures, years, stepsPerDay, periodicError,
    energyResidual, maxStepEnergyResidual, maxRelativeLinearResidual, maxLinearIterations, minimum, maximum,
    provenance: { ...mask.provenance, grid: `phi-midpoint-${grid.nlat}x${grid.nlon}-v1`,
      solver: 'geography-backward-euler-pcg-v1', stepsPerDay, A: EBM.A, B: EBM.B, D: grid.diffusion,
      periodicTolerance: EBM.tolerance, pcgRelativeTolerance: options.pcg?.relativeTolerance ?? 1e-11,
      pcgAbsoluteTolerance: options.pcg?.absoluteTolerance ?? 1e-11 } };
}
