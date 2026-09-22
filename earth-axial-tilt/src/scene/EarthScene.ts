import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { dailyMeanInsolation, dayLengthHours, orbitalLongitudeRad } from '../physics/solar';
import { temperatureEstimateC } from '../physics/climate';
import type { LocationPreset } from '../data/locations';

export type SurfaceMode = 'normal' | 'insolation' | 'daylight' | 'temperature';

interface SceneState {
  tilt: number;
  day: number;
  mode: SurfaceMode;
  location: LocationPreset;
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
  private readonly marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 18),
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  private readonly sunLight = new THREE.DirectionalLight(0xffffff, 3.4);
  private readonly sunMesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.4, 32, 32),
    new THREE.MeshBasicMaterial({ color: 0xffdc7d }),
  );
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly onLocationPick?: (location: LocationPreset) => void;

  private state: SceneState = {
    tilt: 23.44,
    day: 172,
    mode: 'normal',
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
        transparent: true,
        opacity: 0.78,
        depthWrite: false,
      }),
    );
    this.dataMesh.scale.setScalar(1.002);
    this.dataMesh.visible = false;
    this.earthGroup.add(this.dataMesh);

    this.earthGroup.add(this.createAtmosphere());
    this.earthGroup.add(this.createLatitudeGrid());
    this.earthGroup.add(this.marker);
    this.scene.add(this.earthGroup);
    this.createAxis();

    canvas.addEventListener('pointerup', this.handlePointer);
    window.addEventListener('resize', this.resize);

    this.setState(this.state);
    this.resize();
    this.animate();
  }

  setState(next: Partial<SceneState>): void {
    this.state = { ...this.state, ...next };
    this.earthGroup.rotation.x = THREE.MathUtils.degToRad(this.state.tilt);

    const lambda = orbitalLongitudeRad(this.state.day);
    const sunDirection = new THREE.Vector3(Math.cos(lambda), 0, Math.sin(lambda)).normalize();
    this.sunLight.position.copy(sunDirection).multiplyScalar(10);
    this.sunMesh.position.copy(sunDirection).multiplyScalar(7.2);

    this.updateAxis();
    this.updateMarker();
    this.updateDataLayer();
  }

  dispose(): void {
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerup', this.handlePointer);
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
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  };

  private createStars(): THREE.Points {
    const count = 1800;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i += 1) {
      const radius = 30 + Math.random() * 25;
      const theta = Math.random() * Math.PI * 2;
      const z = Math.random() * 2 - 1;
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
        varying vec3 vWorldPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPosition);
          float rim = pow(1.0 - max(dot(vNormal, viewDir), 0.0), 2.6);
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
    this.scene.add(axisGroup);
  }

  private updateAxis(): void {
    const axis = this.scene.getObjectByName('axis-indicator');
    if (axis) axis.rotation.x = THREE.MathUtils.degToRad(this.state.tilt);
  }

  private updateMarker(): void {
    const lat = THREE.MathUtils.degToRad(this.state.location.latitude);
    const lon = THREE.MathUtils.degToRad(this.state.location.longitude);
    const r = EARTH_RADIUS * 1.025;
    this.marker.position.set(
      r * Math.cos(lat) * Math.sin(lon),
      r * Math.sin(lat),
      r * Math.cos(lat) * Math.cos(lon),
    );
  }

  private updateDataLayer(): void {
    this.dataMesh.visible = this.state.mode !== 'normal';
    if (!this.dataMesh.visible) return;

    const positions = this.dataMesh.geometry.attributes.position;
    const colors = this.dataMesh.geometry.attributes.color as THREE.BufferAttribute;
    const color = new THREE.Color();

    for (let i = 0; i < positions.count; i += 1) {
      const y = positions.getY(i) / EARTH_RADIUS;
      const latitude = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(y, -1, 1)));
      let t = 0;

      if (this.state.mode === 'insolation') {
        t = THREE.MathUtils.clamp(
          dailyMeanInsolation(latitude, this.state.day, this.state.tilt) / 650,
          0,
          1,
        );
        color.setHSL(0.66 - t * 0.55, 0.88, 0.22 + t * 0.42);
      } else if (this.state.mode === 'daylight') {
        t = dayLengthHours(latitude, this.state.day, this.state.tilt) / 24;
        color.setHSL(0.68 - t * 0.53, 0.82, 0.2 + t * 0.48);
      } else {
        const temperature = temperatureEstimateC(latitude, this.state.day, this.state.tilt);
        t = THREE.MathUtils.clamp((temperature + 45) / 90, 0, 1);
        color.setHSL(0.65 - t * 0.65, 0.88, 0.24 + Math.sin(t * Math.PI) * 0.22);
      }

      colors.setXYZ(i, color.r, color.g, color.b);
    }

    colors.needsUpdate = true;
  }

  private readonly handlePointer = (event: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObject(this.earthMesh, false)[0];
    if (!hit) return;

    const local = this.earthGroup.worldToLocal(hit.point.clone()).normalize();
    const latitude = THREE.MathUtils.radToDeg(Math.asin(local.y));
    const longitude = THREE.MathUtils.radToDeg(Math.atan2(local.x, local.z));
    this.onLocationPick?.({
      id: 'custom',
      name: 'Custom point',
      latitude,
      longitude,
    });
  };
}
