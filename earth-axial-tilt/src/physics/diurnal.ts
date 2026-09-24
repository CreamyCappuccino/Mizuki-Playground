import { geographicToCartesian, subsolarDirectionLocal, type Vector3Tuple } from './geometry';
import { clamp, degToRad, radToDeg, solarDeclinationDeg, SOLAR_CONSTANT } from './solar';

const HORIZON_EPSILON = 1e-12;

export function wrapRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) throw new RangeError('Rotation must be finite.');
  return ((degrees % 360) + 360) % 360;
}

export function wrapSolarHours(hours: number): number {
  if (!Number.isFinite(hours)) throw new RangeError('Solar hour must be finite.');
  return ((hours % 24) + 24) % 24;
}

/** Sun in the rotating geographic frame: inverse Y spin after inverse X tilt. */
export function rotatingSunDirection(day: number, tilt: number, rotation: number): Vector3Tuple {
  const [x, y, z] = subsolarDirectionLocal(day, tilt);
  const angle = degToRad(wrapRotation(rotation));
  return [x * Math.cos(angle) - z * Math.sin(angle), y,
    x * Math.sin(angle) + z * Math.cos(angle)];
}

/** Longitude is undefined when the Sun is exactly over a pole. */
export function subsolarLongitude(day: number, tilt: number, rotation: number): number | null {
  const [x, , z] = rotatingSunDirection(day, tilt, rotation);
  return Math.hypot(x, z) < HORIZON_EPSILON ? null : radToDeg(Math.atan2(-z, x));
}

export interface SolarMoment {
  elevationDeg: number;
  insolation: number;
  solarHours: number | null;
  illumination: 'day' | 'night' | 'horizon';
}

/** Geometric point Sun, horizontal surface, top of atmosphere; not surface irradiance. */
export function solarMoment(
  latitude: number, longitude: number, day: number, tilt: number, rotation: number,
): SolarMoment {
  const normal = geographicToCartesian(latitude, longitude);
  const sun = rotatingSunDirection(day, tilt, rotation);
  let cosine = clamp(normal[0] * sun[0] + normal[1] * sun[1] + normal[2] * sun[2], -1, 1);
  if (Math.abs(cosine) < HORIZON_EPSILON) cosine = 0;
  const sunLongitude = subsolarLongitude(day, tilt, rotation);
  const undefinedMeridian = sunLongitude === null || Math.abs(Math.cos(degToRad(latitude))) < HORIZON_EPSILON;
  return {
    elevationDeg: radToDeg(Math.asin(cosine)),
    insolation: SOLAR_CONSTANT * Math.max(0, cosine),
    solarHours: undefinedMeridian ? null : wrapSolarHours(12 + (longitude - sunLongitude!) / 15),
    illumination: cosine > 0 ? 'day' : cosine < 0 ? 'night' : 'horizon',
  };
}

/** Orient a selected meridian to apparent solar noon/midnight, not a time zone. */
export function rotationAtSolarHour(
  longitude: number, day: number, tilt: number, solarHours: number,
): number | null {
  const longitudeAtZero = subsolarLongitude(day, tilt, 0);
  if (longitudeAtZero === null) return null;
  return wrapRotation(longitudeAtZero - longitude + 15 * (wrapSolarHours(solarHours) - 12));
}

/** Independent hour-angle formulation used to plot a full local solar day. */
export function insolationAtSolarHour(latitude: number, day: number, tilt: number, hours: number): number {
  const phi = degToRad(latitude);
  const delta = degToRad(solarDeclinationDeg(day, tilt));
  const hourAngle = degToRad(15 * (wrapSolarHours(hours) - 12));
  const cosine = Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle);
  return cosine < HORIZON_EPSILON ? 0 : SOLAR_CONSTANT * Math.min(1, cosine);
}

export interface DiurnalPoint { hour: number; insolation: number }

export function diurnalProfile(latitude: number, day: number, tilt: number): DiurnalPoint[] {
  return Array.from({ length: 145 }, (_, i) => ({
    hour: i / 6,
    insolation: insolationAtSolarHour(latitude, day, tilt, i / 6),
  }));
}

export function formatSolarClock(hours: number | null): string {
  if (hours === null) return 'Undefined';
  const minutes = Math.round(wrapSolarHours(hours) * 60) % 1440;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}
