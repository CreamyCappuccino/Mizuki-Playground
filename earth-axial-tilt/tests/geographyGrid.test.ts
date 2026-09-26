import { describe, expect, it } from 'vitest';
import { buildGeographyGrid, geographyTransport, visitGeographyEdges,
  weightedGeographyTransport } from '../src/physics/geographyGrid';

const dot = (a: ArrayLike<number>, b: ArrayLike<number>) =>
  Array.from(a).reduce((sum, value, k) => sum + value * b[k], 0);

describe('isolated geography finite-volume geometry', () => {
  it('uses phi midpoints, south/west-first order and full spherical area', () => {
    const grid = buildGeographyGrid();
    expect(grid.size).toBe(648);
    expect(grid.phi[0] * 180 / Math.PI).toBeCloseTo(-85, 12);
    expect(grid.phi[17] * 180 / Math.PI).toBeCloseTo(85, 12);
    expect(grid.lambda[0] * 180 / Math.PI).toBeCloseTo(-175, 12);
    expect(grid.lambda[35] * 180 / Math.PI).toBeCloseTo(175, 12);
    expect(Array.from(grid.weight).reduce((a, b) => a + b) * grid.nlon * grid.dlambda)
      .toBeCloseTo(4 * Math.PI, 12);
  });

  it('has positive shared faces once, a periodic seam and no exterior pole flux', () => {
    const grid = buildGeographyGrid(), faces: string[] = [];
    visitGeographyEdges(grid, (a, b, g) => {
      expect(g).toBeGreaterThan(0);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(b).toBeLessThan(grid.size);
      faces.push(`${Math.min(a, b)}:${Math.max(a, b)}`);
    });
    expect(new Set(faces).size).toBe(grid.nlat * grid.nlon + (grid.nlat - 1) * grid.nlon);
    expect(faces).toContain('0:35');
    expect(faces).toContain('612:647');
    expect(grid.northSouth.length).toBe(17);
    expect(geographyTransport(new Float64Array(grid.size).fill(17), grid))
      .toEqual(new Float64Array(grid.size));
  });

  it('is symmetric, dissipative and globally conservative for nonuniform fields', () => {
    const grid = buildGeographyGrid();
    const a = Float64Array.from({ length: grid.size }, (_, k) => Math.sin(0.17 * k));
    const b = Float64Array.from(a, (_, k) => Math.cos(0.13 * k));
    const la = weightedGeographyTransport(a, grid), lb = weightedGeographyTransport(b, grid);
    expect(dot(a, lb)).toBeCloseTo(dot(la, b), 10);
    expect(dot(a, la)).toBeLessThan(0);
    expect(Array.from(la).reduce((sum, v) => sum + v, 0)).toBeCloseTo(0, 10);
    // Storage-only derivative is L(T)/C: even variable C conserves sum(w*C*dT/dt).
    const derivative = geographyTransport(a, grid);
    let capacityWeightedChange = 0;
    for (let k = 0; k < grid.size; k += 1) {
      const capacity = 4e6 * (2.5 + 47.5 * (1 + Math.sin(k)) / 2);
      capacityWeightedChange += grid.weight[Math.floor(k / grid.nlon)] * capacity * (derivative[k] / capacity);
    }
    expect(capacityWeightedChange).toBeCloseTo(0, 10);
  });

  it.each([
    [18, 0.0028811671, 0.0234076], [36, 0.0007849835, 0.0119250],
    [72, 0.0002109333, 0.0059903], [144, 0.0000561486, 0.0029986],
  ])('reproduces D-inclusive spherical harmonic convergence at %i latitude rows', (nlat, rms, maximum) => {
    const grid = buildGeographyGrid(nlat, 2 * nlat, 0.55);
    const field = Float64Array.from({ length: grid.size }, (_, k) =>
      Math.cos(grid.phi[Math.floor(k / grid.nlon)]) * Math.cos(grid.lambda[k % grid.nlon]));
    const transport = geographyTransport(field, grid);
    let squared = 0, actualMaximum = 0;
    for (let k = 0; k < grid.size; k += 1) {
      const error = transport[k] + 2 * grid.diffusion * field[k];
      squared += grid.weight[Math.floor(k / grid.nlon)] * error ** 2;
      actualMaximum = Math.max(actualMaximum, Math.abs(error));
    }
    expect(Math.sqrt(squared / (2 * grid.nlon))).toBeCloseTo(rms, 10);
    expect(actualMaximum).toBeCloseTo(maximum, 6);
  });

  it('has exactly zero transport for D=0 and rejects invalid inputs', () => {
    const grid = buildGeographyGrid(18, 36, 0);
    expect(geographyTransport(Float64Array.from({ length: 648 }, (_, k) => k), grid))
      .toEqual(new Float64Array(648));
    expect(() => buildGeographyGrid(18.5)).toThrow(RangeError);
    expect(() => buildGeographyGrid(18, 3)).toThrow(RangeError);
    expect(() => buildGeographyGrid(18, 36, NaN)).toThrow(RangeError);
    expect(() => geographyTransport([NaN], grid)).toThrow(RangeError);
    expect(() => geographyTransport(new Float64Array(648).fill(Infinity), grid)).toThrow(RangeError);
  });
});
