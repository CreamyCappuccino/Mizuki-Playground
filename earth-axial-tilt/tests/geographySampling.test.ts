import { describe, expect, it } from 'vitest';
import { buildGeographyGrid } from '../src/physics/geographyGrid';
import type { GeographyClimateSolution } from '../src/physics/geographyClimate';
import { geographyCell, geographyMaterial, geographyAnnualTemperatures, geographyLongitudeSlice,
  sampleGeographyCell, sampleGeographyTemperature } from '../src/physics/geographySampling';
import { productionGeographyMask, GEOGRAPHY_MASK_DIGEST } from '../src/physics/geographyMask';

function fixture(): GeographyClimateSolution {
  const grid = buildGeographyGrid();
  return { grid, tilt: 23.44, orbit: { eccentricity: 0, perihelion: 0, axis: 0 },
    landFraction: Float64Array.from({ length: grid.size }, (_, k) => k / (grid.size - 1)),
    temperatures: Float64Array.from({ length: 365 * grid.size }, (_, k) => 1000 * Math.floor(k / grid.size) + k % grid.size),
    years: 1, stepsPerDay: 2, periodicError: 0, energyResidual: 0, maxStepEnergyResidual: 0,
    maxRelativeLinearResidual: 0, maxLinearIterations: 1, minimum: 0, maximum: 1,
    provenance: { id: 'synthetic-sampling-fixture' } };
}

describe('geography common cell sampler', () => {
  it('fixes row/column order, seam and exact angular edge conventions', () => {
    const grid = buildGeographyGrid();
    expect(geographyCell(grid, -85, -175)).toMatchObject({ index: 0, row: 0, column: 0 });
    expect(geographyCell(grid, 85, 175)).toMatchObject({ index: 647, row: 17, column: 35 });
    expect(geographyCell(grid, 0, -180).index).toBe(324);
    expect(geographyCell(grid, 0, 180).index).toBe(324);
    expect(geographyCell(grid, 0, 540).index).toBe(324);
    expect(geographyCell(grid, -80, -170)).toMatchObject({ row: 1, column: 1 });
    expect(geographyCell(grid, -80 - 1e-8, -170 - 1e-8)).toMatchObject({ row: 0, column: 0 });
  });
  it('keeps the selected polar-cap longitude rather than inventing a pole value', () => {
    const grid = buildGeographyGrid();
    expect(geographyCell(grid, 90, 0)).toMatchObject({ row: 17, column: 18, polarCap: true });
    expect(geographyCell(grid, -90, -180)).toMatchObject({ row: 0, column: 0, polarCap: true });
    expect(geographyCell(grid, 89, 0).index).toBe(geographyCell(grid, 90, 0).index);
  });
  it('is cell-constant spatially and periodically interpolated only in time', () => {
    const s = fixture();
    expect(sampleGeographyTemperature(s, 21, 121, 1)).toBe(sampleGeographyTemperature(s, 29, 129, 1));
    expect(sampleGeographyCell(s, 42, 1)).toBe(42);
    expect(sampleGeographyCell(s, 42, 366)).toBe(42);
    expect(sampleGeographyCell(s, 42, 0)).toBe(364042);
    expect(sampleGeographyCell(s, 42, 365.5)).toBe(182042);
    expect(sampleGeographyCell(s, 42, 1.5)).toBe(542);
    expect(sampleGeographyCell(s, 42, -364)).toBe(42);
  });
  it('uses the exact same cell for material, annual curves and longitude slice', () => {
    const s = fixture(), cell = geographyCell(s.grid, 25, 125);
    expect(cell).toMatchObject({ row: 11, column: 30, index: 426 });
    const material = geographyMaterial(s, cell);
    expect(material.landFraction).toBe(s.landFraction[cell.index]);
    expect(material.effectiveDepth).toBe(2.5 * material.landFraction + 50 * (1 - material.landFraction));
    const annual = geographyAnnualTemperatures(s, 25, 125), slice = geographyLongitudeSlice(s, 125);
    for (let day = 0; day < 365; day++) expect(slice[11 * 365 + day]).toBe(annual[day]);
    expect(geographyLongitudeSlice(s, -180)).toEqual(geographyLongitudeSlice(s, 180));
    expect(geographyAnnualTemperatures(s, 25, 125)[0]).not.toBe(geographyAnnualTemperatures(s, 25, -145)[0]);
  });
  it('rejects invalid inputs and malformed/nonfinite fields explicitly', () => {
    const s = fixture();
    for (const [lat, lon] of [[91, 0], [-91, 0], [NaN, 0], [0, Infinity]]) {
      expect(() => geographyCell(s.grid, lat, lon)).toThrow();
    }
    for (const k of [-1, 648, .5]) expect(() => sampleGeographyCell(s, k, 1)).toThrow();
    expect(() => sampleGeographyCell(s, 0, Infinity)).toThrow();
    expect(() => sampleGeographyCell({ ...s, temperatures: new Float64Array(0) }, 0, 1)).toThrow();
    s.temperatures[0] = NaN;
    expect(() => sampleGeographyCell(s, 0, 1)).toThrow();
    s.landFraction[0] = 2;
    expect(() => geographyMaterial(s, geographyCell(s.grid, -85, -175))).toThrow();
  });
  it('verifies production bytes and gives each consumer its own mask snapshot', async () => {
    const a = await productionGeographyMask(), b = await productionGeographyMask();
    expect(a.provenance.id).toBe(GEOGRAPHY_MASK_DIGEST);
    expect(a.fractions.length).toBe(648);
    expect(a.fractions[426]).toBe(.07470703125);
    expect(a.fractions[gridIndex(25, -145)]).toBe(0);
    (a.fractions as Float64Array)[426] = 0;
    expect(b.fractions[426]).toBe(.07470703125);
  });
});
function gridIndex(lat: number, lon: number): number { return geographyCell(buildGeographyGrid(), lat, lon).index; }
