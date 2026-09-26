import { compareMeasurements } from '../physics/comparison';
import { isThermalReady, type TemperatureSource } from '../physics/temperatureModel';
import type { ThermalSolution } from '../physics/energyBalance';
import type { SceneState } from '../scene/EarthScene';
import { ThermalClient } from './thermalClient';
import { parseTiltInput } from './tiltInput';
import { t, msg, onLanguageChange } from './i18n';
import { formatModelDate } from './chart';
import type { Playback } from './playback';
import { CLASSIC_ORBIT, MAX_EDUCATIONAL_ECCENTRICITY, orbitKey, type OrbitParameters } from '../physics/orbit';

export interface CompareSnapshot {
  source: TemperatureSource; latitude: number; longitude: number; locationName: string;
  day: number; rotation: number; mode: SceneState['mode']; playback: Playback;
}
interface CompareActions {
  change: () => void;
  tiltA: (tilt: number) => void;
  orbitA: (orbit: OrbitParameters) => void;
  day: (day: number) => void;
  mode: (mode: SceneState['mode']) => void;
  playback: (mode: Exclude<Playback,'paused'>) => void;
  scene: (state: {tilt:number;thermal:ThermalSolution|null;orbit:OrbitParameters}|null) => void;
}
/** A/B may differ in obliquity and orbit. Clock/location/model/depth/camera remain shared. */
export class CompareLab {
  enabled = false;
  tiltB = 90;
  orbitB: OrbitParameters={...CLASSIC_ORBIT};
  revision = 0;
  private snapshot: CompareSnapshot | null = null;
  private solution: ThermalSolution | null = null;
  private key = '';
  private error = '';
  private readonly events = new AbortController();
  private readonly observer: ResizeObserver;
  private readonly unsubscribe: () => void;
  private readonly worker: ThermalClient;
  private readonly el = <T extends HTMLElement = HTMLElement>(id: string): T => document.getElementById(id) as T;
  constructor(private readonly actions: CompareActions) {
    this.worker = new ThermalClient(
      () => new Worker(new URL('../physics/climate.worker.ts',import.meta.url),{type:'module'}),
      reply => {
        if ('error' in reply) { this.solution = null; this.error = reply.error; }
        else { this.solution = reply.current; this.error = ''; }
        this.revision++; this.actions.change();
      });
    const on = (id:string, event:string, callback:()=>void) => this.el(id).addEventListener(event,callback,{signal:this.events.signal});
    const commit = (side:'A'|'B') => {
      const input = this.el<HTMLInputElement>(side==='A'?'compare-tilt-a':'compare-tilt-b');
      const angle = parseTiltInput(input.value);
      if (angle === null) { input.value=String(side==='A'?this.snapshot?.source.tilt??23.44:this.tiltB); this.el('compare-input-status').textContent=t('Enter 0–90°. The previous angle was kept.'); return; }
      this.el('compare-input-status').textContent='';
      if(side==='A') this.actions.tiltA(angle); else { this.tiltB=angle; this.actions.change(); }
    };
    for(const side of ['A','B'] as const) {
      const id=side==='A'?'compare-tilt-a':'compare-tilt-b';
      on(id,'change',()=>commit(side));
      this.el(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit(side);}}, {signal:this.events.signal});
    }
    const commitOrbit = (side:'A'|'B') => {
      const prefix=side==='A'?'compare-a':'compare-b';
      const orbit={eccentricity:Number(this.el<HTMLInputElement>(`${prefix}-eccentricity`).value),
        perihelionLongitude:Number(this.el<HTMLInputElement>(`${prefix}-perihelion`).value),
        axisLongitude:Number(this.el<HTMLInputElement>(`${prefix}-axis`).value)};
      if(!Number.isFinite(orbit.eccentricity)||orbit.eccentricity<0||orbit.eccentricity>MAX_EDUCATIONAL_ECCENTRICITY||
        !Number.isFinite(orbit.perihelionLongitude)||orbit.perihelionLongitude<0||orbit.perihelionLongitude>=360||
        !Number.isFinite(orbit.axisLongitude)||orbit.axisLongitude<0||orbit.axisLongitude>=360){
        this.el('compare-input-status').textContent=t('Enter valid orbit values. Previous settings were kept.');
        if(this.snapshot)this.update(this.snapshot);return;
      }
      this.el('compare-input-status').textContent='';
      if(side==='A')this.actions.orbitA(orbit);else{this.orbitB=orbit;this.actions.change();}
    };
    for(const side of ['A','B'] as const)for(const field of ['eccentricity','perihelion','axis']){
      const id=`compare-${side.toLowerCase()}-${field}`;on(id,'change',()=>commitOrbit(side));
      this.el(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commitOrbit(side);}}, {signal:this.events.signal});
    }
    on('compare-preset','change',()=>{
      const preset=this.el<HTMLSelectElement>('compare-preset').value;
      if(preset==='custom')return;
      if(['0','45','90'].includes(preset)){this.tiltB=Number(preset);this.actions.tiltA(23.44);return;}
      this.tiltB=23.44;
      if(preset==='eccentricity'){
        this.actions.orbitA({...CLASSIC_ORBIT});this.orbitB={eccentricity:.3,perihelionLongitude:0,axisLongitude:0};
      }else if(preset==='axis'){
        this.actions.orbitA({eccentricity:.2,perihelionLongitude:0,axisLongitude:0});this.orbitB={eccentricity:.2,perihelionLongitude:0,axisLongitude:180};
      }else{
        this.actions.orbitA({eccentricity:.2,perihelionLongitude:90,axisLongitude:0});this.orbitB={eccentricity:.2,perihelionLongitude:270,axisLongitude:0};
      }
      this.actions.change();
    });
    on('compare-exit','click',()=>this.toggle());
    on('compare-day','input',()=>this.actions.day(Number(this.el<HTMLInputElement>('compare-day').value)));
    on('compare-layer','change',()=>this.actions.mode(this.el<HTMLSelectElement>('compare-layer').value as SceneState['mode']));
    for(const mode of ['year','day','coupled'] as const) on(`compare-play-${mode}`,'click',()=>this.actions.playback(mode));
    on('compare-retry','click',()=>{this.key='';this.actions.change();});
    this.observer=new ResizeObserver(()=>this.placeLabels());
    this.observer.observe(this.el('earth-canvas')); this.observer.observe(this.el('compare-controls'));
    this.observer.observe(document.querySelector('.topbar')!);
    this.unsubscribe=onLanguageChange(()=>{if(this.snapshot)this.update(this.snapshot);});
  }
  get failed(): boolean { return !!this.error && !isThermalReady(this.sourceB); }
  get sourceB(): TemperatureSource {
    const a=this.snapshot!.source;
    const same=this.tiltB===a.tilt&&orbitKey(this.orbitB)===orbitKey(a.orbit??CLASSIC_ORBIT);
    return {...a,tilt:this.tiltB,orbit:this.orbitB,solution:same?a.solution:this.solution};
  }
  /** Import validated settings without invoking synthetic clicks or moving keyboard focus. */
  configure(enabled: boolean, tiltB: number, orbitB: OrbitParameters=this.orbitB): void {
    this.tiltB=tiltB;this.orbitB={...orbitB};this.enabled=enabled;
    document.documentElement.dataset.comparison=String(enabled);
    this.el('compare-controls').hidden=!enabled;
    this.el('compare-results').hidden=!enabled;
    this.el('comparison-labels').hidden=!enabled;
    if(!enabled){this.worker.cancel();this.solution=null;this.key='';this.error='';this.actions.scene(null);}
  }
  toggle(): void {
    if(!this.enabled && this.el('focus-view').getAttribute('aria-pressed')==='true') this.el('focus-view').click();
    this.configure(!this.enabled,this.tiltB);
    this.actions.change();
    this.el('compare-toggle').focus({preventScroll:true});
  }
  update(snapshot: CompareSnapshot): void {
    this.snapshot=snapshot;
    this.el('compare-toggle').textContent=t(this.enabled?'Single Earth':'Compare Earth A/B');
    this.el('compare-toggle').setAttribute('aria-pressed',String(this.enabled));
    if(!this.enabled)return;
    const sourceOrbit=snapshot.source.orbit??CLASSIC_ORBIT;
    const same=this.tiltB===snapshot.source.tilt&&orbitKey(this.orbitB)===orbitKey(sourceOrbit);
    const key=snapshot.source.model==='energy-balance'&&!same?`${this.tiltB}:${snapshot.source.depth}:${orbitKey(this.orbitB)}`:'none';
    if(key!==this.key){
      this.key=key;this.solution=null;this.error='';this.revision++;
      this.worker.cancel();
      if(key!=='none')this.worker.request(this.tiltB,snapshot.source.depth,false,this.orbitB);
    }
    const b=this.sourceB;
    this.actions.scene({tilt:b.tilt,thermal:b.solution,orbit:this.orbitB});
    const aInput=this.el<HTMLInputElement>('compare-tilt-a'),bInput=this.el<HTMLInputElement>('compare-tilt-b');
    if(document.activeElement!==aInput)aInput.value=String(snapshot.source.tilt);
    if(document.activeElement!==bInput)bInput.value=String(this.tiltB);
    const setOrbitInputs=(prefix:string,orbit:OrbitParameters)=>{
      const values={eccentricity:orbit.eccentricity,perihelion:orbit.perihelionLongitude,axis:orbit.axisLongitude};
      for(const [field,value] of Object.entries(values)){const input=this.el<HTMLInputElement>(`${prefix}-${field}`);if(document.activeElement!==input)input.value=String(value);}
    };
    setOrbitInputs('compare-a',sourceOrbit);setOrbitInputs('compare-b',this.orbitB);
    if(document.activeElement!==this.el('compare-preset'))this.el<HTMLSelectElement>('compare-preset').value='custom';
    this.el<HTMLSelectElement>('compare-layer').value=snapshot.mode;
    this.el<HTMLInputElement>('compare-day').value=String(Math.min(365,Math.floor(snapshot.day)));
    this.el('compare-date').textContent=formatModelDate(snapshot.day);
    for(const mode of ['year','day','coupled'] as const){
      const button=this.el(`compare-play-${mode}`); const active=snapshot.playback===mode;
      button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);
      const label=t(active?'Pause':mode==='year'?'Play year':mode==='day'?'Play day':'Coupled motion');
      if(button.textContent!==label)button.textContent=label;
    }
    this.el('comparison-label-a').textContent=`A · ${snapshot.source.tilt}° · e ${sourceOrbit.eccentricity}`;
    this.el('comparison-label-b').textContent=`B · ${this.tiltB}° · e ${this.orbitB.eccentricity}`;
    this.el('compare-context').textContent=msg`Same model phase, location, rotation, model and heat storage. Tilt and orbit may differ. ${t(snapshot.locationName)} · ${snapshot.latitude.toFixed(2)}° / ${snapshot.longitude.toFixed(2)}°`;
    this.el('compare-model').textContent=snapshot.source.model==='energy-balance'
      ?msg`Thermal EBM · ${snapshot.source.depth} m heat storage`:t('Illustrative model');
    for(const row of compareMeasurements(snapshot.source,b,snapshot.latitude,snapshot.day)){
      const unit=row.key==='daylight'?t('h'):row.key==='solar'?'W/m²':'°C';
      const cells=this.el(`compare-${row.key}`);
      for(const [column,value] of [['a',row.a],['b',row.b],['diff',row.difference]] as const){
        const cell=cells.querySelector<HTMLElement>(`[data-column="${column}"]`)!;
        cell.dataset.value=value===null?'pending':String(value);
        const n=value===null?null:Math.abs(value)<0.05?0:value;
        cell.textContent=n===null?'—':`${column==='diff'&&n>0?'+':''}${n.toFixed(1)} ${unit}`;
      }
    }
    const status=this.el('compare-status');
    const failed=!!this.error && !isThermalReady(b);
    status.dataset.status=failed?'error':isThermalReady(snapshot.source)&&isThermalReady(b)?'ready':'loading';
    status.textContent=t(failed?'Earth B temperature unavailable. Solar and daylight still work.':status.dataset.status==='ready'?'A/B results ready. Difference = A minus B.':'Calculating A/B temperatures… no previous result is substituted.');
    this.el('compare-retry').hidden=!failed;
    const extrapolated=[snapshot.source,b].some(source=>source.model==='energy-balance' && isThermalReady(source) && source.solution!==null && (source.solution.minimum < -60 || source.solution.maximum > 60));
    const warning=this.el('compare-warning');warning.hidden=!extrapolated;
    warning.textContent=extrapolated?t('Large model extrapolation: linear radiation and fixed reflectivity omit ice, evaporation and climate feedbacks. Extreme temperatures are not predictions.'):'';
    this.placeLabels();
  }
  private placeLabels():void{
    if(!this.enabled)return;
    const canvas=this.el('earth-canvas'),box=canvas.getBoundingClientRect();
    const labels=this.el('comparison-labels');
    labels.style.left=`${canvas.offsetLeft}px`;labels.style.top=`${canvas.offsetTop}px`;
    labels.style.width=`${box.width}px`;labels.style.height=`${box.height}px`;
  }
  dispose():void{this.worker.dispose();this.observer.disconnect();this.unsubscribe();this.events.abort();}
}
