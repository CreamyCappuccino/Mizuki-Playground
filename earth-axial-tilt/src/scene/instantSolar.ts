import * as THREE from 'three';

/** A per-fragment display of n · Sun. The direction comes from physics/diurnal. */
export function createInstantSolarLayer(geometry: THREE.SphereGeometry): THREE.Mesh<THREE.SphereGeometry, THREE.ShaderMaterial> {
  const colors = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    return new THREE.Color().setHSL(0.66 - t * 0.55, 0.88, 0.22 + t * 0.42, THREE.SRGBColorSpace);
  });
  const material = new THREE.ShaderMaterial({
    uniforms: { sunLocal: { value: new THREE.Vector3(1, 0, 0) }, ramp: { value: colors } },
    vertexShader: `
      varying vec3 surfaceNormal;
      void main() {
        surfaceNormal = normal;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 sunLocal;
      uniform vec3 ramp[9];
      varying vec3 surfaceNormal;
      void main() {
        float solar = max(0.0, dot(normalize(surfaceNormal), sunLocal));
        float position = clamp(solar, 0.0, 1.0) * 8.0;
        int index = min(int(floor(position)), 7);
        vec3 color = mix(ramp[index], ramp[index + 1], position - float(index));
        gl_FragColor = vec4(color, 0.86);
        #include <colorspace_fragment>
      }
    `,
    transparent: true, depthWrite: false, toneMapped: false,
  });
  const layer = new THREE.Mesh(geometry.clone(), material);
  layer.scale.setScalar(1.003);
  layer.visible = false;
  return layer;
}
