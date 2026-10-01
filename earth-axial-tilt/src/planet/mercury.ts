import { solveKepler } from '../physics/orbit';
import { MERCURY_PLANET } from './definitions';
import { wrapDegrees } from './astronomy';
import { bounded, illumination } from './geometry';

const D=Math.PI/180,TAU=2*Math.PI;
export interface MercurySettings { version:1; cycles:number; latitude:number; longitude:number; eccentricity:number }
export const DEFAULT_MERCURY: Readonly<MercurySettings> = Object.freeze({
  version:1,cycles:0,latitude:0,longitude:0,eccentricity:MERCURY_PLANET.orbit.eccentricity,
});
export function validateMercury(value:unknown):MercurySettings {
  if(!value||typeof value!=='object'||Array.isArray(value))throw new RangeError('Invalid Mercury settings.');
  const x=value as Record<string,unknown>,keys=['version','cycles','latitude','longitude','eccentricity'];
  if(Object.keys(x).length!==keys.length||Object.keys(x).some(k=>!keys.includes(k))||x.version!==1)throw new RangeError('Invalid settings keys.');
  const n=(k:string,lo:number,hi:number)=>{if(typeof x[k]!=='number')throw new RangeError('Invalid number');return bounded(x[k] as number,lo,hi);};
  return {version:1,cycles:n('cycles',0,2),latitude:n('latitude',-90,90),longitude:n('longitude',-180,180),eccentricity:n('eccentricity',0,.3)};
}
/** Uniform spin and Kepler orbit, both evaluated at the SAME elapsed time.
 * Meridian 0 is at apparent noon at the first perihelion. It is not IAU longitude. */
export function mercuryMoment(settings:MercurySettings) {
  const s=validateMercury(settings),e=s.eccentricity,p={...MERCURY_PLANET,orbit:{...MERCURY_PLANET.orbit,eccentricity:e}};
  const M=TAU*s.cycles,E=solveKepler(M,e);
  const nuWrapped=Math.atan2(Math.sqrt(1-e*e)*Math.sin(E),Math.cos(E)-e);
  // Choose the continuous true anomaly branch nearest the mean anomaly.
  const nu=nuWrapped+TAU*Math.round((M-nuWrapped)/TAU);
  const ls=nu/D+p.orbit.perihelionSeasonDeg, eps=p.rotation.obliquityDeg*D;
  const alphaAt=(angle:number)=>{
    const r=angle*D,a=Math.atan2(Math.cos(eps)*Math.sin(r),Math.cos(r))/D;
    return a+360*Math.round((angle-a)/360);
  };
  const alpha=alphaAt(ls),alpha0=alphaAt(p.orbit.perihelionSeasonDeg),spin=alpha0+540*s.cycles;
  const period=p.orbit.yearEarthDays,meanRate=360/period;
  const orbitRate=meanRate*(1+e*Math.cos(nu))**2/(1-e*e)**1.5;
  const sunEquatorialRate=orbitRate*Math.cos(eps)/(1-(Math.sin(eps)*Math.sin(ls*D))**2);
  const spinRate=1.5*meanRate,apparentRate=sunEquatorialRate-spinRate;
  const read=illumination(p,ls,s.latitude,s.longitude,spin);
  const r=p.orbit.semiMajorAxisAU*(1-e*e)/(1+e*Math.cos(nu));
  return { planet:p,cycles:s.cycles,earthDays:s.cycles*period,spinTurns:1.5*s.cycles,
    seasonalLongitude:wrapDegrees(ls),trueAnomaly:nu/D,spinDegrees:spin,
    sunBodyLongitude:alpha-spin,apparentRateDegPerDay:apparentRate,
    reversing:apparentRate>1e-10,distanceAU:r,fluxWm2:1361/(r*r),
    elevationDeg:read.elevation,instantWm2:read.instantWm2,
    hourAngleDeg:((spin+s.longitude-alpha+180)%360+360)%360-180,
  };
}
export function mercurySeries(s:MercurySettings) {
  validateMercury(s);
  return Array.from({length:721},(_,i)=>mercuryMoment({...s,cycles:i/360}));
}
export function mercuryHash(s:MercurySettings):string {
  const x=validateMercury(s);return '#'+new URLSearchParams({mercury:'1',state:JSON.stringify(x)});
}
export function parseMercuryHash(hash:string):MercurySettings|null {
  if(!hash)return null;
  if(hash.length>2048||/%(?![a-f0-9]{2})/i.test(hash))throw new RangeError('Invalid link.');
  const p=new URLSearchParams(hash.replace(/^#/,''));
  if(p.get('mercury')!=='1'||p.getAll('mercury').length!==1||p.getAll('state').length!==1||Array.from(p.keys()).some(k=>k!=='mercury'&&k!=='state'))throw new RangeError('Invalid link keys.');
  return validateMercury(JSON.parse(p.get('state')!));
}
export function mercuryURL(base:string,s:MercurySettings):string {
  const url=new URL(base);url.username='';url.password='';url.search='';url.hash=mercuryHash(s);return url.toString();
}
export function mercuryCSV(settings:MercurySettings):string {
  const s=validateMercury(settings);
  const lines=['cycles,earth_days,spin_turns,model_latitude_deg,model_longitude_deg,eccentricity,sun_body_longitude_unwrapped_deg,apparent_sun_rate_deg_per_earth_day,sun_elevation_deg,instant_horizontal_toa_wm2,distance_au'];
  for(const x of mercurySeries(s))lines.push([x.cycles,x.earthDays,x.spinTurns,s.latitude,s.longitude,s.eccentricity,x.sunBodyLongitude,x.apparentRateDegPerDay,x.elevationDeg,x.instantWm2,x.distanceAU].join(','));
  return lines.join('\n')+'\n';
}
