import type { GeographyClimateSolution } from './geographyClimate';
import type { GeographyGrid } from './geographyGrid';

export interface GeographyCell {
  index: number;
  row: number;
  column: number;
  latitude: number;
  longitude: number;
  polarCap: boolean;
}

/** Angular containing cell, not interpolated city climate. At the poles the
 * selected longitude identifies a cap sector; longitude is not unique there.
 */
export function geographyCell(grid: GeographyGrid, latitude: number, longitude: number): GeographyCell {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude)) {
    throw new RangeError('Geography coordinates must be finite, latitude in [-90, 90].');
  }
  const wrapped = ((longitude + 180) % 360 + 360) % 360;
  const row = Math.min(grid.nlat - 1, Math.floor((latitude + 90) / (180 / grid.nlat)));
  const column = Math.min(grid.nlon - 1, Math.floor(wrapped / (360 / grid.nlon)));
  return { index: row * grid.nlon + column, row, column,
    latitude: grid.phi[row] * 180 / Math.PI, longitude: grid.lambda[column] * 180 / Math.PI,
    polarCap: row === 0 || row === grid.nlat - 1 };
}

function phase(day: number): { first: number; second: number; mix: number } {
  if (!Number.isFinite(day)) throw new RangeError('Geography day must be finite.');
  const wrapped = ((day - 1) % 365 + 365) % 365;
  const first = Math.floor(wrapped);
  return { first, second: (first + 1) % 365, mix: wrapped - first };
}

/** Spatially cell-constant, temporally linear between daily periodic samples.
 * A single index is shared by the globe, location, annual series and Atlas.
 */
export function sampleGeographyCell(solution: GeographyClimateSolution, index: number, day: number): number {
  const size = solution.grid.size;
  if (!Number.isInteger(index) || index < 0 || index >= size || solution.temperatures.length !== 365 * size) {
    throw new RangeError('Geography field/index mismatch.');
  }
  const { first, second, mix } = phase(day);
  const a = solution.temperatures[first * size + index], b = solution.temperatures[second * size + index];
  if (!Number.isFinite(a) || !Number.isFinite(b)) throw new RangeError('Geography temperature must be finite.');
  return mix === 0 ? a : a + mix * (b - a);
}

export function sampleGeographyTemperature(
  solution: GeographyClimateSolution, latitude: number, longitude: number, day: number,
): number {
  return sampleGeographyCell(solution, geographyCell(solution.grid, latitude, longitude).index, day);
}

export function geographyMaterial(solution: GeographyClimateSolution, cell: GeographyCell): {
  landFraction: number; effectiveDepth: number;
} {
  if (!Number.isInteger(cell.index) || cell.index < 0 || cell.index >= solution.grid.size ||
      solution.landFraction.length !== solution.grid.size) throw new RangeError('Geography material/index mismatch.');
  const landFraction = solution.landFraction[cell.index];
  if (!Number.isFinite(landFraction) || landFraction < 0 || landFraction > 1) throw new RangeError('Invalid land fraction.');
  return { landFraction, effectiveDepth: 2.5 * landFraction + 50 * (1 - landFraction) };
}

export function geographyAnnualTemperatures(solution: GeographyClimateSolution, latitude: number, longitude: number): Float64Array {
  const cell = geographyCell(solution.grid, latitude, longitude);
  return Float64Array.from({ length: 365 }, (_, day) => sampleGeographyCell(solution, cell.index, day + 1));
}

/** Row-major latitude×day slice, selected longitude (not a latitude average). */
export function geographyLongitudeSlice(solution: GeographyClimateSolution, longitude: number): Float64Array {
  const column = geographyCell(solution.grid, 0, longitude).column;
  return Float64Array.from({ length: solution.grid.nlat * 365 }, (_, k) =>
    sampleGeographyCell(solution, Math.floor(k / 365) * solution.grid.nlon + column, k % 365 + 1));
}
