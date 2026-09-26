import type { GeographyClimateSolution } from './geographyClimate';
import { buildGeographyGrid } from './geographyGrid';
import { GEOGRAPHY_GRID_ID, GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID, GEOGRAPHY_SOURCE_ARCHIVE } from './geographyMask';
import { normalizeOrbit, orbitKey, type OrbitParameters } from './orbit';

export interface GeographyConditions {
  tilt: number;
  orbit: OrbitParameters;
  retainedDepth: 2.5 | 10 | 50;
}
export interface GeographyRequest extends GeographyConditions {
  id: number;
  profile: 'earth-geography';
  grid: typeof GEOGRAPHY_GRID_ID;
  mask: typeof GEOGRAPHY_MASK_DIGEST;
  solver: typeof GEOGRAPHY_SOLVER_ID;
  stepsPerDay: 2;
}
export type GeographyReply =
  | { id: number; key: string; status: 'computing' }
  | { id: number; key: string; status: 'ready'; solution: GeographyClimateSolution }
  | { id: number; key: string; status: 'error'; error: string };

export function isGeographyReply(value: unknown): value is GeographyReply {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const r = value as Partial<GeographyReply>;
  if (!Number.isSafeInteger(r.id) || (r.id ?? 0) < 1 || typeof r.key !== 'string') return false;
  if (r.status === 'computing') return true;
  if (r.status === 'error') return typeof r.error === 'string';
  return r.status === 'ready' && !!r.solution && typeof r.solution === 'object';
}

const expectedGrid = buildGeographyGrid();
function validGrid(solution: GeographyClimateSolution): boolean {
  const g = solution.grid;
  if (!g || g.nlat !== 18 || g.nlon !== 36 || g.size !== 648 ||
      g.diffusion !== expectedGrid.diffusion || g.dphi !== expectedGrid.dphi || g.dlambda !== expectedGrid.dlambda) return false;
  for (const name of ['phi', 'lambda', 'weight', 'northSouth', 'eastWest'] as const) {
    const values = g[name], expected = expectedGrid[name];
    if (!(values instanceof Float64Array) || values.length !== expected.length ||
        !values.every((v, k) => Number.isFinite(v) && v === expected[k])) return false;
  }
  return true;
}

export function geographyConditions(conditions: GeographyConditions): GeographyConditions {
  if (!Number.isFinite(conditions.tilt) || conditions.tilt < 0 || conditions.tilt > 90 ||
      ![2.5, 10, 50].includes(conditions.retainedDepth)) throw new RangeError('Invalid geography conditions.');
  return { tilt: conditions.tilt, orbit: normalizeOrbit(conditions.orbit), retainedDepth: conditions.retainedDepth };
}

export function geographyRequest(id: number, conditions: GeographyConditions): GeographyRequest {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid geography request id.');
  return { ...geographyConditions(conditions), id, profile: 'earth-geography', grid: GEOGRAPHY_GRID_ID,
    mask: GEOGRAPHY_MASK_DIGEST, solver: GEOGRAPHY_SOLVER_ID, stepsPerDay: 2 };
}

export function geographyRequestKey(request: GeographyRequest): string {
  const c = geographyConditions(request);
  if (!Number.isSafeInteger(request.id) || request.id < 1 || request.profile !== 'earth-geography' ||
      request.grid !== GEOGRAPHY_GRID_ID || request.mask !== GEOGRAPHY_MASK_DIGEST ||
      request.solver !== GEOGRAPHY_SOLVER_ID || request.stepsPerDay !== 2) throw new RangeError('Invalid geography provenance.');
  return `${request.profile}:${request.grid}:${request.mask}:${request.solver}:half-day:${c.tilt}:${orbitKey(c.orbit)}:retained-${c.retainedDepth}`;
}

/** Reject malformed or mismatched replies before any field becomes visible. */
export function matchingGeographySolution(solution: GeographyClimateSolution, request: GeographyRequest): boolean {
  // Fail closed on runtime shape errors. TypeScript types do not validate a
  // structured-cloned message; no malformed field may reach the cache.
  try {
  const p = solution?.provenance;
  return !!solution && solution.tilt === request.tilt && orbitKey(solution.orbit) === orbitKey(request.orbit) &&
    validGrid(solution) &&
    solution.temperatures instanceof Float64Array && solution.temperatures.length === 365 * 648 &&
    solution.landFraction instanceof Float64Array && solution.landFraction.length === 648 &&
    solution.stepsPerDay === 2 && p?.id === request.mask && p.grid === request.grid && p.solver === request.solver &&
    p.sourceVersion === '4.1.0' && p.sourceArchiveSha256 === GEOGRAPHY_SOURCE_ARCHIVE &&
    p.retainedClassicDepth === request.retainedDepth && p.stepsPerDay === 2 &&
    p.A === 210 && p.B === 2 && p.D === .55 && p.periodicTolerance === 1e-6 &&
    p.pcgRelativeTolerance === 1e-11 && p.pcgAbsoluteTolerance === 1e-11 &&
    Number.isFinite(solution.periodicError) && solution.periodicError >= 0 && solution.periodicError < 1e-6 &&
    Number.isFinite(solution.energyResidual) && Math.abs(solution.energyResidual) < 1e-5 &&
    Number.isFinite(solution.maxStepEnergyResidual) && solution.maxStepEnergyResidual >= 0 && solution.maxStepEnergyResidual < 1e-5 &&
    Number.isFinite(solution.maxRelativeLinearResidual) && solution.maxRelativeLinearResidual >= 0 && solution.maxRelativeLinearResidual <= 1e-10 &&
    Number.isInteger(solution.maxLinearIterations) && solution.maxLinearIterations >= 0 && solution.maxLinearIterations <= 648 &&
    Number.isInteger(solution.years) && solution.years >= 2 && solution.years <= 80 &&
    validTemperatureSummary(solution) && solution.landFraction.every(f => Number.isFinite(f) && f >= 0 && f <= 1);
  } catch { return false; }
}

function validTemperatureSummary(solution: GeographyClimateSolution): boolean {
  if (!Number.isFinite(solution.minimum) || !Number.isFinite(solution.maximum) || solution.minimum > solution.maximum) return false;
  let low = Infinity, high = -Infinity;
  for (const value of solution.temperatures) {
    if (!Number.isFinite(value)) return false;
    low = Math.min(low, value); high = Math.max(high, value);
  }
  return low === solution.minimum && high === solution.maximum;
}

/** Include all owned typed-array bytes, not only daily temperatures. */
export function geographySolutionBytes(s: GeographyClimateSolution): number {
  return s.temperatures.byteLength + s.landFraction.byteLength +
    s.grid.phi.byteLength + s.grid.lambda.byteLength + s.grid.weight.byteLength +
    s.grid.northSouth.byteLength + s.grid.eastWest.byteLength;
}
