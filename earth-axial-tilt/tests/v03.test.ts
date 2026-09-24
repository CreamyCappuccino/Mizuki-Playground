import { describe, expect, it } from 'vitest';
import { Vector3, Euler } from 'three';
import { geographicToCartesian, sunDirection } from '../src/physics/geometry';
import { dailyMeanInsolation, SOLAR_CONSTANT } from '../src/physics/solar';
import {
  solarMoment, rotatingSunDirection, subsolarLongitude, rotationAtSolarHour,
  insolationAtSolarHour, diurnalProfile, wrapRotation, wrapSolarHours, formatSolarClock,
} from '../src/physics/diurnal';
import { advanceSimulation, togglePlayback } from '../src/ui/playback';

const tilts = [0, 23.44, 45, 90];
const days = [80, 171.25, 200, 353.75];

describe('instantaneous solar physics and geographic rotation', () => {
  it('agrees with the actual Three.js Rx(tilt) Ry(rotation) frame', () => {
    for (const tilt of tilts) for (const day of days) for (const rotation of [0, 37.5, 90, 181, 359]) {
      const sun = new Vector3(...sunDirection(day));
      const transform = new Euler(tilt * Math.PI / 180, rotation * Math.PI / 180, 0, 'XYZ');
      const localSun = new Vector3(...rotatingSunDirection(day, tilt, rotation));
      expect(localSun.clone().applyEuler(transform).distanceTo(sun)).toBeLessThan(1e-12);
      for (const latitude of [-90, -55, 0, 25.033, 90]) for (const longitude of [-170, 0, 121.5654]) {
        const normal = new Vector3(...geographicToCartesian(latitude, longitude)).applyEuler(transform);
        const expected = SOLAR_CONSTANT * Math.max(0, normal.dot(sun));
        const actual = solarMoment(latitude, longitude, day, tilt, rotation);
        expect(Math.abs(actual.insolation - expected)).toBeLessThan(1e-8);
        expect(actual.elevationDeg).toBeGreaterThanOrEqual(-90);
        expect(actual.elevationDeg).toBeLessThanOrEqual(90);
      }
    }
  });

  it('averages a full rotation back to the existing daily mean, including polar cases', () => {
    const samples = 1440;
    for (const tilt of tilts) for (const day of days) for (const latitude of [-90, -69, 0, 25.033, 80, 90]) {
      let sum = 0;
      for (let i = 0; i < samples; i++) sum += solarMoment(latitude, 121.5654, day, tilt, (i + 0.5) * 360 / samples).insolation;
      expect(Math.abs(sum / samples - dailyMeanInsolation(latitude, day, tilt))).toBeLessThan(0.01);
    }
  });

  it('matches the independent local-hour-angle curve', () => {
    for (const tilt of tilts) for (const day of days) for (const rotation of [0, 33, 137, 280]) {
      const moment = solarMoment(25.033, 121.5654, day, tilt, rotation);
      if (moment.solarHours !== null) {
        expect(moment.insolation).toBeCloseTo(insolationAtSolarHour(25.033, day, tilt, moment.solarHours), 8);
      }
    }
  });

  it('moves the subsolar longitude westward as the surface turns eastward', () => {
    expect(subsolarLongitude(80, 0, 0)).toBeCloseTo(0, 10);
    expect(subsolarLongitude(80, 0, 90)).toBeCloseTo(-90, 10);
    expect(solarMoment(0, 0, 80, 0, 90).solarHours).toBeCloseTo(18, 10);
    expect(solarMoment(0, 15, 80, 0, 0).solarHours).toBeCloseTo(13, 10);
  });

  it('targets noon and midnight for Taipei without treating them as civil time', () => {
    for (const hour of [0, 6, 12, 18]) {
      const rotation = rotationAtSolarHour(121.5654, 172, 23.44, hour);
      expect(rotation).not.toBeNull();
      const moment = solarMoment(25.033, 121.5654, 172, 23.44, rotation!);
      expect(formatSolarClock(moment.solarHours)).toBe(`${String(hour).padStart(2, '0')}:00`);
      if (hour === 0) expect(moment.insolation).toBe(0);
      if (hour === 12) expect(moment.insolation).toBeGreaterThan(1300);
    }
  });

  it('keeps the tilted rotation axis fixed while surface longitude rotates', () => {
    for (const tilt of tilts) for (const rotation of [0, 90, 180, 270]) {
      const pole = new Vector3(0, 1, 0).applyEuler(new Euler(tilt * Math.PI / 180, rotation * Math.PI / 180, 0, 'XYZ'));
      expect(pole.distanceTo(new Vector3(0, Math.cos(tilt * Math.PI / 180), Math.sin(tilt * Math.PI / 180)))).toBeLessThan(1e-12);
    }
  });

  it('reports undefined meridians rather than an invented clock at exact poles', () => {
    for (const rotation of [0, 30, 270]) {
      expect(solarMoment(90, 0, 172, 23.44, rotation).solarHours).toBeNull();
      const north = solarMoment(90, 0, 171.25, 90, rotation);
      expect(north.insolation).toBeCloseTo(SOLAR_CONSTANT, 8);
      expect(north.illumination).toBe('day');
      const equator = solarMoment(0, 121, 171.25, 90, rotation);
      expect(equator.insolation).toBe(0);
      expect(equator.illumination).toBe('horizon');
      expect(equator.solarHours).toBeNull();
      expect(solarMoment(-90, 0, 171.25, 90, rotation).insolation).toBe(0);
    }
    expect(rotationAtSolarHour(121, 171.25, 90, 12)).toBeNull();
  });

  it('closes the diurnal curve and wraps phases without NaN or 24:60 clocks', () => {
    const curve = diurnalProfile(25.033, 172, 23.44);
    expect(curve).toHaveLength(145);
    expect(curve[0].insolation).toBe(curve[144].insolation);
    expect(wrapRotation(-90)).toBe(270);
    expect(wrapRotation(720)).toBe(0);
    expect(wrapSolarHours(-1)).toBe(23);
    expect(formatSolarClock(23.9999)).toBe('00:00');
    expect(formatSolarClock(null)).toBe('Undefined');
    expect(() => wrapRotation(NaN)).toThrow(RangeError);
    expect(() => wrapSolarHours(Infinity)).toThrow(RangeError);
    expect(solarMoment(25.033, 121, 172, 45, 0).insolation).toBeCloseTo(solarMoment(25.033, 121, 172, 45, 360).insolation, 9);
  });
});

describe('independent day and year playback', () => {
  it('never enables both clocks, and toggles the active one to pause', () => {
    expect(togglePlayback('paused', 'day')).toBe('day');
    expect(togglePlayback('day', 'year')).toBe('year');
    expect(togglePlayback('year', 'day')).toBe('day');
    expect(togglePlayback('day', 'day')).toBe('paused');
  });
  it('holds seasonal date on spin, and holds spin on year playback', () => {
    const day = advanceSimulation(172, 359.9, 'day', 0.1, 1);
    expect(day.day).toBe(172);
    expect(day.rotation).toBeCloseTo(1.1, 10);
    const year = advanceSimulation(365.9, 37.5, 'year', 0.1, 1);
    expect(year.rotation).toBe(37.5);
    expect(year.day).toBeCloseTo(1.6, 10);
    expect(advanceSimulation(172, 37.5, 'paused', 1, 12)).toEqual({ day: 172, rotation: 37.5 });
    expect(advanceSimulation(172, 37.5, 'day', NaN, 1).rotation).toBe(37.5);
    expect(advanceSimulation(172, 0, 'day', 100, 1).rotation).toBeCloseTo(1.2, 10);
  });
});
