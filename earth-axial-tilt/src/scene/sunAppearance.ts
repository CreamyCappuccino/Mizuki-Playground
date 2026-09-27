import * as THREE from 'three';

export const SUN_APPEARANCE = 'soft-granulation-v1';
const HALO_SIZE = 128;

/** Artistic presentation only: no time, sunlight, orbit or climate input.
 * A shared construction keeps the direction marker and overview Sun consistent.
 * All GPU resources are owned by this group and released by the scene traversal.
 */
export function createSunAppearance(radius: number): THREE.Group {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Invalid Sun display radius.');
  const group = new THREE.Group();
  group.name = 'sun-appearance';
  group.userData.appearance = SUN_APPEARANCE;
  const material = new THREE.ShaderMaterial({
    uniforms: {
      centerColor: { value: new THREE.Color('#fffbe8') },
      rimColor: { value: new THREE.Color('#ffae33') },
    },
    vertexShader: `
      varying vec3 spherePoint;
      varying vec3 viewNormal;
      varying vec3 viewPosition;
      void main() {
        spherePoint = normalize(position);
        viewNormal = normalMatrix * normal;
        vec4 p = modelViewMatrix * vec4(position, 1.0);
        viewPosition = p.xyz;
        gl_Position = projectionMatrix * p;
      }`,
    fragmentShader: `
      uniform vec3 centerColor;
      uniform vec3 rimColor;
      varying vec3 spherePoint;
      varying vec3 viewNormal;
      varying vec3 viewPosition;
      float hash3(vec3 p) {
        p = fract(p * 0.1031);
        p += dot(p, p.yzx + 33.33);
        return fract((p.x + p.y) * p.z);
      }
      float noise3(vec3 p) {
        vec3 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
              mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
              mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 p = normalize(spherePoint);
        float mu = max(0.0, dot(normalize(viewNormal), normalize(-viewPosition)));
        // Fade unresolved grains on the small marker instead of shimmering.
        float footprint = max(length(dFdx(p * 65.0)), length(dFdy(p * 65.0)));
        float resolved = 1.0 - smoothstep(0.3, 1.2, footprint);
        float grain = noise3(p * 65.0) - 0.5;
        float broad = noise3(p * 9.0) - 0.5;
        vec3 color = mix(rimColor, centerColor, pow(mu, 0.38));
        color *= 1.0 + 0.035 * broad + 0.08 * grain * resolved;
        gl_FragColor = vec4(color, 1.0);
        #include <colorspace_fragment>
      }`,
    toneMapped: false,
  });
  const core = new THREE.Mesh(new THREE.SphereGeometry(radius, 64, 48), material);
  core.name = 'sun-core';
  group.add(core);
  group.add(halo(radius, 1.4, 0.24, '#ffd85a', 'sun-inner-glow'));
  group.add(halo(radius, 1.85, 0.085, '#f7a23c', 'sun-outer-halo'));
  return group;
}

function halo(radius: number, extent: number, opacity: number, color: string, name: string): THREE.Sprite {
  const pixels = new Uint8Array(HALO_SIZE * HALO_SIZE * 4);
  // RGB stays white even in transparent texels, avoiding dark filtered edges.
  for (let y = 0; y < HALO_SIZE; y++) for (let x = 0; x < HALO_SIZE; x++) {
    const r = Math.hypot((x + 0.5) * 2 / HALO_SIZE - 1, (y + 0.5) * 2 / HALO_SIZE - 1);
    const d = THREE.MathUtils.clamp((r * extent - 1) / (extent - 1), 0, 1);
    const fade = 1 - d * d * (3 - 2 * d);
    const k = (y * HALO_SIZE + x) * 4;
    pixels[k] = pixels[k + 1] = pixels[k + 2] = 255;
    pixels[k + 3] = Math.round(255 * opacity * fade * fade);
  }
  const texture = new THREE.DataTexture(pixels, HALO_SIZE, HALO_SIZE, THREE.RGBAFormat);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture, color, transparent: true, depthWrite: false, depthTest: true,
    blending: THREE.AdditiveBlending, toneMapped: false,
  }));
  sprite.name = name;
  sprite.scale.set(2 * radius * extent, 2 * radius * extent, 1);
  return sprite;
}
