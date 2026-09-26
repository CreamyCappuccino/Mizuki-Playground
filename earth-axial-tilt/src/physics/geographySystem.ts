import { EBM } from './energyBalance';
import { visitGeographyEdges, type GeographyGrid } from './geographyGrid';

export interface PositiveSystem {
  size: number;
  diagonal: Float64Array;
  apply(input: Float64Array, output: Float64Array): void;
}
export interface GeographySystem extends PositiveSystem {
  /** Per-cell C, J/m²/K; and weighted C/dt used to assemble each step RHS. */
  capacity: Float64Array;
  storage: Float64Array;
  secondsPerStep: number;
}

/** Time-independent SPD backward-Euler matrix: w*C/dt + w*B - w*L_D.
 * Snapshots source fractions and face coefficients, so later input mutations
 * cannot change an already-built matrix. Classic's discretization is untouched.
 */
export function buildGeographySystem(
  grid: GeographyGrid, landFraction: ArrayLike<number>, stepsPerDay = 2,
): GeographySystem {
  if (!Number.isInteger(stepsPerDay) || stepsPerDay < 1 || stepsPerDay > 8) {
    throw new RangeError('Steps per day must be an integer in [1, 8].');
  }
  if (!Number.isInteger(grid.nlat) || grid.nlat < 2 || grid.nlat > 180 ||
      !Number.isInteger(grid.nlon) || grid.nlon < 4 || grid.nlon > 360 ||
      grid.size !== grid.nlat * grid.nlon || grid.weight.length !== grid.nlat ||
      grid.northSouth.length !== grid.nlat - 1 || grid.eastWest.length !== grid.nlat ||
      landFraction.length !== grid.size) throw new RangeError('Grid/fraction size mismatch.');
  const secondsPerStep = EBM.secondsPerDay / stepsPerDay;
  const capacity = new Float64Array(grid.size), storage = new Float64Array(grid.size);
  const base = new Float64Array(grid.size);
  for (let k = 0; k < grid.size; k += 1) {
    const f = landFraction[k], w = grid.weight[Math.floor(k / grid.nlon)];
    if (!Number.isFinite(f) || f < 0 || f > 1) throw new RangeError('Land fractions must be finite in [0, 1].');
    if (!Number.isFinite(w) || w <= 0) throw new RangeError('Area weights must be finite and positive.');
    capacity[k] = EBM.waterHeatCapacity * (2.5 * f + 50 * (1 - f));
    storage[k] = w * capacity[k] / secondsPerStep;
    base[k] = storage[k] + w * EBM.B;
  }
  const diagonal = base.slice(), a: number[] = [], b: number[] = [], g: number[] = [];
  visitGeographyEdges(grid, (first, second, conductance) => {
    if (!Number.isFinite(conductance) || conductance < 0) throw new RangeError('Invalid face conductance.');
    a.push(first); b.push(second); g.push(conductance);
    diagonal[first] += conductance; diagonal[second] += conductance;
  });
  const first = Uint32Array.from(a), second = Uint32Array.from(b), conductance = Float64Array.from(g);
  return { size: grid.size, diagonal, capacity, storage, secondsPerStep,
    apply(input, output) {
      if (input.length !== base.length || output.length !== base.length || input.buffer === output.buffer) {
        throw new RangeError('Matrix vector size/alias mismatch.');
      }
      for (let k = 0; k < base.length; k += 1) {
        if (!Number.isFinite(input[k])) throw new RangeError('Matrix input must be finite.');
        output[k] = base[k] * input[k];
      }
      for (let edge = 0; edge < conductance.length; edge += 1) {
        const i = first[edge], j = second[edge], flux = conductance[edge] * (input[i] - input[j]);
        output[i] += flux; output[j] -= flux;
      }
    } };
}
