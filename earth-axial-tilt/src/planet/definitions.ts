export type PlanetId = 'earth' | 'mars' | 'uranus' | 'mercury';

export interface OrbitDefinition {
  /** Semimajor axis in astronomical units. */
  semiMajorAxisAU: number;
  /** Orbital eccentricity, 0 <= e < 1. */
  eccentricity: number;
  /** Seasonal longitude Ls of perihelion, degrees from northern spring. */
  perihelionSeasonDeg: number;
  /** Model orbital period measured in Earth mean solar days. */
  yearEarthDays: number;
}

export interface RotationDefinition {
  /** Axial obliquity in degrees. */
  obliquityDeg: number;
  /** Sidereal rotation period in hours. */
  siderealDayHours: number;
  /** Mean solar day in hours, used for reported daylight duration. */
  solarDayHours: number;
  direction: 'prograde' | 'retrograde';
}

export type ClimateModelCapability =
  | { kind: 'earth-existing'; label: string }
  | { kind: 'none'; reason: string };

export interface PlanetDefinition {
  id: PlanetId;
  name: string;
  orbit: Readonly<OrbitDefinition>;
  rotation: Readonly<RotationDefinition>;
  climate: Readonly<ClimateModelCapability>;
}

export const EARTH_PLANET: Readonly<PlanetDefinition> = Object.freeze({
  id: 'earth',
  name: 'Earth',
  orbit: Object.freeze({
    semiMajorAxisAU: 1,
    eccentricity: 0.0167,
    perihelionSeasonDeg: 282.94,
    // Keep the existing lab's model year rather than silently changing Earth v1.x semantics.
    yearEarthDays: 365,
  }),
  rotation: Object.freeze({
    obliquityDeg: 23.44,
    siderealDayHours: 23.9345,
    solarDayHours: 24,
    direction: 'prograde',
  }),
  climate: Object.freeze({
    kind: 'earth-existing',
    label: 'Earth v1.x climate workspaces',
  }),
});

export const MARS_PLANET: Readonly<PlanetDefinition> = Object.freeze({
  id: 'mars',
  name: 'Mars',
  orbit: Object.freeze({
    semiMajorAxisAU: 1.523679,
    eccentricity: 0.0934,
    perihelionSeasonDeg: 251,
    yearEarthDays: 686.98,
  }),
  rotation: Object.freeze({
    obliquityDeg: 25.19,
    siderealDayHours: 24.6229,
    solarDayHours: 24.6597,
    direction: 'prograde',
  }),
  climate: Object.freeze({
    kind: 'none',
    reason: 'No Mars temperature model is supplied in v2.1; astronomy metrics only.',
  }),
});

/** Fixed J2000-like teaching world. Positive latitude follows the spin pole,
 * opposite the IAU cartographic north pole for Uranus. See docs/V2.2.md. */
export const URANUS_PLANET: Readonly<PlanetDefinition> = Object.freeze({
  id: 'uranus', name: 'Uranus',
  orbit: Object.freeze({
    semiMajorAxisAU: 19.18916464, eccentricity: 0.04725744,
    perihelionSeasonDeg: 3.4124884286485,
    yearEarthDays: 84.016846 * 365.25,
  }),
  rotation: Object.freeze({
    obliquityDeg: 97.77, siderealDayHours: 17.24,
    solarDayHours: 24 / (24 / 17.24 + 1 / (84.016846 * 365.25)),
    direction: 'retrograde',
  }),
  climate: Object.freeze({ kind: 'none', reason: 'No Uranus climate model; geometric illumination only.' }),
});

/** Exact 3:2 teaching resonance: no libration or secular precession.
 * Fixed JPL J2000 orbital elements; pole angle derived in audits/planet. */
const MERCURY_YEAR_DAYS = 0.2408467 * 365.25;
export const MERCURY_PLANET: Readonly<PlanetDefinition> = Object.freeze({
  id: 'mercury', name: 'Mercury',
  orbit: Object.freeze({
    semiMajorAxisAU: 0.38709927, eccentricity: 0.20563593,
    perihelionSeasonDeg: 49.24790603457269, yearEarthDays: MERCURY_YEAR_DAYS,
  }),
  rotation: Object.freeze({
    obliquityDeg: 0.034,
    siderealDayHours: MERCURY_YEAR_DAYS * 2 / 3 * 24,
    solarDayHours: MERCURY_YEAR_DAYS * 2 * 24,
    direction: 'prograde',
  }),
  climate: Object.freeze({kind: 'none', reason: 'No Mercury temperature model; use the coupled Sun experiment.'}),
});

export const PLANETS: Readonly<Record<PlanetId, Readonly<PlanetDefinition>>> = Object.freeze({
  earth: EARTH_PLANET,
  mars: MARS_PLANET,
  uranus: URANUS_PLANET,
  mercury: MERCURY_PLANET,
});

export function getPlanetDefinition(id: PlanetId): Readonly<PlanetDefinition> {
  return PLANETS[id];
}
