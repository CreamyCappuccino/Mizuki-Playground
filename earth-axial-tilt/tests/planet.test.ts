import { strict as assert } from 'node:assert';
import { describe, it } from 'vitest';
import { EARTH_PLANET, MARS_PLANET } from '../src/planet/definitions';
import { daylightHours, planetaryMomentAtSeason, solarDeclinationDeg, yearSolarDays } from '../src/planet/astronomy';
import { earthDefinitionFromLegacy } from '../src/planet/earthAdapter';
import { decodePlanetState, DEFAULT_PLANET_STATE, encodePlanetState, planetShareURL } from '../src/planet/state';
import { dayAtSeasonalLongitude, orbitalMoment, type OrbitParameters } from '../src/physics/orbit';
import { dailyMeanInsolation, dayLengthHours, solarDeclinationDeg as legacyDeclination } from '../src/physics/solar';

function near(a: number, b: number, tolerance: number): void {
  assert.ok(Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance,
    `${a} differs from ${b} by ${Math.abs(a - b)} (tolerance ${tolerance})`);
}

describe('Planet Lab v2.0 foundation', () => {
  it('keeps the generic Earth adapter numerically aligned with the untouched v1.x orbit', () => {
    const orbits: OrbitParameters[] = [
      { eccentricity: 0, perihelion: 0, axis: 0 },
      { eccentricity: 0.0167, perihelion: 282.94, axis: 0 },
      { eccentricity: 0.2, perihelion: 25, axis: 140 },
      { eccentricity: 0.3, perihelion: 300, axis: 359.9 },
    ];
    for (const orbit of orbits) for (const ls of [0, 1, 90, 180, 251, 270, 359.9]) {
      const planet = earthDefinitionFromLegacy(23.44, orbit);
      const generic = planetaryMomentAtSeason(planet, ls);
      const day = dayAtSeasonalLongitude(ls, orbit);
      const legacy = orbitalMoment(day, orbit);
      near(generic.distanceAU, legacy.distanceAU, 5e-13);
      near(generic.irradianceWm2, 1361 * legacy.irradianceFactor, 2e-9);
      near(generic.elapsedEarthDays, ((day - 80 + 365) % 365), 5e-10);
      near(solarDeclinationDeg(planet, ls), legacyDeclination(day, 23.44, orbit), 2e-12);
      near(daylightHours(planet, 25, ls), dayLengthHours(25, day, 23.44, orbit), 2e-12);
    }
  });

  it('exposes capabilities instead of assuming every planet has an Earth temperature model', () => {
    assert.equal(EARTH_PLANET.climate.kind, 'earth-existing');
    assert.equal(MARS_PLANET.climate.kind, 'none');
  });

  it('reports Mars orbital extrema and year length from its own definition', () => {
    const peri = planetaryMomentAtSeason(MARS_PLANET, MARS_PLANET.orbit.perihelionSeasonDeg);
    const aph = planetaryMomentAtSeason(MARS_PLANET, MARS_PLANET.orbit.perihelionSeasonDeg + 180);
    near(peri.distanceAU, 1.523679 * (1 - 0.0934), 2e-12);
    near(aph.distanceAU, 1.523679 * (1 + 0.0934), 2e-12);
    assert.ok(peri.irradianceWm2 > aph.irradianceWm2);
    near(yearSolarDays(MARS_PLANET), 686.98 * 24 / 24.6597, 1e-12);
  });

  it('uses each planet solar day when reporting daylight', () => {
    near(daylightHours(EARTH_PLANET, 0, 90), 12, 1e-12);
    near(daylightHours(MARS_PLANET, 0, 90), MARS_PLANET.rotation.solarDayHours / 2, 1e-12);
    assert.ok(solarDeclinationDeg(MARS_PLANET, 90) > solarDeclinationDeg(EARTH_PLANET, 90));
  });
});

describe('Planet Lab v2.1 portable state', () => {
  it('round-trips a bounded independent schema', () => {
    const state = { ...DEFAULT_PLANET_STATE, seasonalLongitudeDeg: 251, latitudeDeg: -30 } as const;
    assert.deepEqual(decodePlanetState(encodePlanetState(state)), { status: 'ok', state });
    const url = new URL(planetShareURL('https://u:p@example.test/planet-lab.html?secret=x#old', state));
    assert.equal(url.username, '');
    assert.equal(url.password, '');
    assert.equal(url.search, '');
    assert.deepEqual(decodePlanetState(url.hash), { status: 'ok', state });
  });

  it('rejects duplicates, bad versions and out-of-range owned fields', () => {
    for (const hash of ['#planet=2&a=earth&b=mars&ls=90&lat=25', '#planet=1&a=earth&a=mars&b=mars&ls=90&lat=25',
      '#planet=1&a=venus&b=mars&ls=90&lat=25', '#planet=1&a=earth&b=mars&ls=360&lat=25',
      '#planet=1&a=earth&b=mars&ls=90&lat=91'])
      assert.equal(decodePlanetState(hash).status, 'error');
  });
});
