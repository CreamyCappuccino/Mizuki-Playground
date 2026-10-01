import { solveKepler } from '../physics/orbit';
import { sunsetHourAngleRad } from '../physics/solar';
import { planetaryMomentAtSeason, solarDeclinationDeg, wrapDegrees } from './astronomy';
import { getPlanetDefinition, type PlanetDefinition, type PlanetId } from './definitions';

const D = Math.PI / 180;
const TAU = 2 * Math.PI;
export type Vec3 = readonly [number, number, number];
export interface WorldChoice { id: PlanetId; tilt: number | null }
export const dot = (a: Vec3, b: Vec3): number => a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
export function bounded(x: number, lo: number, hi: number): number {
  if (!Number.isFinite(x) || x < lo || x > hi) throw new RangeError('Value outside model bounds.');
  return x;
}
export function worldDefinition(world: WorldChoice): Readonly<PlanetDefinition> {
  const p = getPlanetDefinition(world.id);
  if (!p) throw new RangeError('Unknown planet.');
  if (world.tilt === null) return p;
  bounded(world.tilt, 0, 180);
  return { ...p, rotation: { ...p.rotation, obliquityDeg: world.tilt,
    direction: world.tilt > 90 ? 'retrograde' : 'prograde' } };
}
/** +Z is the orbital normal. Spin is RIGHT-HANDED about this directed pole.
 * A tilt >90 degrees already represents retrograde: do not negate spin again. */
export function spinPole(tilt: number): Vec3 {
  bounded(tilt, 0, 180);
  return [0, Math.sin(tilt*D), Math.cos(tilt*D)];
}
export function sunDirection(ls: number): Vec3 {
  const a = wrapDegrees(ls)*D;
  return [Math.cos(a), Math.sin(a), 0];
}
export function surfaceNormal(tilt: number, latitude: number, longitude: number, spin: number): Vec3 {
  bounded(tilt, 0, 180); bounded(latitude, -90, 90);
  const p=latitude*D, l=wrapDegrees(longitude+spin)*D, e=tilt*D;
  return [Math.cos(p)*Math.cos(l),
    Math.cos(p)*Math.sin(l)*Math.cos(e)+Math.sin(p)*Math.sin(e),
    -Math.cos(p)*Math.sin(l)*Math.sin(e)+Math.sin(p)*Math.cos(e)];
}
/** Inverse of the season->time map, retaining each world's own spring origin. */
export function seasonAtElapsed(planet: Readonly<PlanetDefinition>, days: number): number {
  bounded(days, -1000000, 1000000);
  const o=planet.orbit, e=o.eccentricity, v0=-o.perihelionSeasonDeg*D;
  const E0=Math.atan2(Math.sqrt(1-e*e)*Math.sin(v0),e+Math.cos(v0));
  const M0=E0-e*Math.sin(E0);
  const E=solveKepler(M0+TAU*days/o.yearEarthDays,e);
  const v=Math.atan2(Math.sqrt(1-e*e)*Math.sin(E),Math.cos(E)-e);
  return wrapDegrees(v/D+o.perihelionSeasonDeg);
}
export interface Illumination {
  declination: number;
  rotationFraction: number;
  frozenMeanWm2: number;
  instantWm2: number;
  elevation: number;
  daylightHours: number | null;
}
/** Frozen-orbit geometry, NOT an integrated sunrise-to-sunset duration. */
export function illumination(p: Readonly<PlanetDefinition>, ls: number, lat: number,
  lon = 0, spin = 0): Illumination {
  bounded(lat, -90, 90); bounded(p.rotation.obliquityDeg, 0, 180);
  const declination=solarDeclinationDeg(p,ls);
  const h=sunsetHourAngleRad(lat,declination);
  const flux=planetaryMomentAtSeason(p,ls).irradianceWm2;
  const phi=lat*D, d=declination*D;
  const mu=Math.max(-1,Math.min(1,dot(surfaceNormal(p.rotation.obliquityDeg,lat,lon,spin),sunDirection(ls))));
  return { declination, rotationFraction:h/Math.PI,
    frozenMeanWm2:Math.max(0,flux/Math.PI*(h*Math.sin(phi)*Math.sin(d)+Math.cos(phi)*Math.cos(d)*Math.sin(h))),
    instantWm2:flux*Math.max(0,Math.abs(mu)<1e-12?0:mu), elevation:Math.asin(mu)/D,
    daylightHours:p.rotation.solarDayHours*h/Math.PI };
}
export function seasonSeries(p: Readonly<PlanetDefinition>, lat: number): {ls:number; fraction:number; mean:number; flux:number}[] {
  bounded(lat,-90,90);
  return Array.from({length:181},(_,i)=>{
    const ls=i*2, v=illumination(p,ls,lat);
    return {ls,fraction:v.rotationFraction,mean:v.frozenMeanWm2,flux:planetaryMomentAtSeason(p,ls).irradianceWm2};
  });
}
