import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dailyMeanInsolation, dayLengthHours, SOLAR_CONSTANT } from '../physics/solar';
import { temperatureEstimateC } from '../physics/climate';
import type { LocationPreset } from '../data/locations';
import { geographicToCartesian, cartesianToGeographic, sunDirection } from '../physics/geometry';
import { rotatingSunDirection, wrapRotation } from '../physics/diurnal';
import { createInstantSolarLayer } from './instantSolar';

export type SurfaceMode = 'normal' | 'insolation' | 'daylight' | 'temperature' | 'instant';

interface SceneState {
  tilt: number;
  day: number;
  mode: SurfaceMode;
  location: LocationPreset;
  guides: boolean;
  rotation: number;
}

interface EarthSceneOptions {
  onLocationPick?: (location: LocationPreset) => void;
}

const EARTH_RADIUS = 2.15;
const EARTH_TEXTURE = 'https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg';

export class EarthScene {
  private readonly canvas: HTMLCanvasElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly controls: OrbitControls;
  private readonly earthGroup = new THREE.Group();
  private readonly earthMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshPhongMaterial>;
  private readonly dataMesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly instantMesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private readonly marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 3.4);
  private readonly sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdc7d }),
  );
  private readonly guidesGroup = new THREE.Group();
  private readonly subsolarMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffdc7d, toneMapped: false }),
  );
  private readonly terminator = new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(Array.from({ length: 180 }, (_, i) => {
      const a = i * Math.PI * 2 / 180;
      return new THREE.Vector3(Math.cos(a) * EARTH_RADIUS * 1.009, Math.sin(a) * EARTH_RADIUS * 1.009, 0);
    })),
    new THREE.LineBasicMaterial({ color: 0xcfddf0, transparent: true, opacity: 0.68 }),
  );
  private readonly tiltArc = new THREE.Line(
    new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(65 * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xba9aff, transparent: true, opacity: 0.8 }),
  );
  private readonly sunDirectionVector = new THREE.Vector3();
  private readonly ringNormal = new THREE.Vector3(0, 0, 1);
  private pointerStart: { id: number; x: number; y: number; moved: boolean } | null = null;
  private readonly activePointers = new Set<number>();
  private frameId = 0;
  private disposed = false;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly onLocationPick?: (location: LocationPreset) => void;

  private state: SceneState = {
    tilt: 23.44,
    day: 172,
    mode: 'normal',
    guides: true,
    rotation: 0,
    location: { id: 'taipei', name: 'Taipei', latitude: 25.033, longitude: 121.5654 },
  };

  constructor(canvas: HTMLCanvasElement, options: EarthSceneOptions = {}) {
    this.canvas = canvas;
    this.onLocationPick = options.onLocationPick;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.camera.position.set(0.4, 1.3, 8.2);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 5.1;
    this.controls.maxDistance = 12;

    this.scene.background = new THREE.Color(0x02040b);
    this.scene.add(this.createStars());

    const ambient = new THREE.HemisphereLight(0x7799cc, 0x070812, 0.22);
    this.scene.add(ambient);
    this.scene.add(this.sunLight);
    this.scene.add(this.sunMesh);
    this.scene.add(this.createOrbitRing());

    const earthGeometry = new THREE.SphereGeometry(EARTH_RADIUS, 96, 64);
    const earthMaterial = new THREE.MeshPhongMaterial({
      color: 0x24558f,
      shininess: 12,
      specular: 0x223344,
    });

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.earthGroup.add(this.earthMesh);

    const texture = new THREE.TextureLoader().load(
      EARTH_TEXTURE,
      (loaded) => {
        if (this.disposed) { loaded.dispose(); return; }
        loaded.colorSpace = THREE.SRGBColorSpace;
        earthMaterial.map = loaded;
        earthMaterial.color.set(0xffffff);
        earthMaterial.needsUpdate = true;
      },
      undefined,
      () => {
        // Scientific layers remain functional if the decorative texture cannot load.
      },
    );
    texture.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());

    const dataGeometry = earthGeometry.clone();
    const colors = new Float32Array(dataGeometry.attributes.position.count * 3);
    dataGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.dataMesh = new THREE.Mesh(
      dataGeometry,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        toneMapped: false,
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );
    this.dataMesh.scale.setScalar(1.002);
    this.dataMesh.visible = false;
    this.earthGroup.add(this.dataMesh);
    this.instantMesh = createInstantSolarLayer(earthGeometry);
    this.earthGroup.add(this.instantMesh);

    this.earthGroup.add(this.createAtmosphere());
    this.earthGroup.add(this.createLatitudeGrid());
    this.earthGroup.add(this.marker);
    this.scene.add(this.earthGroup);
    this.scene.add(this.guidesGroup);
    this.guidesGroup.add(this.subsolarMarker, this.terminator, this.tiltArc);
    this.createAxis();

    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointercancel', this.handlePointerCancel);
    canvas.addEventListener('pointerup', this.handlePointer);
    window.addEventListener('resize', this.resize);

    this.setState(this.state);
    this.resize();
    this.animate();
  }

  setState(next: Partial<SceneState>): void {
    const previous = this.state;
    this.state = { ...this.state, ...next };
    this.state.rotation = wrapRotation(this.state.rotation);
    // Intrinsic XYZ yields Rx(tilt) * Ry(spin): spin around the tilted LOCAL axis,
    // never the orbit-plane normal. All geographic children share this frame.
    this.earthGroup.rotation.set(THREE.MathUtils.degToRad(this.state.tilt),
      THREE.MathUtils.degToRad(this.state.rotation), 0, 'XYZ');
    const seasonChanged = previous.day !== this.state.day || previous.tilt !== this.state.tilt;
    const rotationChanged = previous.rotation !== this.state.rotation;
    if (seasonChanged || next.day !== undefined) {
      this.sunDirectionVector.fromArray(sunDirection(this.state.day));
      this.sunLight.position.copy(this.sunDirectionVector).multiplyScalar(10);
      this.sunMesh.position.copy(this.sunDirectionVector).multiplyScalar(7.2);
      this.subsolarMarker.position.copy(this.sunDirectionVector).multiplyScalar(EARTH_RADIUS * 1.027);
      this.terminator.quaternion.setFromUnitVectors(this.ringNormal, this.sunDirectionVector);
    }
    this.guidesGroup.visible = this.state.guides;
    if (previous.tilt !== this.state.tilt || next.tilt !== undefined) this.updateAxis();
    if (next.location !== undefined) this.updateMarker();
    this.instantMesh.visible = this.state.mode === 'instant';
    if (seasonChanged || rotationChanged || next.mode !== undefined) {
      this.instantMesh.material.uniforms.sunLocal.value.fromArray(
        rotatingSunDirection(this.state.day, this.state.tilt, this.state.rotation),
      );
    }
    // Daily-mean maps do not depend on rotational phase. No CPU recoloring on spin.
    if (seasonChanged || next.mode !== undefined) this.updateDataLayer();
    // Current world matrices are also needed for picking before the next frame.
    this.earthGroup.updateMatrixWorld(true);
  }

  focusLocation(): void {
    // Move only the observer, not the time or geographic location.
    const position = this.earthGroup.localToWorld(new THREE.Vector3(...geographicToCartesian(
      this.state.location.latitude, this.state.location.longitude,
    ))).normalize();
    this.camera.position.copy(position).multiplyScalar(8.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  resetView(): void {
    this.camera.position.set(0.4, 1.3, 8.2);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.controls.dispose();
    this.canvas.removeEventListener('pointerdown', this.handlePointerDown);
    this.canvas.removeEventListener('pointermove', this.handlePointerMove);
    this.canvas.removeEventListener('pointercancel', this.handlePointerCancel);
    this.canvas.removeEventListener('pointerup', this.handlePointer);
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const materials = mesh.material ? (Array.isArray(mesh.material) ? mesh.material : [mesh.material]) : [];
      for (const material of materials) {
        (material as THREE.MeshBasicMaterial).map?.dispose();
        material.dispose();
      }
    });
    this.renderer.dispose();
  }

  private readonly resize = (): void => {
    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  };

  private readonly animate = (): void => {
    if (this.disposed) return;
    if (!document.hidden) {
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
    this.frameId = requestAnimationFrame(this.animate);
  };

  private createStars(): THREE.Points {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    let seed = 20260924;
    const random = () => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < count; i += 1) {
      const radius = 30 + random() * 25;
      const theta = random() * Math.PI * 2;
      const z = random() * 2 - 1;
      const planar = Math.sqrt(1 - z * z);
      positions[i * 3] = radius * planar * Math.cos(theta);
      positions[i * 3 + 1] = radius * z;
      positions[i * 3 + 2] = radius * planar * Math.sin(theta);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ color: 0xcbdcff, size: 0.035, sizeAttenuation: true }),
    );
  }

  private createOrbitRing(): THREE.LineLoop {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i < 180; i += 1) {
      const angle = (i / 180) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * 4.7, 0, Math.sin(angle) * 4.7));
    }
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return new THREE.LineLoop(
      geometry,
      new THREE.LineBasicMaterial({ color: 0x345071, transparent: true, opacity: 0.34 }),
    );
  }

  private createAtmosphere(): THREE.Mesh {
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
          vViewPosition = viewPosition.xyz;
          gl_Position = projectionMatrix * viewPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vViewPosition;
        void main() {
          vec3 viewDir = normalize(-vViewPosition);
          float rim = pow(1.0 - max(dot(normalize(vNormal), viewDir), 0.0), 2.6);
          gl_FragColor = vec4(0.22, 0.62, 1.0, rim * 0.34);
        }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    });

    return new THREE.Mesh(new THREE.SphereGeometry(EARTH_RADIUS * 1.035, 96, 64), material);
  }

  private createLatitudeGrid(): THREE.Group {
    const group = new THREE.Group();
    const material = new THREE.LineBasicMaterial({
      color: 0x8eb8dc,
      transparent: true,
      opacity: 0.14,
    });

    for (const latitude of [-60, -30, 0, 30, 60]) {
      const lat = THREE.MathUtils.degToRad(latitude);
      const radius = EARTH_RADIUS * Math.cos(lat) * 1.006;
      const y = EARTH_RADIUS * Math.sin(lat) * 1.006;
      const points: THREE.Vector3[] = [];
      for (let i = 0; i < 120; i += 1) {
        const angle = (i / 120) * Math.PI * 2;
        points.push(new THREE.Vector3(radius * Math.sin(angle), y, radius * Math.cos(angle)));
      }
      group.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), material));
    }

    return group;
  }

  private createAxis(): void {
    const axisGroup = new THREE.Group();
    axisGroup.name = 'axis-indicator';
    const material = new THREE.LineBasicMaterial({
      color: 0x66d8ff,
      transparent: true,
      opacity: 0.8,
    });
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, -3.05, 0),
      new THREE.Vector3(0, 3.05, 0),
    ]);
    axisGroup.add(new THREE.Line(geometry, material));

    const north = new THREE.Mesh(
      new THREE.ConeGeometry(0.065, 0.22, 16),
      new THREE.MeshBasicMaterial({ color: 0xa7ecff }),
    );
    north.position.y = 3.15;
    axisGroup.add(north);
    axisGroup.add(this.createPoleLabel('N', 3.42), this.createPoleLabel('S', -3.30));
    this.guidesGroup.add(axisGroup);
    const reference = new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, EARTH_RADIUS * 1.02, 0), new THREE.Vector3(0, 3.35, 0),
    ]), new THREE.LineBasicMaterial({ color: 0xba9aff, transparent: true, opacity: 0.3 }));
    this.guidesGroup.add(reference);
  }

  private createPoleLabel(text: string, y: number): THREE.Sprite {
    const label = document.createElement('canvas');
    label.width = label.height = 64;
    const context = label.getContext('2d');
    if (context) {
      context.font = 'bold 40px sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle';
      context.fillStyle = '#a7ecff'; context.fillText(text, 32, 32);
    }
    const texture = new THREE.CanvasTexture(label);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }));
    sprite.scale.setScalar(0.28); sprite.position.y = y;
    return sprite;
  }

  private updateAxis(): void {
    const axis = this.scene.getObjectByName('axis-indicator');
    if (axis) axis.rotation.x = THREE.MathUtils.degToRad(this.state.tilt);
    const positions = this.tiltArc.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i <= 64; i += 1) {
      const angle = THREE.MathUtils.degToRad(this.state.tilt) * i / 64;
      positions.setXYZ(i, 0, 2.78 * Math.cos(angle), 2.78 * Math.sin(angle));
    }
    positions.needsUpdate = true;
    this.tiltArc.geometry.computeBoundingSphere();
    this.tiltArc.visible = this.state.tilt > 0;
  }

  private updateMarker(): void {
    this.marker.position.fromArray(geographicToCartesian(
      this.state.location.latitude, this.state.location.longitude, EARTH_RADIUS * 1.025,
    ));
  }

  private updateDataLayer(): void {
    this.dataMesh.visible = this.state.mode !== 'normal' && this.state.mode !== 'instant';
    if (!this.dataMesh.visible) return;

    const positions = this.dataMesh.geometry.attributes.position;
    const colors = this.dataMesh.geometry.attributes.color as THREE.BufferAttribute;
    const color = new THREE.Color();
    const rowColors = new Map<number, THREE.Color>();

    for (let i = 0; i < positions.count; i += 1) {
      const y = positions.getY(i) / EARTH_RADIUS;
      const latitude = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(y, -1, 1)));
      const cached = rowColors.get(latitude);
      if (cached) { colors.setXYZ(i, cached.r, cached.g, cached.b); continue; }
      let t = 0;

      if (this.state.mode === 'insolation') {
        t = THREE.MathUtils.clamp(
          dailyMeanInsolation(latitude, this.state.day, this.state.tilt) / SOLAR_CONSTANT,
          0,
          1,
        );
        color.setHSL(0.66 - t * 0.55, 0.88, 0.22 + t * 0.42, THREE.SRGBColorSpace);
      } else if (this.state.mode === 'daylight') {
        t = dayLengthHours(latitude, this.state.day, this.state.tilt) / 24;
        color.setHSL(0.68 - t * 0.53, 0.82, 0.2 + t * 0.48, THREE.SRGBColorSpace);
      } else {
        const temperature = temperatureEstimateC(latitude, this.state.day, this.state.tilt);
        t = THREE.MathUtils.clamp((temperature + 65) / 120, 0, 1);
        color.setHSL(0.65 - t * 0.65, 0.88, 0.24 + Math.sin(t * Math.PI) * 0.22, THREE.SRGBColorSpace);
      }

      rowColors.set(latitude, color.clone());
      colors.setXYZ(i, color.r, color.g, color.b);
    }

    colors.needsUpdate = true;
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.activePointers.add(event.pointerId);
    if (this.activePointers.size !== 1 || event.button !== 0) { this.pointerStart = null; return; }
    this.pointerStart = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    const start = this.pointerStart;
    if (start && start.id === event.pointerId && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) start.moved = true;
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    this.activePointers.delete(event.pointerId); this.pointerStart = null;
  };

  private readonly handlePointer = (event: PointerEvent): void => {
    const start = this.pointerStart;
    this.activePointers.delete(event.pointerId);
    this.pointerStart = null;
    if (!start || start.id !== event.pointerId || start.moved || this.activePointers.size > 0
      || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    // Camera controls can change orientation before the next animation frame.
    this.camera.updateMatrixWorld(true);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObject(this.earthMesh, false)[0];
    if (!hit) return;

    const local = this.earthGroup.worldToLocal(hit.point.clone()).normalize();
    const { latitude, longitude } = cartesianToGeographic([local.x, local.y, local.z]);
    this.onLocationPick?.({
      id: 'custom',
      name: 'Custom point',
      latitude,
      longitude,
    });
  };
}
