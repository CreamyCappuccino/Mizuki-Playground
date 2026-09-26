import { normalizeOrbit, type OrbitParameters } from './orbit';
import type { GeographyClimateSolution } from './geographyClimate';

export const GEOGRAPHY_MASK_ID='natural-earth-110m-4.1.0-q64-18x36-v1';
export const GEOGRAPHY_PAYLOAD_SHA='09462b795716c3a3ce747bcf0835b089b38be8028d09b75cc1cdd196b2567084';
export const OCEAN_REFERENCE_ID='uniform-ocean-18x36-v1';
export const GEOGRAPHY_SOLVER_ID='geography-backward-euler-pcg-v1';
export interface GeographyConfiguration {tilt:number; orbit:OrbitParameters; reference:boolean;}
export interface GeographyPair {key:string; current:GeographyClimateSolution; reference:GeographyClimateSolution|null;}
export interface GeographyRequest {id:number; key:string; configuration:GeographyConfiguration;}
export type GeographyReply = {id:number;key:string;kind:'ready';pair:GeographyPair}
  | {id:number;key:string;kind:'error';message:string}
  | {id:number;key:string;kind:'progress';phase:'data'|'earth'|'ocean'};

export function normalizeGeographyConfiguration(value: GeographyConfiguration): GeographyConfiguration {
  if(!value || !Number.isFinite(value.tilt) || value.tilt<0 || value.tilt>90 || typeof value.reference!=='boolean')
    throw new RangeError('Invalid geography configuration.');
  if(!value.orbit) throw new RangeError('Geography orbit is required.');
  return {tilt:value.tilt,orbit:normalizeOrbit(value.orbit),reference:value.reference};
}
export function geographyKey(value: GeographyConfiguration): string {
  const c=normalizeGeographyConfiguration(value),o=c.orbit;
  return [GEOGRAPHY_MASK_ID,GEOGRAPHY_PAYLOAD_SHA,GEOGRAPHY_SOLVER_ID,'half-day',c.tilt,
    o.eccentricity,o.perihelion,o.axis,c.reference?'ocean-reference':'no-reference'].join('|');
}

/** Results cross an asynchronous ownership boundary; reject wrong condition,
 * grid, mask, solver or corrupted fields before releasing data to a view. */
export function assertGeographyPair(pair: GeographyPair, config: GeographyConfiguration): void {
  const key=geographyKey(config);
  if(!pair || pair.key!==key || (config.reference ? !pair.reference : pair.reference!==null))
    throw new Error('Mismatched geography result.');
  for(const [s,id] of [[pair.current,GEOGRAPHY_MASK_ID],[pair.reference,OCEAN_REFERENCE_ID]] as const) {
    if(s===null)continue;
    const orbit=s?.orbit;
    if(!s || s.tilt!==config.tilt || !orbit || orbit.eccentricity!==config.orbit.eccentricity ||
      orbit.perihelion!==config.orbit.perihelion || orbit.axis!==config.orbit.axis ||
      s.stepsPerDay!==2 || s.provenance?.id!==id || s.provenance?.solver!==GEOGRAPHY_SOLVER_ID ||
      s.provenance?.grid!=='phi-midpoint-18x36-v1' || s.grid?.nlat!==18 || s.grid?.nlon!==36 || s.grid?.size!==648 ||
      !(s.temperatures instanceof Float64Array) || s.temperatures.length!==365*648 ||
      !(s.landFraction instanceof Float64Array) || s.landFraction.length!==648 ||
      !Number.isFinite(s.periodicError) || s.periodicError>=1e-6 || s.periodicError<0 ||
      !Number.isFinite(s.energyResidual) || !Number.isFinite(s.maxStepEnergyResidual) || s.maxStepEnergyResidual>1e-5)
      throw new Error('Geography provenance or numerical diagnostics mismatch.');
    if(id===GEOGRAPHY_MASK_ID && s.provenance.payloadSha256!==GEOGRAPHY_PAYLOAD_SHA)
      throw new Error('Geography mask identity mismatch.');
    for(const t of s.temperatures)if(!Number.isFinite(t))throw new Error('Nonfinite geography temperature.');
    for(const f of s.landFraction)if(!Number.isFinite(f)||f<0||f>1||(id===OCEAN_REFERENCE_ID&&f!==0))
      throw new Error('Invalid geography land fractions.');
  }
}

/** Count/transfer each owned ArrayBuffer once, including grid metadata. */
export function geographyBuffers(pair: GeographyPair): ArrayBuffer[] {
  const buffers=new Set<ArrayBuffer>();
  for(const s of [pair.current,pair.reference])if(s) {
    for(const a of [s.temperatures,s.landFraction,s.grid.phi,s.grid.lambda,s.grid.weight,s.grid.northSouth,s.grid.eastWest])
      buffers.add(a.buffer as ArrayBuffer);
  }
  return [...buffers];
}
export function geographyBytes(pair: GeographyPair): number {
  return geographyBuffers(pair).reduce((total,b)=>total+b.byteLength,0);
}
