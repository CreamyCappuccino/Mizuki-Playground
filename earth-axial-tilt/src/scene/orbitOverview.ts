import { CLASSIC_ORBIT, orbitKey, dayAtSeasonalLongitude, normalizeOrbit, type OrbitParameters } from '../physics/orbit';
import * as THREE from 'three';
import { orbitLayout, ORBIT_RADIUS } from './orbitLayout';
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
  private readonly path = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position',
    new THREE.BufferAttribute(new Float32Array(256*3),3)), new THREE.LineBasicMaterial({color:0x7995b4,transparent:true,opacity:.65}));
  private readonly seasons: {tick:THREE.Object3D;label:THREE.Object3D}[]=[];
  private readonly apsides: {tick:THREE.Object3D;label:THREE.Object3D}[]=[];
  private readonly direction = new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(ORBIT_RADIUS,0,0),1.6,0x92bfe1,.65,.35);
  private readonly paths = new Map<string,Float32Array>();
  private currentKey='';
  constructor() {
    super(); this.name = 'orbit-overview'; this.visible = false;
    this.add(createSun(),this.path,this.direction);
    for (const key of ['Northern spring','Northern summer','Northern autumn','Northern winter']) {
      const tick=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshBasicMaterial({color:0xbdcce6}));
      const label=this.label(key);this.add(tick,label);this.seasons.push({tick,label});
    }
    for (const key of ['Perihelion','Aphelion']) {
      const tick=new THREE.Mesh(new THREE.OctahedronGeometry(.2),new THREE.MeshBasicMaterial({color:0xffc275}));
      const label=this.label(key);this.add(tick,label);this.apsides.push({tick,label});
    }
    const sunLabel=this.label('Sun');sunLabel.position.set(0,3.5,0);this.add(sunLabel);
    this.setOrbit(CLASSIC_ORBIT);
  }
  setOrbit(value:OrbitParameters=CLASSIC_ORBIT):void {
    const orbit=normalizeOrbit(value),key=orbitKey(orbit);if(key===this.currentKey)return;this.currentKey=key;
    let points=this.paths.get(key);
    if(!points){
      points=new Float32Array(256*3);
      for(let i=0;i<256;i++)points.set(orbitLayout(80+i*365/256,23.44,orbit).position,i*3);
      if(this.paths.size>=8)this.paths.delete(this.paths.keys().next().value!);
      this.paths.set(key,points);
    }
    const attribute=this.path.geometry.attributes.position as THREE.BufferAttribute;
    (attribute.array as Float32Array).set(points);attribute.needsUpdate=true;this.path.geometry.computeBoundingSphere();
    this.seasons.forEach(({tick,label},i)=>{
      const v=new THREE.Vector3(...orbitLayout(dayAtSeasonalLongitude(i*90,orbit),23.44,orbit).position);
      tick.position.copy(v);label.position.copy(v).multiplyScalar(1.18);label.position.y=-1.3;
    });
    this.apsides.forEach(({tick,label},i)=>{
      tick.visible=label.visible=orbit.eccentricity>0;
      const v=new THREE.Vector3(...orbitLayout(dayAtSeasonalLongitude(orbit.perihelion-orbit.axis+i*180,orbit),23.44,orbit).position);
      tick.position.copy(v);label.position.copy(v).multiplyScalar(1.1);label.position.y=1.5;
    });
    const day=dayAtSeasonalLongitude(215,orbit),v=new THREE.Vector3(...orbitLayout(day,23.44,orbit).position);
    this.direction.position.copy(v);this.direction.setDirection(new THREE.Vector3(...orbitLayout(day+.05,23.44,orbit).position).sub(v).normalize());
  }
  private label(key: string): THREE.Sprite {
    const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=112;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
    this.labels.push({key,canvas,texture}); this.labelTextures.push(texture);
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,depthWrite:false,depthTest:false,transparent:true,toneMapped:false,sizeAttenuation:false}));
    // Keep the actual glyph height readable in CSS pixels, including each A/B viewport.
    // Canvas glyphs are 40px high in a 112px texture; camera zoom must not shrink them.
    const viewport=new THREE.Vector4();
    sprite.frustumCulled=false;
    sprite.onBeforeRender=(renderer,_scene,camera)=>{
      renderer.getViewport(viewport);
      const fontPixels=document.documentElement.dataset.textSize==='large'?20:17;
      const height=fontPixels*(112/40)*2/(Math.max(1,viewport.w)*camera.projectionMatrix.elements[5]);
      sprite.scale.set(height*(512/112),height,1);sprite.updateMatrixWorld(true);
      if(renderer.domElement.dataset.orbitLabelFont!==String(fontPixels))renderer.domElement.dataset.orbitLabelFont=String(fontPixels);
    };
    this.refreshLabels(); return sprite;
  }
  refreshLabels(): void {
    for(const {key,canvas,texture} of this.labels){
      const ctx=canvas.getContext('2d')!; ctx.clearRect(0,0,512,112);
      ctx.font='500 40px system-ui, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.shadowColor='#020610';ctx.shadowBlur=10;ctx.fillStyle='#e5efff';ctx.fillText(t(key),256,56);texture.needsUpdate=true;
    }
  }
  disposeLabels(): void { this.paths.clear();for(const texture of this.labelTextures)texture.dispose(); }
}
