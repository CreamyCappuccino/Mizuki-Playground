import { normalizeOrbit, type OrbitParameters } from '../physics/orbit';
import type { PlanetDefinition } from './definitions';

/**
 * Thin adapter only: legacy Earth solvers remain authoritative and unmoved.
 * It translates the v1.x orbit convention into the planet-generic Ls convention.
 */
export function earthDefinitionFromLegacy(
  obliquityDeg: number,
  orbit: OrbitParameters,
): Readonly<PlanetDefinition> {
  if (!Number.isFinite(obliquityDeg) || obliquityDeg < 0 || obliquityDeg > 90)
    throw new RangeError('Earth legacy obliquity must be between 0 and 90 degrees.');
  const normalized = normalizeOrbit(orbit);
  return {
    id: 'earth',
    name: 'Earth',
    orbit: {
      semiMajorAxisAU: 1,
      eccentricity: normalized.eccentricity,
      // Legacy perihelion is inertial Sun longitude; Ls subtracts the axis azimuth.
      perihelionSeasonDeg: normalized.perihelion - normalized.axis,
      yearEarthDays: 365,
    },
    rotation: {
      obliquityDeg,
      siderealDayHours: 23.9345,
      solarDayHours: 24,
      direction: 'prograde',
    },
    climate: {
      kind: 'earth-existing',
      label: 'Earth v1.x climate workspaces',
    },
  };
}
