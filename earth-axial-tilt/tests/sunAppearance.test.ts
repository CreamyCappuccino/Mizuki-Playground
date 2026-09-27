import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createSunAppearance, SUN_APPEARANCE } from '../src/scene/sunAppearance';

function dispose(group: THREE.Group): void {
  group.traverse(object => {
    const mesh = object as THREE.Mesh;
    mesh.geometry?.dispose();
    for (const material of mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : []) {
      (material as THREE.SpriteMaterial).map?.dispose(); material.dispose();
    }
  });
}

describe('shared static Sun presentation', () => {
  it.each([0, -1, NaN, Infinity])('rejects invalid display radius %s', radius => {
    expect(() => createSunAppearance(radius)).toThrow('Invalid Sun display radius');
  });
  it('uses the same three-layer appearance at both existing display radii', () => {
    for (const radius of [0.38, 2]) {
      const sun = createSunAppearance(radius);
      expect(sun.userData.appearance).toBe(SUN_APPEARANCE);
      expect(sun.children.map(child => child.name)).toEqual(['sun-core', 'sun-inner-glow', 'sun-outer-halo']);
      const core = sun.children[0] as THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
      expect(core.geometry.parameters.radius).toBe(radius);
      expect(core.material.toneMapped).toBe(false);
      expect(Object.keys(core.material.uniforms).sort()).toEqual(['centerColor', 'rimColor']);
      expect(sun.children[1].scale.x).toBeCloseTo(radius * 2.8);
      expect(sun.children[2].scale.x).toBeCloseTo(radius * 3.7);
      dispose(sun);
    }
  });
  it('lets foreground Earth occlude each halo and leaves the depth buffer untouched', () => {
    const sun = createSunAppearance(2);
    for (const child of sun.children.slice(1) as THREE.Sprite[]) {
      expect(child.material.depthTest).toBe(true);
      expect(child.material.depthWrite).toBe(false);
      expect(child.material.blending).toBe(THREE.AdditiveBlending);
      expect(child.material.toneMapped).toBe(false);
    }
    dispose(sun);
  });
  it('generates finite deterministic soft transparent textures with bounded allocation', () => {
    const a = createSunAppearance(2), b = createSunAppearance(0.38);
    let bytes = 0;
    for (let i = 1; i < 3; i++) {
      const map = (a.children[i] as THREE.Sprite).material.map as THREE.DataTexture;
      const other = (b.children[i] as THREE.Sprite).material.map as THREE.DataTexture;
      const pixels = map.image.data as Uint8Array;
      expect(pixels).toEqual(other.image.data);
      expect(map).not.toBe(other);
      expect(map.image.width).toBe(128);
      expect(pixels[3]).toBe(0);
      expect(pixels[(64 * 128 + 64) * 4 + 3]).toBeGreaterThan(0);
      expect(pixels[(64 * 128 + 127) * 4 + 3]).toBe(0);
      expect(map.magFilter).toBe(THREE.LinearFilter);
      bytes += pixels.byteLength;
    }
    expect(bytes).toBe(131072);
    dispose(a); dispose(b);
  });
});
