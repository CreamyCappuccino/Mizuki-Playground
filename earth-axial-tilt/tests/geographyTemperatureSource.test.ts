import { describe, expect, it } from 'vitest';
import { geographyTemperatureSource } from '../src/physics/geographyTemperatureSource';
import { isThermalReady, profileFromSource, temperatureFromSource } from '../src/physics/temperatureModel';
import { buildGeographyGrid } from '../src/physics/geographyGrid';
import { geographyCell, sampleGeographyTemperature } from '../src/physics/geographySampling';
import { GEOGRAPHY_GRID_ID, GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID } from '../src/physics/geographyMask';
import type { GeographyClimateSolution } from '../src/physics/geographyClimate';

const conditions = { tilt: 23.44, retainedDepth: 10 as const,
  orbit: { eccentricity: .2, perihelion: 90, axis: 30 } };
function fixture(): GeographyClimateSolution {
  const grid = buildGeographyGrid();
  const temperatures = Float64Array.from({ length: 365 * grid.size }, (_, k) =>
    Math.floor(k / grid.size) + (k % grid.size) / 1000);
  return { tilt: conditions.tilt, orbit: conditions.orbit, grid, temperatures,
    landFraction: new Float64Array(grid.size), years: 31, stepsPerDay: 2,
    periodicError: 7e-7, energyResidual: 1e-6, maxStepEnergyResidual: 1e-7,
    maxRelativeLinearResidual: 1e-11, maxLinearIterations: 40, minimum: 0, maximum: 364.647,
    provenance: { id: GEOGRAPHY_MASK_DIGEST, grid: GEOGRAPHY_GRID_ID,
      solver: GEOGRAPHY_SOLVER_ID, retainedClassicDepth: 10 } };
}

describe('unified temperature source geography adapter', () => {
  it('uses the shared containing-cell and periodic-day sampler at each longitude', () => {
    const field = fixture(), source = geographyTemperatureSource(conditions, field);
    expect(isThermalReady(source)).toBe(true);
    for (const [lat, lon, day] of [[45, 105, 203], [45, -135, 256], [90, 180, 365.5], [-90, -180, 0.5]])
      expect(temperatureFromSource(source, lat, day, lon)).toBe(sampleGeographyTemperature(field, lat, lon, day));
    expect(temperatureFromSource(source, 45, 172, 105)).not.toBe(temperatureFromSource(source, 45, 172, -135));
  });
  it('returns all annual samples from the same selected cell, with unchanged solar forcing', () => {
    const field = fixture(), source = geographyTemperatureSource(conditions, field);
    const a = profileFromSource(source, 45, 105)!, b = profileFromSource(source, 45, -135)!;
    const index = geographyCell(field.grid, 45, 105).index;
    expect(a).toHaveLength(365);
    for (let day = 0; day < 365; day++) {
      expect(a[day].temperature).toBe(field.temperatures[day * 648 + index]);
      expect(a[day].insolation).toBe(b[day].insolation);
      expect(a[day].daylight).toBe(b[day].daylight);
    }
  });
  it('rejects missing longitude rather than silently showing a zonal result', () => {
    const source = geographyTemperatureSource(conditions, fixture());
    expect(() => temperatureFromSource(source, 45, 172)).toThrow('finite longitude');
    expect(() => profileFromSource(source, 45)).toThrow('finite longitude');
    expect(() => temperatureFromSource(source, 45, 172, NaN)).toThrow('finite longitude');
  });
  it('hides absent, old-tilt, old-orbit, old-depth and wrong-provenance fields', () => {
    const source = geographyTemperatureSource(conditions, fixture());
    const stale = [
      { ...source, geography: null }, { ...source, tilt: 60 }, { ...source, depth: 50 },
      { ...source, orbit: { ...source.orbit, axis: 60 } },
      { ...source, geography: { ...source.geography!, provenance: { ...source.geography!.provenance, id: 'wrong' } } },
    ];
    for (const s of stale) {
      expect(isThermalReady(s)).toBe(false);
      expect(temperatureFromSource(s, 45, 172, 105)).toBeNull();
      expect(profileFromSource(s, 45, 105)).toBeNull();
    }
    expect(() => geographyTemperatureSource({ ...conditions, tilt: NaN }, null)).toThrow();
  });
});
