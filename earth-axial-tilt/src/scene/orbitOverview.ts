import * as THREE from 'three';
import { orbitLayout, ORBIT_RADIUS, MODEL_SEASONS } from './orbitLayout';
import { t } from '../ui/i18n';

/** Static artistic Sun. No continuous animation, irradiance or climate inputs. */
function createSun(): THREE.Group {
  const group = new THREE.Group();
  const material = new THREE.ShaderMaterial({
    vertexShader: `varying vec3 spherePoint; varying vec3 vn; varying vec3 vp;
      void main() { spherePoint=normalize(position); vn=normalize(normalMatrix*normal);
        vec4 p=modelViewMatrix*vec4(position,1.0); vp=p.xyz; gl_Position=projectionMatrix*p; }`,
    fragmentShader: `varying vec3 spherePoint; varying vec3 vn; varying vec3 vp;
      void main() {
        vec3 p=spherePoint;
        float cells=sin(p.x*93.0+sin(p.y*24.0))*sin(p.y*85.0+sin(p.z*19.0))*sin(p.z*101.0+p.x*13.0);
        float bands=sin(p.x*17.0+p.y*13.0+sin(p.z*22.0))*0.5+0.5;
        float center=max(0.0,dot(normalize(vn),normalize(-vp)));
        vec3 c=mix(vec3(1.0,0.19,0.015),vec3(1.0,0.78,0.23),0.52+0.16*cells+0.25*bands);
        c*=0.65+0.55*pow(center,0.3);
        gl_FragColor=vec4(c,1.0);
        #include <colorspace_fragment>
      }`, toneMapped: false,
  });
  group.add(new THREE.Mesh(new THREE.SphereGeometry(2.0, 64, 48), material));
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(128,128,42,128,128,128);
  gradient.addColorStop(0, 'rgba(255,175,58,.65)'); gradient.addColorStop(.22, 'rgba(255,116,20,.28)');
  gradient.addColorStop(.55, 'rgba(255,78,9,.06)'); gradient.addColorStop(1, 'rgba(255,45,0,0)');
  ctx.fillStyle=gradient; ctx.fillRect(0,0,256,256);
  const texture=new THREE.CanvasTexture(canvas); texture.colorSpace=THREE.SRGBColorSpace;
  const glow=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false}));
  glow.scale.set(10,10,1); group.add(glow);
  return group;
}

export class OrbitOverview extends THREE.Group {
  private readonly labelTextures: THREE.CanvasTexture[] = [];
  private readonly labels: { key: string; canvas: HTMLCanvasElement; texture: THREE.CanvasTexture }[] = [];
  constructor() {
    super(); this.name = 'orbit-overview'; this.visible = false;
    this.add(createSun());
    const ring = Array.from({length:256},(_,i)=>new THREE.Vector3(Math.cos(i/256*Math.PI*2)*ORBIT_RADIUS,0,Math.sin(i/256*Math.PI*2)*ORBIT_RADIUS));
    this.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ring),new THREE.LineBasicMaterial({color:0x7995b4,transparent:true,opacity:.65})));
    for (const season of MODEL_SEASONS) {
      const v=new THREE.Vector3(...orbitLayout(season.day,23.44).position);
      const tick=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshBasicMaterial({color:0xbdcce6})); tick.position.copy(v); this.add(tick);
      const label=this.label(season.label); label.position.copy(v).multiplyScalar(1.18); label.position.y=-1.3; this.add(label);
    }
    const sunLabel=this.label('Sun'); sunLabel.position.set(0,3.5,0); this.add(sunLabel);
    // In this coordinate convention the model year traverses decreasing world-Y azimuth.
    const a = 0.6, position = new THREE.Vector3(Math.cos(a)*ORBIT_RADIUS,0,Math.sin(a)*ORBIT_RADIUS);
    this.add(new THREE.ArrowHelper(new THREE.Vector3(-Math.sin(a),0,Math.cos(a)),position,1.6,0x92bfe1,.65,.35));
  }
  private label(key: string): THREE.Sprite {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=112;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    this.labels.push({key,canvas,texture}); this.labelTextures.push(texture);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,transparent:true,toneMapped:false}));
    sprite.scale.set(5.2,1.14,1); this.refreshLabels(); return sprite;
  }
  refreshLabels(): void {
    for(const {key,canvas,texture} of this.labels){
      const ctx=canvas.getContext('2d')!; ctx.clearRect(0,0,512,112);
      ctx.font='500 40px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='#020610';ctx.shadowBlur=10;ctx.fillStyle='#e5efff';ctx.fillText(t(key),256,56);texture.needsUpdate=true;
    }
  }
  disposeLabels(): void { for(const texture of this.labelTextures)texture.dispose(); }
}
