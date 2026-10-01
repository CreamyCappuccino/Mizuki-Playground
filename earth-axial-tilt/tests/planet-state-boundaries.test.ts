import { describe, it, expect } from 'vitest';
import { decodePlanetState, DEFAULT_PLANET_STATE, encodePlanetState, validatePlanetState } from '../src/planet/state';
describe('Planet Lab state boundaries', () => {
  it('rejects missing, blank, unknown, malformed and oversized fields', () => {
    for (const bad of ['#planet=1&a=earth&b=mars&lat=25', '#planet=1&a=earth&b=mars&ls=90',
      '#planet=1&a=earth&b=mars&ls=&lat=25', '#planet=1&a=earth&b=mars&ls=90&lat=%20',
      '#planet=1&a=earth&b=mars&ls=0x10&lat=25', '#planet=1&a=earth&b=mars&ls=90&lat=25&extra=x',
      '#planet=1&a=earth&b=mars&ls=%&lat=25', '#'+ 'x'.repeat(2048)])
      expect(decodePlanetState(bad).status).toBe('error');
  });
  it('accepts exact zero, scientific decimal notation, fractional angles and poles', () => {
    for (const ls of [0, 0.1, 1e-7, 90, 359.999999]) for (const lat of [-90, 0, 90]) {
      const state = { ...DEFAULT_PLANET_STATE, seasonalLongitudeDeg: ls, latitudeDeg: lat };
      expect(decodePlanetState(encodePlanetState(state))).toEqual({ status: 'ok', state });
    }
    expect(validatePlanetState([])).toBeNull();
  });
});
