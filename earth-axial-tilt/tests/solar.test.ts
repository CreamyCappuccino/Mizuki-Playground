import { describe, expect, it } from 'vitest';
import {
  dailyMeanInsolation,
  dayLengthHours,
  solarDeclinationDeg,
} from '../src/physics/solar';

describe('solar geometry', () => {
  it('keeps declination at zero for zero obliquity', () => {
    for (const day of [1, 80, 172, 266, 355]) {
      expect(solarDeclinationDeg(day, 0)).toBeCloseTo(0, 8);
    }
  });

  it('reaches approximately Earth obliquity at the solstices', () => {
    expect(solarDeclinationDeg(172, 23.44)).toBeCloseTo(23.44, 1);
    expect(solarDeclinationDeg(355, 23.44)).toBeCloseTo(-23.44, 1);
  });

  it('keeps equatorial day length near 12 hours', () => {
    for (const tilt of [0, 23.44, 45, 90]) {
      for (const day of [1, 80, 172, 266, 355]) {
        expect(dayLengthHours(0, day, tilt)).toBeCloseTo(12, 8);
      }
    }
  });

  it('creates polar day and night at high latitude', () => {
    expect(dayLengthHours(80, 172, 23.44)).toBe(24);
    expect(dayLengthHours(80, 355, 23.44)).toBe(0);
  });

  it('preserves north/south seasonal symmetry', () => {
    const north = dailyMeanInsolation(45, 172, 23.44);
    const south = dailyMeanInsolation(-45, 354, 23.44);
    expect(north).toBeCloseTo(south, 0);
  });

  it('stays finite and non-negative at extreme tilts', () => {
    for (const tilt of [0, 45, 90]) {
      for (const lat of [-90, -60, 0, 60, 90]) {
        for (const day of [1, 80, 172, 266, 355]) {
          const daylight = dayLengthHours(lat, day, tilt);
          const solar = dailyMeanInsolation(lat, day, tilt);
          expect(Number.isFinite(daylight)).toBe(true);
          expect(Number.isFinite(solar)).toBe(true);
          expect(daylight).toBeGreaterThanOrEqual(0);
          expect(daylight).toBeLessThanOrEqual(24);
          expect(solar).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });

  it('never exceeds the configured obliquity in declination', () => {
    for (const tilt of [0, 23.44, 45, 60, 90]) {
      for (let day = 1; day <= 365; day += 7) {
        expect(Math.abs(solarDeclinationDeg(day, tilt))).toBeLessThanOrEqual(tilt + 1e-9);
      }
    }
  });
});
