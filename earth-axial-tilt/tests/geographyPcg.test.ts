import { describe, expect, it } from 'vitest';
import { buildGeographyGrid } from '../src/physics/geographyGrid';
import { buildGeographySystem, type PositiveSystem } from '../src/physics/geographySystem';
import { solveGeographyPcg } from '../src/physics/geographyPcg';

/** Independently assemble a small dense matrix, without production edges/matvec. */
function denseMatrix(nlat: number, nlon: number, fractions: Float64Array): number[][] {
  const n = nlat * nlon, matrix = Array.from({ length: n }, () => Array(n).fill(0));
  const dphi = Math.PI / nlat, dlambda = 2 * Math.PI / nlon;
  for (let row = 0; row < nlat; row += 1) {
    const south = -Math.PI / 2 + row * dphi, north = south + dphi, phi = (south + north) / 2;
    const w = Math.sin(north) - Math.sin(south);
    for (let col = 0; col < nlon; col += 1) {
      const k = row * nlon + col, f = fractions[k];
      matrix[k][k] += w * (4e6 * (2.5 * f + 50 * (1 - f)) / 43200 + 2);
      const neighbours = [[row * nlon + (col + 1) % nlon, 0.55 * dphi / (Math.cos(phi) * dlambda ** 2)]];
      if (row < nlat - 1) neighbours.push([k + nlon, 0.55 * Math.cos(north) / dphi]);
      for (const [j, g] of neighbours) {
        matrix[k][k] += g; matrix[j][j] += g; matrix[k][j] -= g; matrix[j][k] -= g;
      }
    }
  }
  return matrix;
}

/** Pivoted Gaussian elimination, not CG and not production matvec. */
function direct(matrix: number[][], rhs: Float64Array): number[] {
  const n = rhs.length, a = matrix.map((row, k) => [...row, rhs[k]]);
  for (let p = 0; p < n; p += 1) {
    let pivot = p;
    for (let k = p + 1; k < n; k += 1) if (Math.abs(a[k][p]) > Math.abs(a[pivot][p])) pivot = k;
    [a[p], a[pivot]] = [a[pivot], a[p]];
    for (let k = p + 1; k < n; k += 1) {
      const scale = a[k][p] / a[p][p];
      for (let j = p; j <= n; j += 1) a[k][j] -= scale * a[p][j];
    }
  }
  const x = Array(n).fill(0);
  for (let k = n - 1; k >= 0; k -= 1) {
    let value = a[k][n];
    for (let j = k + 1; j < n; j += 1) value -= a[k][j] * x[j];
    x[k] = value / a[k][k];
  }
  return x;
}

describe('isolated geography SPD system / Jacobi-PCG', () => {
  it('matches independent dense assembly and direct solve with variable capacity', () => {
    const grid = buildGeographyGrid(6, 12), f = Float64Array.from({ length: grid.size }, (_, k) => (1 + Math.sin(0.17 * k)) / 2);
    const rhs = Float64Array.from(f, (_, k) => 100 * Math.sin(0.17 * k));
    const system = buildGeographySystem(grid, f), matrix = denseMatrix(6, 12, f);
    const reference = direct(matrix, rhs), result = solveGeographyPcg(system, rhs);
    expect(Math.max(...reference.map((v, k) => Math.abs(v - result.solution[k])))).toBeLessThan(1e-9);
    const input = Float64Array.from(f, (_, k) => Math.cos(0.13 * k)), output = new Float64Array(grid.size);
    system.apply(input, output);
    for (let k = 0; k < grid.size; k += 1) {
      expect(output[k]).toBeCloseTo(matrix[k].reduce((sum, a, j) => sum + a * input[j], 0), 10);
      expect(system.diagonal[k]).toBeCloseTo(matrix[k][k], 10);
    }
  });

  it('checks actual residual on the default 648-cell smooth fractional world', () => {
    const grid = buildGeographyGrid(), f = Float64Array.from({ length: grid.size }, (_, k) => (1 + Math.sin(0.17 * k)) / 2);
    const system = buildGeographySystem(grid, f), rhs = Float64Array.from(f, (_, k) => 100 * Math.sin(0.17 * k));
    const result = solveGeographyPcg(system, rhs), ax = new Float64Array(grid.size);
    system.apply(result.solution, ax);
    const actual = Math.sqrt(Array.from(rhs).reduce((sum, v, k) => sum + (v - ax[k]) ** 2, 0));
    expect(result.residualNorm).toBe(actual);
    expect(result.relativeResidual).toBeLessThan(1.1e-11);
    expect(result.iterations).toBeGreaterThan(0);
    expect(result.iterations).toBeLessThan(648);
    const exact = solveGeographyPcg(system, rhs, result.solution);
    expect(exact.iterations).toBe(0);
    expect(exact.solution).not.toBe(result.solution);
  });

  it('handles zero forcing and diagonal-only systems without clipping', () => {
    const grid = buildGeographyGrid(2, 4, 0), system = buildGeographySystem(grid, new Float64Array(8));
    expect(solveGeographyPcg(system, new Float64Array(8)).iterations).toBe(0);
    const rhs = Float64Array.from({ length: 8 }, (_, k) => 100 * (k - 4));
    const result = solveGeographyPcg(system, rhs);
    expect(result.iterations).toBe(1);
    result.solution.forEach((v, k) => expect(v).toBeCloseTo(rhs[k] / system.diagonal[k], 12));
    expect(result.solution[0]).toBeLessThan(0);
  });

  it('snapshots fractions and matrix coefficients, and validates capacity/step inputs', () => {
    const grid = buildGeographyGrid(), f = new Float64Array(648).fill(0.5);
    const system = buildGeographySystem(grid, f), input = new Float64Array(648).fill(3), before = new Float64Array(648);
    system.apply(input, before);
    f.fill(1); grid.weight.fill(0); grid.eastWest.fill(0); grid.northSouth.fill(0);
    const after = new Float64Array(648); system.apply(input, after);
    expect(after).toEqual(before);
    expect(system.capacity[0]).toBe(4e6 * 26.25);
    expect(() => buildGeographySystem(buildGeographyGrid(), new Float64Array(648).fill(NaN))).toThrow(RangeError);
    expect(() => buildGeographySystem(buildGeographyGrid(), new Float64Array(648).fill(1.01))).toThrow(RangeError);
    expect(() => buildGeographySystem(buildGeographyGrid(), f, 0)).toThrow(RangeError);
    expect(() => system.apply(input, input)).toThrow(RangeError);
  });

  it('reports nonconvergence and invalid numerical states as errors, never fallback values', () => {
    const grid = buildGeographyGrid(), system = buildGeographySystem(grid, new Float64Array(648));
    const rhs = Float64Array.from({ length: 648 }, (_, k) => Math.sin(0.17 * k));
    expect(() => solveGeographyPcg(system, rhs, undefined, { maxIterations: 1 })).toThrow(/did not converge/);
    expect(() => solveGeographyPcg(system, rhs, undefined, { relativeTolerance: NaN })).toThrow(RangeError);
    expect(() => solveGeographyPcg(system, rhs, undefined, { maxIterations: Infinity })).toThrow(RangeError);
    expect(() => solveGeographyPcg(system, new Float64Array(648).fill(Infinity))).toThrow(RangeError);
    expect(() => solveGeographyPcg(system, rhs, new Float64Array(648).fill(NaN))).toThrow(RangeError);
    const bad: PositiveSystem = { size: 2, diagonal: new Float64Array([1, 1]),
      apply: (a, b) => { b[0] = -a[0]; b[1] = -a[1]; } };
    expect(() => solveGeographyPcg(bad, new Float64Array([1, 1]))).toThrow(/p dot A\*p/);
    bad.diagonal[0] = 0;
    expect(() => solveGeographyPcg(bad, new Float64Array([1, 1]))).toThrow(/Jacobi diagonal/);
    const nonfinite: PositiveSystem = { size: 1, diagonal: new Float64Array([1]), apply: (_a, b) => { b[0] = NaN; } };
    expect(() => solveGeographyPcg(nonfinite, new Float64Array([1]))).toThrow(/nonfinite/);
  });
});
