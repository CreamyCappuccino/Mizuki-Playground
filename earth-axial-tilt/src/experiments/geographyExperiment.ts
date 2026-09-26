import { GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID } from '../physics/geographyMask';
import { normalizeOrbit, type OrbitParameters } from '../physics/orbit';

export interface GeographyExperiment {
  tilt: number;
  orbit: OrbitParameters;
  day: number;
  latitude: number;
  longitude: number;
  layer: 'temperature' | 'difference' | 'land';
  reference: boolean;
}

export const DEFAULT_GEOGRAPHY_EXPERIMENT: Readonly<GeographyExperiment> = Object.freeze({
  tilt: 23.44,
  orbit: Object.freeze({ eccentricity: 0, perihelion: 0, axis: 0 }),
  day: 172,
  latitude: 25.033,
  longitude: 121.5654,
  layer: 'temperature',
  reference: true,
});

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

function validateState(value: unknown): GeographyExperiment {
  if (!record(value) || !record(value.orbit)) throw new Error('Invalid geography state.');
  const tilt = value.tilt, day = value.day, latitude = value.latitude, longitude = value.longitude;
  const reference = value.reference, layer = value.layer;
  if (typeof tilt !== 'number' || !Number.isFinite(tilt) || tilt < 0 || tilt > 90 ||
      typeof day !== 'number' || !Number.isFinite(day) || day < 1 || day >= 366 ||
      typeof latitude !== 'number' || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 ||
      typeof longitude !== 'number' || !Number.isFinite(longitude) || longitude < -180 || longitude > 180 ||
      typeof reference !== 'boolean' || !['temperature', 'difference', 'land'].includes(layer as string) ||
      (layer === 'difference' && !reference)) throw new Error('Invalid geography state.');
  const o = value.orbit;
  for (const key of ['eccentricity', 'perihelion', 'axis'] as const) {
    if (typeof o[key] !== 'number' || !Number.isFinite(o[key])) throw new Error('Invalid geography orbit.');
  }
  const orbit = normalizeOrbit({ eccentricity: o.eccentricity as number, perihelion: o.perihelion as number, axis: o.axis as number });
  return { tilt, orbit, day, latitude, longitude, layer: layer as GeographyExperiment['layer'], reference };
}

export function encodeGeographyExperiment(state: GeographyExperiment): string {
  const clean = validateState(state);
  return JSON.stringify({
    application: 'earth-geography-preview', version: 1,
    mask: GEOGRAPHY_MASK_DIGEST, solver: GEOGRAPHY_SOLVER_ID, state: clean,
  });
}

export function decodeGeographyExperiment(text: string): GeographyExperiment {
  if (text.length > 4096) throw new Error('Geography settings too large.');
  const value: unknown = JSON.parse(text);
  if (!record(value) || value.application !== 'earth-geography-preview' || value.version !== 1 ||
      value.mask !== GEOGRAPHY_MASK_DIGEST || value.solver !== GEOGRAPHY_SOLVER_ID) {
    throw new Error('Unsupported geography settings.');
  }
  return validateState(value.state);
}

export function geographyExperimentHash(state: GeographyExperiment): string {
  return `#geo=${encodeURIComponent(encodeGeographyExperiment(state))}`;
}

export function geographyExperimentFromHash(hash: string): GeographyExperiment | null {
  if (!hash.startsWith('#geo=')) return null;
  if (hash.length > 12293) throw new Error('Geography settings too large.');
  return decodeGeographyExperiment(decodeURIComponent(hash.slice(5)));
}
