import { temperatureEstimateC, type AnnualPoint } from './climate';
import { dailyMeanInsolation, dayLengthHours } from './solar';
import { sampleThermalTemperature, type ThermalSolution } from './energyBalance';
import { CLASSIC_ORBIT, orbitKey, type OrbitParameters } from './orbit';

export type TemperatureModel = 'illustrative' | 'energy-balance';
export interface TemperatureSource {
  model: TemperatureModel;
  tilt: number;
  depth: number;
  orbit?: OrbitParameters;
  solution: ThermalSolution | null;
}
export function isThermalReady(source: TemperatureSource): boolean {
  return source.model === 'illustrative' || (source.solution !== null &&
    source.solution.tilt === source.tilt && source.solution.depth === source.depth &&
    orbitKey(source.solution.orbit ?? CLASSIC_ORBIT) === orbitKey(source.orbit ?? CLASSIC_ORBIT));
}
/** Never return a previous configuration's temperature as the new configuration. */
export function temperatureFromSource(source: TemperatureSource, latitude: number, day: number): number | null {
  if (!isThermalReady(source)) return null;
  return source.model === 'illustrative' ? temperatureEstimateC(latitude, day, source.tilt, source.orbit ?? CLASSIC_ORBIT)
    : sampleThermalTemperature(source.solution!, latitude, day);
}
export function profileFromSource(source: TemperatureSource, latitude: number): AnnualPoint[] | null {
  if (!isThermalReady(source)) return null;
  return Array.from({ length: 365 }, (_, i) => ({
    day: i + 1,
    daylight: dayLengthHours(latitude, i + 1, source.tilt, source.orbit ?? CLASSIC_ORBIT),
    insolation: dailyMeanInsolation(latitude, i + 1, source.tilt, source.orbit ?? CLASSIC_ORBIT),
    temperature: temperatureFromSource(source, latitude, i + 1)!,
  }));
}
export function temperatureScale(model: TemperatureModel): { min: number; max: number } {
  // Fixed, labelled display scales. The solver and numerical readouts are NEVER clipped.
  return model === 'energy-balance' ? { min: -100, max: 180 } : { min: -65, max: 55 };
}
