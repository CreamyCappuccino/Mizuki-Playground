/** Earth-only, equinox-anchored Kepler experiment. Fixed a=1 au, year=365 model days. */
export interface OrbitParameters {
  eccentricity: number;
  /** Inertial longitude of the apparent Sun at perihelion (degrees). */
  perihelion: number;
  /** Static azimuth of the tilted axis, NOT a time-dependent precession simulation. */
  axis: number;
}
export const CLASSIC_ORBIT: Readonly<OrbitParameters> = Object.freeze({eccentricity:0,perihelion:0,axis:0});
export const MAX_ECCENTRICITY = 0.3;
const TAU=2*Math.PI, DEG=Math.PI/180;
export function wrapDegrees(angle:number):number {
  if(!Number.isFinite(angle))throw new RangeError('Orbital angle must be finite.');
  return ((angle%360)+360)%360;
}
export function normalizeOrbit(orbit:OrbitParameters=CLASSIC_ORBIT):OrbitParameters {
  if(!Number.isFinite(orbit.eccentricity)||orbit.eccentricity<0||orbit.eccentricity>MAX_ECCENTRICITY)
    throw new RangeError('Eccentricity must be between 0 and 0.3.');
  return {eccentricity:orbit.eccentricity,perihelion:wrapDegrees(orbit.perihelion),axis:wrapDegrees(orbit.axis)};
}
export function orbitKey(orbit:OrbitParameters=CLASSIC_ORBIT):string {
  const o=normalizeOrbit(orbit);
  // A circle has no physically distinct perihelion. Keep its UI setting, not a false cache distinction.
  return `${o.eccentricity}:${o.eccentricity===0?0:o.perihelion}:${o.axis}`;
}
export function isClassicOrbit(orbit:OrbitParameters=CLASSIC_ORBIT):boolean {return orbitKey(orbit)==='0:0:0';}

/** Unique elliptical solution on [-pi,pi]. Newton is bounded and bracketed, never open-ended. */
export function solveKepler(meanAnomaly:number,eccentricity:number):number {
  if(!Number.isFinite(meanAnomaly)||!Number.isFinite(eccentricity)||eccentricity<0||eccentricity>=1)
    throw new RangeError('Kepler inputs must be finite, with 0 <= e < 1.');
  const m=((meanAnomaly+Math.PI)%TAU+TAU)%TAU-Math.PI;
  if(eccentricity===0)return m;
  let lo=-Math.PI,hi=Math.PI,e=m;
  for(let iteration=0;iteration<64;iteration++){
    const residual=e-eccentricity*Math.sin(e)-m;
    if(Math.abs(residual)<2e-14)return e;
    if(residual>0)hi=e;else lo=e;
    const proposed=e-residual/(1-eccentricity*Math.cos(e));
    e=proposed>lo&&proposed<hi?proposed:(lo+hi)/2;
  }
  throw new Error('Kepler equation did not converge.');
}
function meanAtTrueAnomaly(anomaly:number,e:number):number {
  const E=Math.atan2(Math.sqrt(1-e*e)*Math.sin(anomaly),e+Math.cos(anomaly));
  return E-e*Math.sin(E);
}
export interface OrbitalMoment {
  solarLongitude: number;
  seasonalLongitude: number;
  distanceAU: number;
  irradianceFactor: number;
  /** v / speed of the same-a circular orbit. */
  speedRatio: number;
  /** d(true anomaly)/dt divided by mean motion. */
  angularRateRatio: number;
  eccentricAnomaly: number;
  meanAnomaly: number;
}
/** March-reference equinox stays at model day80 for each configuration, as in the classic lab. */
export function orbitalMoment(day:number,orbit:OrbitParameters=CLASSIC_ORBIT):OrbitalMoment {
  if(!Number.isFinite(day))throw new RangeError('Model day must be finite.');
  const o=normalizeOrbit(orbit),e=o.eccentricity,axis=o.axis*DEG,p=o.perihelion*DEG;
  const phase=(2*Math.PI*(day-80))/365;
  if(e===0)return {solarLongitude:phase+axis,seasonalLongitude:phase,distanceAU:1,irradianceFactor:1,
    speedRatio:1,angularRateRatio:1,eccentricAnomaly:phase,meanAnomaly:phase};
  const m0=meanAtTrueAnomaly(axis-p,e),meanAnomaly=m0+phase;
  const E=solveKepler(meanAnomaly,e),r=1-e*Math.cos(E);
  const nu=Math.atan2(Math.sqrt(1-e*e)*Math.sin(E),Math.cos(E)-e),lambda=nu+p;
  return {solarLongitude:lambda,seasonalLongitude:lambda-axis,distanceAU:r,irradianceFactor:1/(r*r),
    speedRatio:Math.sqrt(2/r-1),angularRateRatio:Math.sqrt(1-e*e)/(r*r),eccentricAnomaly:E,meanAnomaly};
}
/** Invert the calendar for a seasonal longitude: 0/90/180/270 = the four reference positions. */
export function dayAtSeasonalLongitude(degrees:number,orbit:OrbitParameters=CLASSIC_ORBIT):number {
  const o=normalizeOrbit(orbit),theta=wrapDegrees(degrees)*DEG;
  if(o.eccentricity===0)return ((80+365*theta/TAU-1)%365+365)%365+1;
  const relative=(o.axis-o.perihelion)*DEG;
  const delta=meanAtTrueAnomaly(relative+theta,o.eccentricity)-meanAtTrueAnomaly(relative,o.eccentricity);
  return ((80+365*delta/TAU-1)%365+365)%365+1;
}
export function perihelionDay(orbit:OrbitParameters=CLASSIC_ORBIT):number|null {
  const o=normalizeOrbit(orbit);return o.eccentricity===0?null:dayAtSeasonalLongitude(o.perihelion-o.axis,o);
}
export function maximumSolarFactor(orbit:OrbitParameters=CLASSIC_ORBIT):number {
  const e=normalizeOrbit(orbit).eccentricity;return 1/((1-e)*(1-e));
}
