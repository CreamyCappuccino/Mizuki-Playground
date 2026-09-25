import { CLASSIC_ORBIT, normalizeOrbit, orbitalMoment, perihelionDay, dayAtSeasonalLongitude, type OrbitParameters } from '../physics/orbit';
import { SOLAR_CONSTANT } from '../physics/solar';
import { t, msg, onLanguageChange } from './i18n';
import { formatModelDate } from './chart';
export interface OrbitSnapshot { a:OrbitParameters;b:OrbitParameters;dual:boolean;tiltA:number;tiltB:number;day:number }
interface OrbitActions {get:()=>OrbitSnapshot;set:(side:'A'|'B',orbit:OrbitParameters)=>void;day:(day:number)=>void}
/** Static parameter controls. No implicit epoch, ephemeris service or continuously changing precession. */
export class OrbitWorkbench {
  private side:'A'|'B'='A';
  private readonly events=new AbortController();
  private readonly unsubscribe:()=>void;
  private readonly el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
  constructor(private readonly actions:OrbitActions){
    const on=(id:string,event:string,fn:()=>void)=>this.el(id).addEventListener(event,fn,{signal:this.events.signal});
    on('orbit-side','change',()=>{this.side=this.el<HTMLSelectElement>('orbit-side').value as 'A'|'B';this.refresh();});
    for(const [id,key,max] of [['orbit-e','eccentricity',.3],['orbit-peri','perihelion',360],['orbit-axis','axis',360]] as const){
      const commit=()=>{
        const input=this.el<HTMLInputElement>(id),value=input.value.trim()===''?NaN:Number(input.value);
        const s=this.actions.get(),old=this.side==='A'?s.a:s.b;
        if(!Number.isFinite(value)||value<0||value>max){input.value=String(old[key]);this.el('orbit-input-status').textContent=t('Invalid orbital value. Previous setting kept.');return;}
        const next=normalizeOrbit({...old,[key]:value});input.value=String(next[key]);this.el('orbit-input-status').textContent='';this.actions.set(this.side,next);
      };
      on(id,'change',commit);this.el(id).addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();commit();}}, {signal:this.events.signal});
    }
    on('orbit-classic','click',()=>this.actions.set(this.side,{...CLASSIC_ORBIT}));
    on('orbit-earthlike','click',()=>this.actions.set(this.side,{eccentricity:.0167,perihelion:282.94,axis:0}));
    on('orbit-summer','click',()=>this.actions.set(this.side,{eccentricity:.2,perihelion:90,axis:0}));
    on('orbit-winter','click',()=>this.actions.set(this.side,{eccentricity:.2,perihelion:270,axis:0}));
    on('orbit-copy-a','click',()=>this.actions.set('B',{...this.actions.get().a}));
    for(const [id,offset] of [['orbit-near',0],['orbit-far',180]] as const)on(id,'click',()=>{
      const s=this.actions.get(),o=this.side==='A'?s.a:s.b;
      if(o.eccentricity>0)this.actions.day(dayAtSeasonalLongitude(o.perihelion-o.axis+offset,o));
    });
    this.unsubscribe=onLanguageChange(()=>this.refresh());this.refresh();
  }
  refresh():void {
    const s=this.actions.get();if(!s.dual)this.side='A';
    const select=this.el<HTMLSelectElement>('orbit-side');select.value=this.side;select.options[1].disabled=!s.dual;
    const o=this.side==='A'?s.a:s.b;
    for(const [id,value] of [['orbit-e',o.eccentricity],['orbit-peri',o.perihelion],['orbit-axis',o.axis]] as const){
      const el=this.el<HTMLInputElement>(id);if(document.activeElement!==el)el.value=String(value);
    }
    this.el<HTMLInputElement>('orbit-peri').disabled=o.eccentricity===0;
    this.el<HTMLInputElement>('orbit-axis').disabled=(this.side==='A'?s.tiltA:s.tiltB)===0;
    this.el<HTMLButtonElement>('orbit-copy-a').disabled=!s.dual;
    this.el<HTMLButtonElement>('orbit-near').disabled=this.el<HTMLButtonElement>('orbit-far').disabled=o.eccentricity===0;
    const m=orbitalMoment(s.day,o);
    this.el('orbit-values').textContent=msg`${this.side} · Distance ${m.distanceAU.toFixed(4)} au · Solar ${Math.round(SOLAR_CONSTANT*m.irradianceFactor)} W/m² · Speed ${m.speedRatio.toFixed(3)} × circular`;
    this.el('orbit-values').dataset.distance=String(m.distanceAU);this.el('orbit-values').dataset.flux=String(SOLAR_CONSTANT*m.irradianceFactor);
    const peri=perihelionDay(o);
    this.el('orbit-degeneracy').textContent=peri===null?t('Circular orbit: no distinct perihelion. Axis direction is a static experiment, not an epoch.')
      :msg`Perihelion: ${formatModelDate(peri)} · All dates are model labels, not an ephemeris.`;
    this.el('orbit-quarter-dates').textContent=[0,90,180,270].map((a,i)=>`${t(['Spring reference','Northern summer reference','Autumn reference','Northern winter reference'][i])}: ${formatModelDate(dayAtSeasonalLongitude(a,o))}`).join(' · ');
  }
  dispose():void {this.events.abort();this.unsubscribe();}
}
