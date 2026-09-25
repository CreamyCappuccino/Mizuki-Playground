import { orbitKey, maximumSolarFactor } from './orbit';
import { dailyMeanInsolation, dayLengthHours, SOLAR_CONSTANT } from './solar';
import { isThermalReady, temperatureFromSource, type TemperatureSource } from './temperatureModel';

export type AtlasMetric = 'temperature' | 'insolation' | 'daylight';
export type AtlasView = 'absolute' | 'difference';
export interface AtlasConfig {
  metric: AtlasMetric;
  view: AtlasView;
  source: TemperatureSource;
  reference: TemperatureSource;
}
export interface AtlasReading { current: number; reference: number | null; value: number }
export interface AtlasField {
  /** Row-major: 90 N down to 90 S in 2-degree samples; columns are days 1..365. */
  values: Float64Array;
  rows: number;
  columns: number;
  minimum: number;
  maximum: number;
}
export const ATLAS_ROWS = 91;
export const ATLAS_DAYS = 365;
export const ATLAS_UNITS = { temperature: '°C', insolation: 'W/m²', daylight: 'h' } as const;

export function atlasReady(config: AtlasConfig): boolean {
  if (config.metric !== 'temperature') return true;
  if (!isThermalReady(config.source)) return false;
  return config.view === 'absolute' || (config.reference.tilt === 23.44 &&
    config.reference.model === config.source.model && config.reference.depth === config.source.depth &&
    orbitKey(config.reference.orbit) === orbitKey(config.source.orbit) &&
    isThermalReady(config.reference));
}

/** Same functions and thermal field as the globe/readout. Never solve another climate here. */
export function atlasReading(config: AtlasConfig, latitude: number, day: number): AtlasReading | null {
  if (!Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(day) || day < 1 || day > 366 ||
    !Number.isFinite(config.source.tilt) || config.source.tilt < 0 || config.source.tilt > 90) {
    throw new RangeError('Atlas coordinates and tilt must be finite and inside the model domain.');
  }
  if (!atlasReady(config)) return null;
  const sample = (source: TemperatureSource): number => config.metric === 'temperature'
    ? temperatureFromSource(source, latitude, day)!
    : config.metric === 'insolation' ? dailyMeanInsolation(latitude, day, source.tilt, source.orbit)
      : dayLengthHours(latitude, day, source.tilt, source.orbit);
  const current = sample(config.source);
  // Astronomy always uses exactly 23.44 degrees even while the thermal worker is unavailable.
  const reference = config.view === 'difference' ? sample({ ...config.reference, tilt: 23.44, orbit:config.source.orbit }) : null;
  return { current, reference, value: reference === null ? current : current - reference };
}

export function buildAtlasField(config: AtlasConfig): AtlasField | null {
  if (!atlasReady(config)) return null;
  const values = new Float64Array(ATLAS_ROWS * ATLAS_DAYS);
  let minimum = Infinity, maximum = -Infinity;
  for (let row = 0; row < ATLAS_ROWS; row += 1) {
    const latitude = 90 - row * 2;
    for (let column = 0; column < ATLAS_DAYS; column += 1) {
      const value = atlasReading(config, latitude, column + 1)!.value;
      if (!Number.isFinite(value)) throw new Error('Non-finite atlas value.');
      values[row * ATLAS_DAYS + column] = value;
      minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
    }
  }
  return { values, rows: ATLAS_ROWS, columns: ATLAS_DAYS, minimum, maximum };
}

export interface AtlasScale { minimum: number; maximum: number; diverging: boolean }
export function atlasScale(config: AtlasConfig, field: AtlasField): AtlasScale {
  if (config.view === 'difference') {
    const extent = Math.max(1, Math.abs(field.minimum), Math.abs(field.maximum));
    const step = 10 ** Math.floor(Math.log10(extent));
    const rounded = Math.ceil(extent / step) * step;
    return { minimum: -rounded, maximum: rounded, diverging: true };
  }
  if (config.metric === 'insolation') return { minimum: 0, maximum: SOLAR_CONSTANT * maximumSolarFactor(config.source.orbit), diverging: false };
  if (config.metric === 'daylight') return { minimum: 0, maximum: 24, diverging: false };
  const minimum = Math.floor(field.minimum / 5) * 5;
  const maximum = Math.max(minimum + 5, Math.ceil(field.maximum / 5) * 5);
  return { minimum, maximum, diverging: false };
}

/** Normalised plot coordinates, not page coordinates. Latitudes use a linear (not area) axis. */
export function atlasSelection(fractionX: number, fractionY: number): { day: number; latitude: number } | null {
  if (![fractionX, fractionY].every(Number.isFinite)) return null;
  const bound = (x: number) => Math.min(1, Math.max(0, x));
  return { day: Math.round(1 + bound(fractionX) * 364), latitude: Math.round((90 - bound(fractionY) * 180) * 10) / 10 };
}
