import { describe, expect, it } from 'vitest';
import { CLASSIC_ORBIT, MAX_EDUCATIONAL_ECCENTRICITY, meanLongitudeRad, modelDayAtTrueLongitude,
  orbitalAxisDirection, orbitalState, orbitalSunDirection, solveEccentricAnomaly, validateOrbit } from '../src/physics/orbit';

describe('v1.2 Kepler orbit in the shared prograde frame', () => {
  it('returns the exact v1.1 circular longitude, distance, flux and speed', () => {
    for (const day of [1, 80, 171.25, 262.5, 353.75, 365.9]) {
      const classic = orbitalState(day, CLASSIC_ORBIT);
      const degenerate = { ...CLASSIC_ORBIT, perihelionLongitude: 237 };
      expect(Math.cos(classic.trueLongitudeRad)).toBeCloseTo(Math.cos(meanLongitudeRad(day)), 13);
      expect(Math.sin(classic.trueLongitudeRad)).toBeCloseTo(Math.sin(meanLongitudeRad(day)), 13);
      expect(classic.distanceAu).toBe(1);
      expect(classic.relativeFlux).toBe(1);
      expect(classic.relativeSpeed).toBe(1);
      const shifted = orbitalSunDirection(day, degenerate);
      const baseline = orbitalSunDirection(day, CLASSIC_ORBIT);
      shifted.forEach((value, index) => expect(value).toBeCloseTo(baseline[index], 13));
    }
  });

  it('solves Kepler equation and advances equal mean-anomaly areas in equal times', () => {
    const eccentricity = 0.42;
    for (const mean of [-2.9, -1.3, 0, 0.8, 2.9]) {
      const eccentric = solveEccentricAnomaly(mean, eccentricity);
      expect(eccentric - eccentricity * Math.sin(eccentric)).toBeCloseTo(mean, 13);
    }
    const a = orbitalState(40, { ...CLASSIC_ORBIT, eccentricity });
    const b = orbitalState(70, { ...CLASSIC_ORBIT, eccentricity });
    const c = orbitalState(100, { ...CLASSIC_ORBIT, eccentricity });
    expect(b.meanAnomalyRad - a.meanAnomalyRad).toBeCloseTo(c.meanAnomalyRad - b.meanAnomalyRad, 13);
  });

  it('matches perihelion/aphelion distance, inverse-square flux and vis-viva speed', () => {
    const orbit = { eccentricity: 0.4, perihelionLongitude: 0, axisLongitude: 0 };
    const perihelion = orbitalState(80, orbit);
    const aphelion = orbitalState(262.5, orbit);
    expect(perihelion.distanceAu).toBeCloseTo(0.6, 13);
    expect(aphelion.distanceAu).toBeCloseTo(1.4, 13);
    expect(perihelion.relativeFlux / aphelion.relativeFlux).toBeCloseTo((1.4 / 0.6) ** 2, 12);
    expect(perihelion.relativeSpeed).toBeGreaterThan(aphelion.relativeSpeed);
  });

  it('keeps tilt magnitude while rotating axis orientation in the common frame', () => {
    const a = orbitalAxisDirection(23.44, 0);
    const b = orbitalAxisDirection(23.44, 90);
    expect(a[0]).toBeCloseTo(0, 13);
    expect(b[2]).toBeCloseTo(0, 13);
    expect(Math.hypot(...a)).toBeCloseTo(1, 13);
    expect(Math.hypot(...b)).toBeCloseTo(1, 13);
    expect(a[1]).toBeCloseTo(b[1], 13);
  });

  it('round-trips true-longitude season markers to model time', () => {
    const orbit = { eccentricity: 0.3, perihelionLongitude: 125, axisLongitude: 35 };
    for (const target of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const day = modelDayAtTrueLongitude(target, orbit);
      const actual = orbitalState(day, orbit).trueLongitudeRad;
      expect(Math.cos(actual)).toBeCloseTo(Math.cos(target), 12);
      expect(Math.sin(actual)).toBeCloseTo(Math.sin(target), 12);
    }
  });

  it('rejects invalid eccentricity and normalizes inertial angles', () => {
    expect(() => validateOrbit({ ...CLASSIC_ORBIT, eccentricity: MAX_EDUCATIONAL_ECCENTRICITY + 0.01 })).toThrow();
    expect(validateOrbit({ eccentricity: 0.1, perihelionLongitude: -90, axisLongitude: 450 }))
      .toEqual({ eccentricity: 0.1, perihelionLongitude: 270, axisLongitude: 90 });
  });
});
