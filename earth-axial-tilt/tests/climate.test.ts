import { describe, expect, it } from 'vitest';
import { annualProfile, temperatureEstimateC } from '../src/physics/climate';

describe('simplified climate model', () => {
  it('stays within the documented model range', () => {
    for (const tilt of [0, 23.44, 45, 90]) {
      for (const latitude of [-90, -60, -25, 0, 25, 60, 90]) {
        for (const day of [1, 80, 172, 266, 355]) {
          const temperature = temperatureEstimateC(latitude, day, tilt);
          expect(Number.isFinite(temperature)).toBe(true);
          expect(temperature).toBeGreaterThanOrEqual(-65);
          expect(temperature).toBeLessThanOrEqual(55);
        }
      }
    }
  });

  it('produces finite annual profiles at extreme tilt', () => {
    const profile = annualProfile(69.6492, 90);
    expect(profile.length).toBeGreaterThan(180);
    for (const point of profile) {
      expect(Number.isFinite(point.temperature)).toBe(true);
      expect(point.daylight).toBeGreaterThanOrEqual(0);
      expect(point.daylight).toBeLessThanOrEqual(24);
      expect(point.insolation).toBeGreaterThanOrEqual(0);
    }
  });
});
