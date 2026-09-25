import { compareMeasurements } from '../physics/comparison';
import { isThermalReady, type TemperatureSource } from '../physics/temperatureModel';
import type { ThermalSolution } from '../physics/energyBalance';
import type { SceneState } from '../scene/EarthScene';
import { ThermalClient } from './thermalClient';
import { parseTiltInput } from './tiltInput';
import { t, msg, onLanguageChange } from './i18n';
import { formatModelDate } from './chart';
import type { Playback } from './playback';

export interface CompareSnapshot {
  source: TemperatureSource; latitude: number; longitude: number; locationName: string;
  day: number; rotation: number; mode: SceneState['mode']; playback: Playback;
}
interface CompareActions {
  change: () => void;
  tiltA: (tilt: number) => void;
  day: (day: number) => void;
  mode: (mode: SceneState['mode']) => void;
  playback: (mode: Exclude<Playback,'paused'>) => void;
  scene: (state: {tilt:number;thermal:ThermalSolution|null}|null) => void;
}
/** A/B differ only in tilt. One shared clock/location/model/depth/camera is intentional. */
export class CompareLab {
  enabled = false;
  tiltB = 90;
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
    on('compare-preset','change',()=>{
      const preset=this.el<HTMLSelectElement>('compare-preset').value;
      if(preset==='custom')return;
      this.tiltB=Number(preset); this.actions.tiltA(23.44);
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
    return {...a,tilt:this.tiltB,solution:this.tiltB===a.tilt?a.solution:this.solution};
  }
  toggle(): void {
    if(!this.enabled && this.el('focus-view').getAttribute('aria-pressed')==='true') this.el('focus-view').click();
    this.enabled=!this.enabled;
    document.documentElement.dataset.comparison=String(this.enabled);
    this.el('compare-controls').hidden=!this.enabled;
    this.el('compare-results').hidden=!this.enabled;
    this.el('comparison-labels').hidden=!this.enabled;
    // Focus hides controls in either mode; it never changes A/B science.
    if(!this.enabled){this.worker.cancel();this.solution=null;this.key='';this.actions.scene(null);}
    this.actions.change();
    this.el('compare-toggle').focus({preventScroll:true});
  }
  update(snapshot: CompareSnapshot): void {
    this.snapshot=snapshot;
    this.el('compare-toggle').textContent=t(this.enabled?'Single Earth':'Compare Earth A/B');
    this.el('compare-toggle').setAttribute('aria-pressed',String(this.enabled));
    if(!this.enabled)return;
    const key=snapshot.source.model==='energy-balance' && this.tiltB!==snapshot.source.tilt ? `${this.tiltB}:${snapshot.source.depth}` : 'none';
    if(key!==this.key){
      this.key=key;this.solution=null;this.error='';this.revision++;
      this.worker.cancel();
      if(key!=='none')this.worker.request(this.tiltB,snapshot.source.depth,false);
    }
    const b=this.sourceB;
    this.actions.scene({tilt:b.tilt,thermal:b.solution});
    const aInput=this.el<HTMLInputElement>('compare-tilt-a'),bInput=this.el<HTMLInputElement>('compare-tilt-b');
    if(document.activeElement!==aInput)aInput.value=String(snapshot.source.tilt);
    if(document.activeElement!==bInput)bInput.value=String(this.tiltB);
    this.el<HTMLSelectElement>('compare-preset').value=snapshot.source.tilt===23.44 && [0,45,90].includes(this.tiltB)?String(this.tiltB):'custom';
    this.el<HTMLSelectElement>('compare-layer').value=snapshot.mode;
    this.el<HTMLInputElement>('compare-day').value=String(Math.min(365,Math.floor(snapshot.day)));
    this.el('compare-date').textContent=formatModelDate(snapshot.day);
    for(const mode of ['year','day','coupled'] as const){
      const button=this.el(`compare-play-${mode}`); const active=snapshot.playback===mode;
      button.setAttribute('aria-pressed',String(active));button.classList.toggle('active',active);
      button.textContent=t(active?'Pause':mode==='year'?'Play year':mode==='day'?'Play day':'Coupled motion');
    }
    this.el('comparison-label-a').textContent=`A · ${snapshot.source.tilt}°`;
    this.el('comparison-label-b').textContent=`B · ${this.tiltB}°`;
    this.el('compare-context').textContent=msg`Same date, location, rotation, model and heat storage. Only tilt differs. ${t(snapshot.locationName)} · ${snapshot.latitude.toFixed(2)}° / ${snapshot.longitude.toFixed(2)}°`;
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
