import type { GeographyClimateSolution } from './geographyClimate';

export interface GeographyCell {
  row: number; column: number | null; index: number | null;
  latitude: number; longitude: number | null; polarMean: boolean;
}

/** Cells, not interpolated cities. ±180 are the same seam. At an exact pole
 * no meridian is privileged: report the entire adjacent polar-row mean. */
export function geographyCell(latitude: number, longitude: number, nlat = 18, nlon = 36): GeographyCell {
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude))
    throw new RangeError('Latitude must be in [-90,90] and longitude finite.');
  if (!Number.isInteger(nlat) || nlat < 2 || !Number.isInteger(nlon) || nlon < 4)
    throw new RangeError('Invalid geography grid.');
  const row = Math.min(nlat - 1, Math.floor((latitude + 90) * nlat / 180));
  const lat = -90 + (row + .5) * 180 / nlat;
  if (Math.abs(latitude) === 90) return {row, column:null, index:null, latitude:lat, longitude:null, polarMean:true};
  const lon = ((longitude + 180) % 360 + 360) % 360 - 180;
  const column = Math.min(nlon - 1, Math.floor((lon + 180) * nlon / 360));
  return {row, column, index:row*nlon+column, latitude:lat,
    longitude:-180+(column+.5)*360/nlon, polarMean:false};
}

function sampleRow(field: Float64Array, offset: number, cell: GeographyCell, nlon: number): number {
  if (cell.index !== null) return field[offset+cell.index];
  let total=0;
  for(let j=0;j<nlon;j++) total+=field[offset+cell.row*nlon+j];
  return total/nlon;
}

export function geographyReading(solution: GeographyClimateSolution, latitude: number, longitude: number, day: number) {
  if(!Number.isFinite(day)) throw new RangeError('Model day must be finite.');
  const {grid}=solution;
  if(solution.temperatures.length!==365*grid.size || solution.landFraction.length!==grid.size)
    throw new RangeError('Geography field size mismatch.');
  const cell=geographyCell(latitude,longitude,grid.nlat,grid.nlon);
  const phase=((day-1)%365+365)%365, a=Math.floor(phase), b=(a+1)%365, blend=phase-a;
  const first=sampleRow(solution.temperatures,a*grid.size,cell,grid.nlon);
  const second=sampleRow(solution.temperatures,b*grid.size,cell,grid.nlon);
  const landFraction=sampleRow(solution.landFraction,0,cell,grid.nlon);
  return {cell, temperature:first+(second-first)*blend, landFraction,
    effectiveDepth:2.5*landFraction+50*(1-landFraction)};
}

export function geographyAnnualProfile(solution: GeographyClimateSolution, latitude: number, longitude: number): Float64Array {
  return Float64Array.from({length:365},(_,d)=>geographyReading(solution,latitude,longitude,d+1).temperature);
}

/** North at top; each row is a native latitude-band centre, not a zonal mean. */
export function geographyLongitudeSection(solution: GeographyClimateSolution, longitude: number): Float64Array {
  const result=new Float64Array(solution.grid.nlat*365);
  for(let r=0;r<solution.grid.nlat;r++) {
    const latitude=90-(r+.5)*180/solution.grid.nlat;
    result.set(geographyAnnualProfile(solution,latitude,longitude),r*365);
  }
  return result;
}
