import * as THREE from 'three';

export type VisualAsset = 'day' | 'night';
export type AssetStatus = 'loading' | 'ready' | 'error';

/** Fixed imagery only; never used as albedo, weather, or climate-model input. */
export class EarthAppearance {
  readonly night: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  readonly atmosphere: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly textures: THREE.Texture[] = [];
  private disposed = false;
  private nightReady = false;
  private lightsEnabled = true;
  private naturalLayer = true;

  constructor(geometry: THREE.SphereGeometry, material: THREE.MeshPhongMaterial,
    private readonly invalidate: () => void,
    private readonly onStatus: (asset: VisualAsset, status: AssetStatus) => void) {
    this.night = new THREE.Mesh(geometry.clone(), new THREE.ShaderMaterial({
      uniforms: { nightMap: { value: null }, sunLocal: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: `
        varying vec2 mapUv;
        varying vec3 surfaceNormal;
        void main() {
          mapUv = uv; surfaceNormal = normal;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D nightMap;
        uniform vec3 sunLocal;
        varying vec2 mapUv;
        varying vec3 surfaceNormal;
        void main() {
          // Fade out across the geometric terminator; never illuminate the daytime map.
          float darkness = 1.0 - smoothstep(-0.12, 0.04, dot(normalize(surfaceNormal), sunLocal));
          vec3 lights = texture2D(nightMap, mapUv).rgb;
          gl_FragColor = vec4(lights * 1.15, darkness);
          #include <colorspace_fragment>
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.night.scale.setScalar(1.0007);
    this.night.visible = false;
    this.atmosphere = new THREE.Mesh(geometry.clone(), new THREE.ShaderMaterial({
      uniforms: { sunWorld: { value: new THREE.Vector3(1, 0, 0) } },
      vertexShader: `
        varying vec3 viewNormal;
        varying vec3 viewPosition;
        void main() {
          viewNormal = normalize(normalMatrix * normal);
          vec4 p = modelViewMatrix * vec4(position, 1.0);
          viewPosition = p.xyz;
          gl_Position = projectionMatrix * p;
        }
      `,
      fragmentShader: `
        uniform vec3 sunWorld;
        varying vec3 viewNormal;
        varying vec3 viewPosition;
        void main() {
          vec3 n = normalize(viewNormal);
          vec3 lightDirection = normalize((viewMatrix * vec4(sunWorld, 0.0)).xyz);
          float sunFacing = dot(n, lightDirection);
          float rim = pow(1.0 - max(0.0, dot(n, normalize(-viewPosition))), 3.0);
          float lit = smoothstep(-0.22, 0.45, sunFacing);
          vec3 tint = mix(vec3(0.12, 0.20, 0.42), vec3(0.12, 0.46, 1.0), lit);
          gl_FragColor = vec4(tint, rim * (0.035 + 0.5 * lit));
          #include <colorspace_fragment>
        }
      `,
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    }));
    this.atmosphere.scale.setScalar(1.027);
    this.load('day', new URL('../assets/earth-day-4096.jpg', import.meta.url).href, texture => {
      material.map = texture; material.color.set(0xffffff); material.needsUpdate = true;
    });
    this.load('night', new URL('../assets/earth-night-4096.jpg', import.meta.url).href, texture => {
      this.night.material.uniforms.nightMap.value = texture; this.nightReady = true;
      this.updateVisibility();
    });
  }

  private load(asset: VisualAsset, url: string, apply: (texture: THREE.Texture) => void): void {
    this.onStatus(asset, 'loading');
    const texture = new THREE.TextureLoader().load(url, loaded => {
      if (this.disposed) { loaded.dispose(); return; }
      loaded.colorSpace = THREE.SRGBColorSpace;
      apply(loaded); this.onStatus(asset, 'ready'); this.invalidate();
    }, undefined, () => {
      if (this.disposed) return;
      this.onStatus(asset, 'error'); this.invalidate();
    });
    // These are colour images, unlike scalar cloud/bump data. Three.js decodes to linear.
    texture.colorSpace = THREE.SRGBColorSpace;
    this.textures.push(texture);
  }
  setSun(world: THREE.Vector3, local: THREE.Vector3): void {
    this.atmosphere.material.uniforms.sunWorld.value.copy(world);
    this.night.material.uniforms.sunLocal.value.copy(local);
  }
  setVisibility(naturalLayer: boolean, lightsEnabled: boolean): void {
    this.naturalLayer = naturalLayer; this.lightsEnabled = lightsEnabled; this.updateVisibility();
  }
  private updateVisibility(): void {
    this.night.visible = this.naturalLayer && this.lightsEnabled && this.nightReady;
    // Scientific colours and their legends must not be tinted by decorative emission.
    this.atmosphere.visible = this.naturalLayer;
  }
  setAnisotropy(value: number): void {
    for (const texture of this.textures) {
      if (texture.anisotropy === value) continue;
      texture.anisotropy = value; texture.needsUpdate = true;
    }
  }
  dispose(): void {
    this.disposed = true;
    for (const texture of this.textures) texture.dispose();
    // Geometry/material ownership stays with EarthScene's traversal.
  }
}
