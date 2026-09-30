import type { OrbitDefinition, PlanetDefinition } from './definitions';

export const SOLAR_CONSTANT_1_AU = 1361;
const TAU = 2 * Math.PI;
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

function wrapRadians(angle: number): number {
  if (!Number.isFinite(angle)) throw new RangeError('Angle must be finite.');
  return ((angle % TAU) + TAU) % TAU;
}

export function wrapDegrees(angle: number): number {
  if (!Number.isFinite(angle)) throw new RangeError('Angle must be finite.');
  return ((angle % 360) + 360) % 360;
}

function validateOrbit(orbit: OrbitDefinition): void {
  if (!Number.isFinite(orbit.semiMajorAxisAU) || orbit.semiMajorAxisAU <= 0)
    throw new RangeError('Semimajor axis must be positive and finite.');
  if (!Number.isFinite(orbit.eccentricity) || orbit.eccentricity < 0 || orbit.eccentricity >= 1)
    throw new RangeError('Eccentricity must satisfy 0 <= e < 1.');
  if (!Number.isFinite(orbit.yearEarthDays) || orbit.yearEarthDays <= 0)
    throw new RangeError('Orbital period must be positive and finite.');
  wrapDegrees(orbit.perihelionSeasonDeg);
}

function eccentricAnomalyAtTrueAnomaly(trueAnomaly: number, eccentricity: number): number {
  return Math.atan2(
    Math.sqrt(1 - eccentricity * eccentricity) * Math.sin(trueAnomaly),
    eccentricity + Math.cos(trueAnomaly),
  );
}

function meanAtTrueAnomaly(trueAnomaly: number, eccentricity: number): number {
  const eccentricAnomaly = eccentricAnomalyAtTrueAnomaly(trueAnomaly, eccentricity);
  return eccentricAnomaly - eccentricity * Math.sin(eccentricAnomaly);
}

export interface PlanetaryMoment {
  seasonalLongitudeDeg: number;
  phaseFromNorthernSpring: number;
  elapsedEarthDays: number;
  elapsedSolarDays: number;
  distanceAU: number;
  irradianceWm2: number;
  speedRatio: number;
}

/**
 * Planet-generic orbit moment keyed by seasonal longitude Ls.
 * Ls=0 is northern spring; this is a pedagogical season coordinate, not a dated ephemeris.
 */
export function planetaryMomentAtSeason(
  planet: Pick<PlanetDefinition, 'orbit' | 'rotation'>,
  seasonalLongitudeDeg: number,
): PlanetaryMoment {
  const orbit = planet.orbit;
  validateOrbit(orbit);
  if (!Number.isFinite(planet.rotation.solarDayHours) || planet.rotation.solarDayHours <= 0)
    throw new RangeError('Solar day must be positive and finite.');

  const ls = wrapDegrees(seasonalLongitudeDeg);
  const e = orbit.eccentricity;
  const peri = wrapDegrees(orbit.perihelionSeasonDeg) * DEG;
  const trueAnomaly = ls * DEG - peri;
  const springTrueAnomaly = -peri;

  const mean = meanAtTrueAnomaly(trueAnomaly, e);
  const meanAtSpring = meanAtTrueAnomaly(springTrueAnomaly, e);
  const phase = wrapRadians(mean - meanAtSpring) / TAU;

  const distanceAU =
    orbit.semiMajorAxisAU * (1 - e * e) / (1 + e * Math.cos(trueAnomaly));
  const irradianceWm2 = SOLAR_CONSTANT_1_AU / (distanceAU * distanceAU);
  const speedRatio = Math.sqrt(2 * orbit.semiMajorAxisAU / distanceAU - 1);
  const elapsedEarthDays = phase * orbit.yearEarthDays;
  const elapsedSolarDays = elapsedEarthDays * 24 / planet.rotation.solarDayHours;

  return {
    seasonalLongitudeDeg: ls,
    phaseFromNorthernSpring: phase,
    elapsedEarthDays,
    elapsedSolarDays,
    distanceAU,
    irradianceWm2,
    speedRatio,
  };
}

export function solarDeclinationDeg(
  planet: Pick<PlanetDefinition, 'rotation'>,
  seasonalLongitudeDeg: number,
): number {
  const obliquity = planet.rotation.obliquityDeg * DEG;
  const ls = wrapDegrees(seasonalLongitudeDeg) * DEG;
  return Math.asin(Math.max(-1, Math.min(1, Math.sin(obliquity) * Math.sin(ls)))) * RAD;
}

export function daylightHours(
  planet: Pick<PlanetDefinition, 'rotation'>,
  latitudeDeg: number,
  seasonalLongitudeDeg: number,
): number {
  if (!Number.isFinite(latitudeDeg) || latitudeDeg < -90 || latitudeDeg > 90)
    throw new RangeError('Latitude must be between -90 and 90 degrees.');
  const phi = latitudeDeg * DEG;
  const delta = solarDeclinationDeg(planet, seasonalLongitudeDeg) * DEG;
  const a = Math.sin(phi) * Math.sin(delta);
  const b = Math.cos(phi) * Math.cos(delta);
  let hourAngle: number;
  if (Math.abs(b) < 1e-12) hourAngle = a > 1e-12 ? Math.PI : a < -1e-12 ? 0 : Math.PI / 2;
  else {
    const x = -a / b;
    hourAngle = x <= -1 ? Math.PI : x >= 1 ? 0 : Math.acos(x);
  }
  return planet.rotation.solarDayHours * hourAngle / Math.PI;
}

export function yearSolarDays(planet: Pick<PlanetDefinition, 'orbit' | 'rotation'>): number {
  return planet.orbit.yearEarthDays * 24 / planet.rotation.solarDayHours;
}
