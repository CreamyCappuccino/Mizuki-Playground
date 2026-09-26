import { EBM } from './energyBalance';

/** Separate from Classic's x-area-centre grid. Row-major south/west first. */
export interface GeographyGrid {
  nlat: number;
  nlon: number;
  size: number;
  diffusion: number;
  dphi: number;
  dlambda: number;
  /** Angular latitude/longitude midpoints, in radians. */
  phi: Float64Array;
  lambda: Float64Array;
  /** Latitude-only area weights: sin(north edge) - sin(south edge). */
  weight: Float64Array;
  /** Shared weighted-row face conductances; NS has nlat-1 entries. */
  northSouth: Float64Array;
  eastWest: Float64Array;
}

function integerRange(value: number, min: number, max: number, name: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new RangeError(`${name} must be an integer in [${min}, ${max}].`);
  }
}

/** 10° / 648-cell default is a science condition, not a visual quality setting. */
export function buildGeographyGrid(nlat = 18, nlon = 36, diffusion: number = EBM.D): GeographyGrid {
  integerRange(nlat, 2, 180, 'Latitude count');
  integerRange(nlon, 4, 360, 'Longitude count');
  if (!Number.isFinite(diffusion) || diffusion < 0 || diffusion > 2) {
    throw new RangeError('Diffusion must be finite and in [0, 2].');
  }
  const dphi = Math.PI / nlat, dlambda = 2 * Math.PI / nlon;
  const phi = new Float64Array(nlat), lambda = new Float64Array(nlon);
  const weight = new Float64Array(nlat), northSouth = new Float64Array(nlat - 1);
  const eastWest = new Float64Array(nlat);
  for (let row = 0; row < nlat; row += 1) {
    const south = -Math.PI / 2 + row * dphi, north = south + dphi;
    phi[row] = (south + north) / 2;
    weight[row] = Math.sin(north) - Math.sin(south);
    eastWest[row] = diffusion * dphi / (Math.cos(phi[row]) * dlambda ** 2);
    if (row < nlat - 1) northSouth[row] = diffusion * Math.cos(north) / dphi;
  }
  for (let column = 0; column < nlon; column += 1) {
    lambda[column] = -Math.PI + (column + 0.5) * dlambda;
  }
  return { nlat, nlon, size: nlat * nlon, diffusion, dphi, dlambda,
    phi, lambda, weight, northSouth, eastWest };
}

/** Every internal face exactly once, including longitude seam; no polar face. */
export function visitGeographyEdges(
  grid: GeographyGrid,
  visit: (a: number, b: number, conductance: number) => void,
): void {
  for (let row = 0; row < grid.nlat; row += 1) {
    for (let column = 0; column < grid.nlon; column += 1) {
      const a = row * grid.nlon + column;
      visit(a, row * grid.nlon + (column + 1) % grid.nlon, grid.eastWest[row]);
      if (row + 1 < grid.nlat) visit(a, a + grid.nlon, grid.northSouth[row]);
    }
  }
}

/** w*L_D(T). Shared fluxes conserve area-weighted energy for arbitrary fields. */
export function weightedGeographyTransport(
  temperature: ArrayLike<number>, grid: GeographyGrid,
): Float64Array {
  if (temperature.length !== grid.size) throw new RangeError('Temperature/grid size mismatch.');
  for (let k = 0; k < grid.size; k += 1) {
    if (!Number.isFinite(temperature[k])) throw new RangeError('Temperature must be finite.');
  }
  const output = new Float64Array(grid.size);
  visitGeographyEdges(grid, (a, b, conductance) => {
    const flux = conductance * (temperature[b] - temperature[a]);
    output[a] += flux;
    output[b] -= flux;
  });
  return output;
}

/** Physical transport L_D(T), W/m². Diffusion D is included, not divided out. */
export function geographyTransport(temperature: ArrayLike<number>, grid: GeographyGrid): Float64Array {
  const output = weightedGeographyTransport(temperature, grid);
  for (let row = 0; row < grid.nlat; row += 1) {
    for (let column = 0; column < grid.nlon; column += 1) {
      output[row * grid.nlon + column] /= grid.weight[row];
    }
  }
  return output;
}
