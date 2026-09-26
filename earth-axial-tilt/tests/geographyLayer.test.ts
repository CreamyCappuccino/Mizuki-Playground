import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GeographyLayer, geographyColorPixels } from '../src/scene/geographyLayer';
import { geographyTemperatureSource } from '../src/physics/geographyTemperatureSource';
import { buildGeographyGrid } from '../src/physics/geographyGrid';
import { GEOGRAPHY_GRID_ID, GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID } from '../src/physics/geographyMask';
import type { GeographyClimateSolution } from '../src/physics/geographyClimate';

function source() {
  const grid = buildGeographyGrid(), orbit = { eccentricity: 0, perihelion: 0, axis: 0 };
  const field: GeographyClimateSolution = { grid, orbit, tilt: 23.44,
    temperatures: Float64Array.from({ length: 365 * 648 }, (_, k) => k % 648 / 4 - 100),
    landFraction: new Float64Array(648), years: 1, stepsPerDay: 2, periodicError: 0,
    energyResidual: 0, maxStepEnergyResidual: 0, maxRelativeLinearResidual: 0,
    maxLinearIterations: 1, minimum: -100, maximum: 62,
    provenance: { id: GEOGRAPHY_MASK_DIGEST, grid: GEOGRAPHY_GRID_ID,
      solver: GEOGRAPHY_SOLVER_ID, retainedClassicDepth: 10 } };
  return geographyTemperatureSource({ tilt: 23.44, orbit, retainedDepth: 10 }, field);
}
describe('nearest scientific cell globe layer', () => {
  it('stores exactly one color per south-to-north/west-to-east cell', () => {
    const s = source(), pixels = geographyColorPixels(s, 1)!;
    expect(pixels.length).toBe(36 * 18 * 4);
    expect(pixels.slice(0, 4)).not.toEqual(pixels.slice(647 * 4));
    expect(geographyColorPixels(s, 366)).toEqual(pixels);
    expect(geographyColorPixels(s, 1.5)).toEqual(pixels);
    expect(geographyColorPixels({ ...s, tilt: 60 }, 1)).toBeNull();
  });
  it('uses nearest filtering without mipmaps or interpolated mesh vertex colors', () => {
    const geometry = new THREE.SphereGeometry(2), layer = new GeographyLayer(geometry);
    expect(layer.texture.minFilter).toBe(THREE.NearestFilter);
    expect(layer.texture.magFilter).toBe(THREE.NearestFilter);
    expect(layer.texture.generateMipmaps).toBe(false);
    expect(layer.material.fragmentShader).toContain('atan(-p.z, p.x)');
    expect(layer.material.fragmentShader).toContain('floor((latitude + 90.0) / 10.0)');
    layer.dispose(); layer.material.dispose(); geometry.dispose();
  });
  it('hides pending, stale and off-mode fields instead of retaining old temperatures', () => {
    const geometry = new THREE.SphereGeometry(2), layer = new GeographyLayer(geometry), s = source();
    layer.update(s, 172, true); expect(layer.mesh.visible).toBe(true);
    layer.update({ ...s, geography: null }, 172, true); expect(layer.mesh.visible).toBe(false);
    layer.update({ ...s, depth: 50 }, 172, true); expect(layer.mesh.visible).toBe(false);
    layer.update(s, 172, false); expect(layer.mesh.visible).toBe(false);
    layer.update(s, 172, true); expect(layer.mesh.visible).toBe(true);
    layer.dispose(); layer.material.dispose(); geometry.dispose();
  });
});
