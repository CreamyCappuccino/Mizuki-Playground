import {GEOGRAPHY_MASK_ID,GEOGRAPHY_SOLVER_ID,normalizeGeographyConfiguration,type GeographyConfiguration} from '../physics/geographyContract';
export interface GeographyExperiment extends GeographyConfiguration {
  day:number;latitude:number;longitude:number;layer:'temperature'|'difference'|'land';
}
export const DEFAULT_GEOGRAPHY_EXPERIMENT:GeographyExperiment={tilt:23.44,orbit:{eccentricity:0,perihelion:0,axis:0},
  reference:true,day:172,latitude:25.033,longitude:121.5654,layer:'temperature'};
const object=(x:unknown):x is Record<string,unknown>=>typeof x==='object'&&x!==null&&!Array.isArray(x);
/** This separate experimental page does NOT reinterpret or upgrade Earth schema 3. */
export function decodeGeographyExperiment(text:string):GeographyExperiment {
  if(text.length>4096)throw new Error('Geography settings too large.');
  const v:unknown=JSON.parse(text);
  if(!object(v)||v.application!=='earth-geography-lab'||v.version!==1||v.mask!==GEOGRAPHY_MASK_ID||v.solver!==GEOGRAPHY_SOLVER_ID||!object(v.state))
    throw new Error('Unsupported geography settings or dataset.');
  const s=v.state,o=s.orbit;
  if(!object(o)||typeof s.reference!=='boolean'||typeof s.tilt!=='number'||
    typeof o.eccentricity!=='number'||typeof o.perihelion!=='number'||typeof o.axis!=='number')throw new Error('Invalid geography parameters.');
  if(![o.perihelion,o.axis].every(x=>Number.isFinite(x)&&x>=0&&x<=360))throw new Error('Orbit angle out of range.');
  const c=normalizeGeographyConfiguration({tilt:s.tilt,reference:s.reference,orbit:{eccentricity:o.eccentricity,perihelion:o.perihelion,axis:o.axis}});
  if(typeof s.day!=='number'||!Number.isFinite(s.day)||s.day<1||s.day>=366||
    typeof s.latitude!=='number'||!Number.isFinite(s.latitude)||s.latitude<-90||s.latitude>90||
    typeof s.longitude!=='number'||!Number.isFinite(s.longitude)||s.longitude<-180||s.longitude>180||
    !['temperature','difference','land'].includes(s.layer as string)||(s.layer==='difference'&&!s.reference))throw new Error('Invalid geography view.');
  return {...c,day:s.day,latitude:s.latitude,longitude:s.longitude,layer:s.layer as GeographyExperiment['layer']};
}
export function encodeGeographyExperiment(s:GeographyExperiment):string {
  const text=JSON.stringify({application:'earth-geography-lab',version:1,mask:GEOGRAPHY_MASK_ID,solver:GEOGRAPHY_SOLVER_ID,state:s});
  decodeGeographyExperiment(text);return text;
}
export function geographyExperimentHash(s:GeographyExperiment):string{return '#geo='+encodeURIComponent(encodeGeographyExperiment(s));}
export function geographyExperimentFromHash(hash:string):GeographyExperiment|null {
  if(!hash.startsWith('#geo='))return null;
  if(hash.length>12293)throw new Error('Geography settings too large.');
  return decodeGeographyExperiment(decodeURIComponent(hash.slice(5)));
}
