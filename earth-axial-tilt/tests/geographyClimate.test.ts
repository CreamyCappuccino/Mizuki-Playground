import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { solveGeographyClimate, type GeographyMask } from '../src/physics/geographyClimate';
import { solveSeasonalClimate } from '../src/physics/energyBalance';
import { uniformLatitudeOracle } from './geographyClimateOracle';

const data = JSON.parse(readFileSync(new URL('../data/land-fractions.json', import.meta.url), 'utf8'));
const production: GeographyMask = { nlat: 18, nlon: 36, fractions: data.fractions,
  provenance: { id: data.fractionsFloat64LESha256, sourceVersion: data.source.version,
    sourceArchiveSha256: data.source.archiveSha256, quadratureSamplesPerAxis: data.quadrature.samplesPerAxis,
    builderSha256: JSON.stringify(data.builderSha256) } };
const uniform = (land: boolean): GeographyMask => ({ nlat: 18, nlon: 36,
  fractions: new Float64Array(648).fill(land ? 1 : 0), provenance: { id: land ? 'test-uniform-land' : 'test-uniform-ocean' } });

describe('isolated annual geography EBM', () => {
  it.each([true, false])('reduces uniform land=%s to independently computed same-phi-grid 1D', land => {
    const solution = solveGeographyClimate(23.44, uniform(land));
    const reference = uniformLatitudeOracle(23.44, land ? 2.5 : 50);
    let max = 0;
    for (let day = 0; day < 365; day += 1) for (let row = 0; row < 18; row += 1) {
      const base = day * 648 + row * 36;
      max = Math.max(max, Math.abs(solution.temperatures[base] - reference[day * 18 + row]));
      for (let lon = 1; lon < 36; lon += 1) expect(solution.temperatures[base + lon]).toBe(solution.temperatures[base]);
    }
    expect(max).toBeLessThan(1e-5);
    expect(solution.periodicError).toBeLessThan(1e-6);
    expect(Math.abs(solution.energyResidual)).toBeLessThan(1e-5);
  }, 30000);

  it.each([
    { tilt: 23.44, orbit: undefined }, { tilt: 60, orbit: undefined },
    { tilt: 90, orbit: { eccentricity: 0.3, perihelion: 90, axis: 0 } },
  ])('converges production mask at tilt=$tilt without clipping or fallback', ({ tilt, orbit }) => {
    const solution = solveGeographyClimate(tilt, production, { orbit });
    expect(solution.temperatures).toHaveLength(365 * 648);
    expect(solution.temperatures.byteLength).toBe(1892160);
    expect(solution.temperatures.every(Number.isFinite)).toBe(true);
    expect(solution.periodicError).toBeLessThan(1e-6);
    expect(Math.abs(solution.energyResidual)).toBeLessThan(1e-5);
    expect(solution.maxStepEnergyResidual).toBeLessThan(1e-5);
    expect(solution.maxRelativeLinearResidual).toBeLessThan(1.1e-11);
    expect(solution.years).toBeLessThanOrEqual(80);
    expect(solution.provenance.sourceVersion).toBe('4.1.0');
    expect(solution.provenance.id).toBe(data.fractionsFloat64LESha256);
    // Same latitude/different material longitudes must not be a zonal copy.
    if (tilt === 23.44) {
      const amplitude = (cell: number) => {
        const values = Array.from({ length: 365 }, (_, day) => solution.temperatures[day * 648 + cell]);
        return Math.max(...values) - Math.min(...values);
      };
      expect(Math.abs(amplitude(11 * 36 + 19) - amplitude(11 * 36 + 3))).toBeGreaterThan(1);
    }
  }, 30000);

  it('has no axial seasonal cycle for uniform material at zero tilt/circular orbit', () => {
    const solution = solveGeographyClimate(0, uniform(false));
    let max = 0;
    for (let day = 1; day < 365; day += 1) for (let k = 0; k < 648; k += 1) {
      max = Math.max(max, Math.abs(solution.temperatures[day * 648 + k] - solution.temperatures[k]));
    }
    expect(max).toBeLessThan(1e-7);
  }, 30000);

  it('converges under half-day to quarter-day refinement for a hemisphere land mask', () => {
    const mask: GeographyMask = { nlat: 18, nlon: 36,
      fractions: Float64Array.from({ length: 648 }, (_, k) => k % 36 >= 18 ? 1 : 0),
      provenance: { id: 'test-lon-positive-land' } };
    const half = solveGeographyClimate(23.44, mask), quarter = solveGeographyClimate(23.44, mask, { stepsPerDay: 4 });
    let max = 0;
    for (let k = 0; k < half.temperatures.length; k += 1) max = Math.max(max, Math.abs(half.temperatures[k] - quarter.temperatures[k]));
    expect(max).toBeLessThan(0.04);
  }, 30000);

  it('preserves Classic full-array bytes at accepted main baseline a8c096f', () => {
    const hash = (tilt: number, depth: number) => {
      const field = solveSeasonalClimate(tilt, depth).temperatures;
      return createHash('sha256').update(Buffer.from(field.buffer, field.byteOffset, field.byteLength)).digest('hex');
    };
    expect(hash(23.44, 10)).toBe('a2b593c1ba6843fd81d3db9b5c33f77a22f39b23cbcd3ccd94a89ddc79cb4576');
    expect(hash(90, 2.5)).toBe('91e67f7e926a89620286011cb60c1253e699880ed1deda8232fdb9cf1259df92');
  });

  it('inspects annual spatial refinement on a uniform land world (same material)', () => {
    const coarse = solveGeographyClimate(23.44, uniform(true));
    const fine = solveGeographyClimate(23.44, { nlat: 36, nlon: 72,
      fractions: new Float64Array(2592).fill(1), provenance: { id: 'test-uniform-land-36x72' } });
    let maximum = 0, squared = 0;
    for (let day = 0; day < 365; day += 1) for (let row = 0; row < 18; row += 1) for (let col = 0; col < 36; col += 1) {
      let aggregate = 0;
      for (let dr = 0; dr < 2; dr += 1) for (let dc = 0; dc < 2; dc += 1) {
        aggregate += fine.temperatures[day * 2592 + (2 * row + dr) * 72 + 2 * col + dc] *
          fine.grid.weight[2 * row + dr] / (2 * coarse.grid.weight[row]);
      }
      const diff = aggregate - coarse.temperatures[day * 648 + row * 36 + col];
      maximum = Math.max(maximum, Math.abs(diff));
      squared += coarse.grid.weight[row] * diff ** 2;
    }
    expect(maximum).toBeLessThan(1.5);
    expect(Math.sqrt(squared / (365 * 72))).toBeLessThan(0.3);
    expect(fine.periodicError).toBeLessThan(1e-6);
  }, 30000);

  it('fails explicitly on periodic/linear nonconvergence and invalid metadata/conditions', () => {
    expect(() => solveGeographyClimate(23.44, production, { maxYears: 2 })).toThrow(/periodic year/);
    expect(() => solveGeographyClimate(23.44, production, { pcg: { maxIterations: 1 } })).toThrow(/PCG did not converge/);
    expect(() => solveGeographyClimate(NaN, production)).toThrow(RangeError);
    expect(() => solveGeographyClimate(23.44, { ...production, nlat: 72, nlon: 144 })).toThrow(/limited to 36×72/);
    expect(() => solveGeographyClimate(23.44, production, { stepsPerDay: 0 })).toThrow(RangeError);
    expect(() => solveGeographyClimate(23.44, { ...production, provenance: { id: '' } })).toThrow(RangeError);
    expect(() => solveGeographyClimate(23.44, production, { orbit: { eccentricity: 0.31, perihelion: 90, axis: 0 } })).toThrow(RangeError);
  }, 30000);
});
