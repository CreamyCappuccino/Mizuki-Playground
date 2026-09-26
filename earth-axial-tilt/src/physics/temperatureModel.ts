import { orbitKey, type OrbitParameters } from './orbit';
import { temperatureEstimateC, type AnnualPoint } from './climate';
import { dailyMeanInsolation, dayLengthHours } from './solar';
import { sampleThermalTemperature, type ThermalSolution } from './energyBalance';
import type { ClimateProfile } from './climateGeography';
import { geographySourceReady, type GeographyTemperatureSource } from './geographyTemperatureSource';
import { sampleGeographyTemperature } from './geographySampling';

export type TemperatureModel = 'illustrative' | 'energy-balance';
export interface ZonalTemperatureSource {
  orbit?: OrbitParameters;
  climateProfile?: ClimateProfile;
  model: TemperatureModel;
  tilt: number;
  depth: number;
  solution: ThermalSolution | null;
}
// Compatibility name for existing zonal-only UI owners. Migrate each owner to
// ScientificTemperatureSource together with its longitude-aware wiring.
export type TemperatureSource = ZonalTemperatureSource;
export type ScientificTemperatureSource = ZonalTemperatureSource | GeographyTemperatureSource;
export function isGeographySource(source: ScientificTemperatureSource): source is GeographyTemperatureSource {
  return source.climateProfile === 'earth-geography';
}
export function isThermalReady(source: ScientificTemperatureSource): boolean {
  if (isGeographySource(source)) return geographySourceReady(source);
  return source.model === 'illustrative' || (source.solution !== null &&
    source.solution.tilt === source.tilt && source.solution.depth === source.depth &&
    source.solution.climateProfile === (source.climateProfile ?? 'classic') &&
    orbitKey(source.solution.orbit) === orbitKey(source.orbit));
}
/** Never return a previous configuration's temperature as the new configuration. */
export function temperatureFromSource(source: ScientificTemperatureSource, latitude: number, day: number, longitude?: number): number | null {
  if (isGeographySource(source) && !Number.isFinite(longitude))
    throw new RangeError('Earth geography requires a finite longitude.');
  if (!isThermalReady(source)) return null;
  if (isGeographySource(source)) return sampleGeographyTemperature(source.geography!, latitude, longitude!, day);
  return source.model === 'illustrative' ? temperatureEstimateC(latitude, day, source.tilt, source.orbit)
    : sampleThermalTemperature(source.solution!, latitude, day);
}
export function profileFromSource(source: ScientificTemperatureSource, latitude: number, longitude?: number): AnnualPoint[] | null {
  if (isGeographySource(source) && !Number.isFinite(longitude))
    throw new RangeError('Earth geography requires a finite longitude.');
  if (!isThermalReady(source)) return null;
  return Array.from({ length: 365 }, (_, i) => ({
    day: i + 1,
    daylight: dayLengthHours(latitude, i + 1, source.tilt, source.orbit),
    insolation: dailyMeanInsolation(latitude, i + 1, source.tilt, source.orbit),
    temperature: temperatureFromSource(source, latitude, i + 1, longitude)!,
  }));
}
export function temperatureScale(model: TemperatureModel): { min: number; max: number } {
  // Fixed, labelled display scales. The solver and numerical readouts are NEVER clipped.
  return model === 'energy-balance' ? { min: -100, max: 180 } : { min: -65, max: 55 };
}
