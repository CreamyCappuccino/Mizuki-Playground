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
  const diagonal = base.slice();
  visitGeographyEdges(grid, (_first, _second, conductance) => {
    if (!Number.isFinite(conductance) || conductance < 0) throw new RangeError('Invalid face conductance.');
  });
  const ns = grid.northSouth.slice(), ew = grid.eastWest.slice(), rows = grid.nlat, columns = grid.nlon;
  for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
    const k = row * columns + col;
    diagonal[k] += (row ? ns[row - 1] : 0) + (row + 1 < rows ? ns[row] : 0) + 2 * ew[row];
  }
  return { size: grid.size, diagonal, capacity, storage, secondsPerStep,
    apply(input, output) {
      if (input.length !== base.length || output.length !== base.length || input.buffer === output.buffer) {
        throw new RangeError('Matrix vector size/alias mismatch.');
      }
      for (let k = 0; k < base.length; k += 1) {
        if (!Number.isFinite(input[k])) throw new RangeError('Matrix input must be finite.');
      }
      // Identical directional accumulation at every longitude preserves
      // zonal symmetry exactly, without projecting or replacing solutions.
      for (let row = 0; row < rows; row += 1) for (let col = 0; col < columns; col += 1) {
        const k = row * columns + col, value = input[k];
        let applied = base[k] * value;
        if (row > 0) applied += ns[row - 1] * (value - input[k - columns]);
        if (row + 1 < rows) applied += ns[row] * (value - input[k + columns]);
        const west = row * columns + (col + columns - 1) % columns;
        const east = row * columns + (col + 1) % columns;
        applied += ew[row] * ((value - input[west]) + (value - input[east]));
        output[k] = applied;
      }
    } };
}
