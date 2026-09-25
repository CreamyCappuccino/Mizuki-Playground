import { orbitKey, type OrbitParameters } from './orbit';
import { temperatureEstimateC, type AnnualPoint } from './climate';
import { dailyMeanInsolation, dayLengthHours } from './solar';
import { sampleThermalTemperature, type ThermalSolution } from './energyBalance';

export type TemperatureModel = 'illustrative' | 'energy-balance';
export interface TemperatureSource {
  orbit?: OrbitParameters;
  model: TemperatureModel;
  tilt: number;
  depth: number;
  solution: ThermalSolution | null;
}
export function isThermalReady(source: TemperatureSource): boolean {
  return source.model === 'illustrative' || (source.solution !== null &&
    source.solution.tilt === source.tilt && source.solution.depth === source.depth && orbitKey(source.solution.orbit) === orbitKey(source.orbit));
}
/** Never return a previous configuration's temperature as the new configuration. */
export function temperatureFromSource(source: TemperatureSource, latitude: number, day: number): number | null {
  if (!isThermalReady(source)) return null;
  return source.model === 'illustrative' ? temperatureEstimateC(latitude, day, source.tilt, source.orbit)
    : sampleThermalTemperature(source.solution!, latitude, day);
}
export function profileFromSource(source: TemperatureSource, latitude: number): AnnualPoint[] | null {
  if (!isThermalReady(source)) return null;
  return Array.from({ length: 365 }, (_, i) => ({
    day: i + 1,
    daylight: dayLengthHours(latitude, i + 1, source.tilt, source.orbit),
    insolation: dailyMeanInsolation(latitude, i + 1, source.tilt, source.orbit),
    temperature: temperatureFromSource(source, latitude, i + 1)!,
  }));
}
export function temperatureScale(model: TemperatureModel): { min: number; max: number } {
  // Fixed, labelled display scales. The solver and numerical readouts are NEVER clipped.
  return model === 'energy-balance' ? { min: -100, max: 180 } : { min: -65, max: 55 };
}
