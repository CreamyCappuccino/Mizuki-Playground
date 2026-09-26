import * as THREE from 'three';
import type { GeographyTemperatureSource } from '../physics/geographyTemperatureSource';
import { isThermalReady, temperatureScale } from '../physics/temperatureModel';
import { sampleGeographyCell } from '../physics/geographySampling';

/** South-to-north rows, west-to-east columns. Only time is interpolated. */
export function geographyColorPixels(source: GeographyTemperatureSource, day: number): Uint8Array | null {
  if (!isThermalReady(source)) return null;
  const field = source.geography!, pixels = new Uint8Array(field.grid.size * 4);
  const scale = temperatureScale(source.model), color = new THREE.Color();
  for (let index = 0; index < field.grid.size; index++) {
    const t = THREE.MathUtils.clamp((sampleGeographyCell(field, index, day) - scale.min) / (scale.max - scale.min), 0, 1);
    color.setHSL(.65 - t * .65, .88, .24 + Math.sin(t * Math.PI) * .22, THREE.SRGBColorSpace);
    // Linear RGB: the shader performs the renderer's output-color conversion.
    pixels.set([Math.round(color.r * 255), Math.round(color.g * 255), Math.round(color.b * 255), 255], index * 4);
  }
  return pixels;
}

/** Fragment coordinates, not interpolated mesh colors or sphere UVs, select
 * the 10-degree cell. +Y is north, +X Greenwich, -Z east. At the exact pole
 * longitude is not unique; the selected-point readout keeps its cap sector.
 */
export class GeographyLayer {
  readonly texture = new THREE.DataTexture(new Uint8Array(36 * 18 * 4), 36, 18);
  readonly material: THREE.ShaderMaterial;
  readonly mesh: THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial>;
  private source: GeographyTemperatureSource | null = null;
  private day = NaN;
  constructor(geometry: THREE.SphereGeometry) {
    this.texture.minFilter = this.texture.magFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
    this.material = new THREE.ShaderMaterial({
      uniforms: { cells: { value: this.texture } }, transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec3 localPosition;
        void main() { localPosition = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform sampler2D cells; varying vec3 localPosition;
        void main() {
          vec3 p = normalize(localPosition);
          float latitude = degrees(asin(clamp(p.y, -1.0, 1.0)));
          float longitude = degrees(atan(-p.z, p.x));
          float column = floor(mod(longitude + 180.0, 360.0) / 10.0);
          float row = clamp(floor((latitude + 90.0) / 10.0), 0.0, 17.0);
          gl_FragColor = vec4(texture2D(cells, vec2((column + .5) / 36.0, (row + .5) / 18.0)).rgb, .78);
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.mesh.scale.setScalar(1.002); this.mesh.visible = false;
  }
  update(source: GeographyTemperatureSource | null, day: number, visible: boolean): void {
    this.mesh.visible = visible && source !== null && isThermalReady(source);
    if (!this.mesh.visible || !source) return;
    if (this.source?.geography === source.geography && this.day === day) return;
    const pixels = geographyColorPixels(source, day)!;
    (this.texture.image.data as Uint8Array).set(pixels);
    this.texture.needsUpdate = true; this.source = source; this.day = day;
  }
  dispose(): void { this.source = null; this.texture.dispose(); }
}
