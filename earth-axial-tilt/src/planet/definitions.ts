export type PlanetId = 'earth' | 'mars';

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

export const PLANETS: Readonly<Record<PlanetId, Readonly<PlanetDefinition>>> = Object.freeze({
  earth: EARTH_PLANET,
  mars: MARS_PLANET,
});

export function getPlanetDefinition(id: PlanetId): Readonly<PlanetDefinition> {
  return PLANETS[id];
}
