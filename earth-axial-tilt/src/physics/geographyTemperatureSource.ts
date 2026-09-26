import type { GeographyClimateSolution } from './geographyClimate';
import { geographyConditions, type GeographyConditions } from './geographyProtocol';
import { GEOGRAPHY_GRID_ID, GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID } from './geographyMask';
import { orbitKey, type OrbitParameters } from './orbit';

/** Only validated client fields belong here; this adapter never runs a solver. */
export interface GeographyTemperatureSource {
  model: 'energy-balance';
  climateProfile: 'earth-geography';
  tilt: number;
  orbit: OrbitParameters;
  depth: number;
  solution: null;
  geography: GeographyClimateSolution | null;
}

export function geographyTemperatureSource(conditions: GeographyConditions,
  geography: GeographyClimateSolution | null): GeographyTemperatureSource {
  const c = geographyConditions(conditions);
  return { model: 'energy-balance', climateProfile: 'earth-geography', tilt: c.tilt,
    orbit: c.orbit, depth: c.retainedDepth, solution: null, geography };
}

/** Cheap per-frame ownership check. Full array validation is the client's job. */
export function geographySourceReady(source: GeographyTemperatureSource): boolean {
  const s = source.geography;
  return source.model === 'energy-balance' && !!s && s.tilt === source.tilt &&
    orbitKey(s.orbit) === orbitKey(source.orbit) &&
    s.provenance.retainedClassicDepth === source.depth &&
    s.provenance.id === GEOGRAPHY_MASK_DIGEST && s.provenance.grid === GEOGRAPHY_GRID_ID &&
    s.provenance.solver === GEOGRAPHY_SOLVER_ID && s.stepsPerDay === 2;
}
