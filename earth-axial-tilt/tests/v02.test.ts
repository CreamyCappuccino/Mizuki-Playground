import { describe, expect, it } from 'vitest';
import { Vector3, Euler, SphereGeometry } from 'three';
import { parseTiltInput } from '../src/ui/tiltInput';
import { geographicToCartesian, cartesianToGeographic, sunDirection, subsolarDirectionLocal } from '../src/physics/geometry';
import { dailyMeanInsolation, dayLengthHours, solarDeclinationDeg, SOLAR_CONSTANT } from '../src/physics/solar';
import { annualProfile, temperatureEstimateC } from '../src/physics/climate';

describe('precise tilt input', () => {
  it('accepts endpoints and decimal precision', () => {
    expect(parseTiltInput('0')).toBe(0);
    expect(parseTiltInput('90')).toBe(90);
    expect(parseTiltInput('23.44')).toBe(23.44);
    expect(parseTiltInput(' 37.125 ')).toBe(37.13);
  });
  it('rejects empty, nonfinite and out-of-range values before changing state', () => {
    for (const raw of ['', ' ', 'NaN', 'Infinity', '1e309', 'abc', '-1', '90.001', '100']) {
      expect(parseTiltInput(raw)).toBeNull();
    }
  });
});

describe('globe / astronomy agreement', () => {
  it('round-trips geographic coordinates including Taipei', () => {
    for (const lat of [-89, -25, 0, 25.033, 69.6492, 89]) {
      for (const lon of [-179, -90, 0, 121.5654, 179]) {
        const point = cartesianToGeographic(geographicToCartesian(lat, lon));
        expect(point.latitude).toBeCloseTo(lat, 9);
        expect(point.longitude).toBeCloseTo(lon, 9);
      }
    }
  });
  it('matches actual Three.js SphereGeometry texture coordinates', () => {
    const sphere = new SphereGeometry(1, 24, 12);
    const position = sphere.attributes.position;
    const uv = sphere.attributes.uv;
    for (let i = 0; i < position.count; i += 1) {
      const lat = (uv.getY(i) - 0.5) * 180;
      if (Math.abs(lat) > 89) continue; // pole UV seams include a deliberate offset
      const expected = geographicToCartesian(lat, (uv.getX(i) - 0.5) * 360);
      expect(new Vector3(...expected).distanceTo(new Vector3().fromBufferAttribute(position, i))).toBeLessThan(1e-6);
    }
    sphere.dispose();
  });
  it('places the subsolar marker at the computed declination and toward the light', () => {
    for (const tilt of [0, 23.44, 37.5, 60, 90]) {
      for (const day of [1, 80, 171.25, 262.5, 353.75]) {
        const local = subsolarDirectionLocal(day, tilt);
        expect(cartesianToGeographic(local).latitude).toBeCloseTo(solarDeclinationDeg(day, tilt), 7);
        const world = new Vector3(...local).applyEuler(new Euler(-tilt * Math.PI / 180, 0, 0));
        expect(world.distanceTo(new Vector3(...sunDirection(day)))).toBeLessThan(1e-12);
      }
    }
  });
  it('keeps every terminator normal perpendicular to sunlight', () => {
    for (const day of [1, 80, 172, 266, 355]) {
      const sun = new Vector3(...sunDirection(day));
      const first = new Vector3(0, 1, 0).cross(sun).normalize();
      const second = sun.clone().cross(first).normalize();
      for (let i = 0; i < 48; i += 1) {
        const a = i * Math.PI / 24;
        const point = first.clone().multiplyScalar(Math.cos(a)).addScaledVector(second, Math.sin(a));
        expect(Math.abs(sun.dot(point))).toBeLessThan(1e-12);
      }
    }
  });
});

describe('extreme geometry and annual statistics', () => {
  it('uses a documented finite horizon convention at exact 90-degree solstice', () => {
    expect(dayLengthHours(0, 171.25, 90)).toBe(12);
    expect(dailyMeanInsolation(0, 171.25, 90)).toBeLessThan(1e-8);
    expect(dailyMeanInsolation(90, 171.25, 90)).toBeCloseTo(SOLAR_CONSTANT, 8);
    expect(dayLengthHours(-90, 171.25, 90)).toBe(0);
  });
  it('conserves global incoming solar energy for all tested tilts', () => {
    const count = 1800;
    for (const tilt of [0, 23.44, 45, 90]) {
      for (const day of [80, 171.25, 262.5, 353.75]) {
        let sum = 0;
        let weight = 0;
        for (let i = 0; i < count; i += 1) {
          const lat = -90 + (i + 0.5) * 180 / count;
          const w = Math.cos(lat * Math.PI / 180);
          sum += dailyMeanInsolation(lat, day, tilt) * w;
          weight += w;
        }
        expect(Math.abs(sum / weight - SOLAR_CONSTANT / 4)).toBeLessThan(0.01);
      }
    }
  });
  it('provides one point per day for unbiased annual summaries', () => {
    const profile = annualProfile(25.033, 23.44);
    expect(profile).toHaveLength(365);
    expect(profile[0].day).toBe(1);
    expect(profile[364].day).toBe(365);
    const mean = profile.reduce((sum, point) => sum + point.temperature, 0) / 365;
    expect(mean).toBeCloseTo(20.36476804, 5); // illustrative, deliberately not station-calibrated
  });
  it('keeps seasonal temperature continuous across fractional dates and year wrap', () => {
    expect(Math.abs(temperatureEstimateC(60, 100.49999, 45) - temperatureEstimateC(60, 100.50001, 45))).toBeLessThan(0.0001);
    expect(temperatureEstimateC(25.033, 366, 23.44)).toBeCloseTo(temperatureEstimateC(25.033, 1, 23.44), 10);
  });
});
