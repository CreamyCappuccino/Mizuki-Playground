import {GeographyClient,type GeographyEvent} from '../ui/geographyClient';
import {normalizeGeographyConfiguration,type GeographyPair} from '../physics/geographyContract';
import {geographyReading,geographyCell} from '../physics/geographySampling';
import {DEFAULT_GEOGRAPHY_EXPERIMENT,decodeGeographyExperiment,encodeGeographyExperiment,
  geographyExperimentHash,geographyExperimentFromHash,type GeographyExperiment} from '../experiments/geographyExperiment';
import {clearPlot,differenceBound,renderMap,renderAnnual,renderAtlas,type PlotBounds} from './plots';
import {t,setLanguage,translateDocument,type Language} from './i18n';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>el<HTMLInputElement>(id);
let state:GeographyExperiment=structuredClone(DEFAULT_GEOGRAPHY_EXPERIMENT);
let pair:GeographyPair|null=null,bound=1,lastEvent:GeographyEvent|null=null;
let mapBounds:PlotBounds|null=null,atlasBounds:PlotBounds|null=null;
let frame=0,disposed=false,pendingNotice='';
const canvases=['map','annual','atlas'].map(id=>el<HTMLCanvasElement>(id));
const client=new GeographyClient(()=>new Worker(new URL('../physics/geography.worker.ts',import.meta.url),{type:'module'}),onEvent);
function onEvent(event:GeographyEvent):void {
  lastEvent=event;
  if(event.kind==='ready'){pair=event.pair;bound=differenceBound(pair);}else if(event.kind!=='progress')pair=null;
  el('status').dataset.status=event.kind==='progress'?'loading':event.kind;
  el<HTMLButtonElement>('cancel').disabled=event.kind!=='loading'&&event.kind!=='progress';
  schedule();
}
function syncInputs():void {
  input('tilt').value=String(state.tilt);input('eccentricity').value=String(state.orbit.eccentricity);
  input('perihelion').value=String(state.orbit.perihelion);input('axis').value=String(state.orbit.axis);
  input('reference').checked=state.reference;syncSelection(true);
}
function syncSelection(force=false):void {
  // Resize/progress paints must not overwrite a focused, not-yet-committed edit.
  for(const id of ['day','latitude','longitude'] as const) {
    const field=input(id);if(force||document.activeElement!==field)field.value=String(state[id]);
  }
  el<HTMLSelectElement>('layer').value=state.layer;
  el<HTMLSelectElement>('layer').querySelector<HTMLOptionElement>('option[value=difference]')!.disabled=!state.reference;
  el('day-output').textContent=state.day.toFixed(state.day%1?2:0);
}
function statusText():string {
  if(!lastEvent)return t('Not computed');
  switch(lastEvent.kind){
    case 'loading':return t('Calculating; previous temperatures are hidden.');
    case 'progress':return t(lastEvent.phase==='data'?'Loading verified data…':lastEvent.phase==='earth'?'Solving Earth geography…':'Solving the ocean reference…');
    case 'ready':return `${t('Ready')} · ${t(lastEvent.cached?'Cached result':'New result')}`;
    case 'cancelled':return t('Cancelled');
    case 'error':return `${lastEvent.message} ${t('Retry with Calculate. No fallback temperatures are shown.')}`;
  }
}
function schedule():void{if(disposed||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
function draw():void {
  translateDocument();syncSelection();el('status').textContent=statusText();
  el('notice').textContent=pendingNotice?t(pendingNotice):'';
  el('current-config').textContent=`${t('Tilt (°)')}: ${state.tilt} · e=${state.orbit.eccentricity} · ${t('day')} ${state.day.toFixed(1)} · 10°×10°`;
  canvases.forEach(c=>c.setAttribute('aria-busy',String(!pair)));
  if(!pair){delete el('temperature').dataset.value;el('map-scale').textContent='';canvases.forEach(clearPlot);for(const id of ['temperature','fraction','depth','cell'])el(id).textContent='—';
    el('diagnostics').textContent='';el('annual-summary').textContent='';el('section-longitude').textContent='';el('warning').hidden=true;
    mapBounds=atlasBounds=null;return;}
  const a=geographyReading(pair.current,state.latitude,state.longitude,state.day);
  const b=pair.reference?geographyReading(pair.reference,state.latitude,state.longitude,state.day):null;
  el('temperature').textContent=`${a.temperature.toFixed(2)} °C / ${b?b.temperature.toFixed(2)+' °C':'—'}`;
  el('temperature').dataset.value=String(a.temperature);el('fraction').textContent=`${(100*a.landFraction).toFixed(2)}%`;
  el('depth').textContent=`${a.effectiveDepth.toFixed(2)} m`;
  el('cell').textContent=a.cell.polarMean?t('Polar-row mean; longitude is undefined.'):`${a.cell.latitude.toFixed(1)}° / ${a.cell.longitude!.toFixed(1)}°`;
  el('diagnostics').textContent=`${pair.current.years} ${t('years to convergence')} · ΔT=${pair.current.periodicError.toExponential(2)} °C · R=${pair.current.energyResidual.toExponential(2)} W/m² · ${t('Retained result memory')} ${(client.cachedBytes/1048576).toFixed(2)} MiB`;
  mapBounds=renderMap(canvases[0],pair,state,bound);
  const annual=renderAnnual(canvases[1],pair,state);
  el('annual-summary').textContent=`${t('Annual mean')} ${annual.mean.toFixed(2)} °C · ${annual.minimum.toFixed(2)}…${annual.maximum.toFixed(2)} °C`;
  el('annual-legend').textContent=t(state.reference?'Solid: Earth geography · dashed: uniform ocean, same tilt and orbit.':'Ocean reference disabled');
  atlasBounds=renderAtlas(canvases[2],pair,state,bound);
  const cell=geographyCell(0,state.longitude);
  el('section-longitude').textContent=`${cell.longitude! - 5}°…${cell.longitude! + 5}° · ${state.layer==='difference'?t('Earth − uniform ocean'):t('Temperature')}`
    +(a.cell.polarMean?' · '+t('Pole readout averages the polar row; this atlas retains the selected longitude.'):'');
  el('map-scale').textContent=t(state.layer==='land'?'Land fraction: 0–100%.':state.layer==='difference'?'Difference colours are symmetric around zero.':'Fixed temperature colours: −100 to 180 °C. Numeric values are not clipped.')+(state.layer==='difference'?` ±${bound} °C`:'');
  el('warning').hidden=!([pair.current,pair.reference].some(s=>s&&(s.minimum < -60||s.maximum>60)));
}
function apply(next:GeographyExperiment):void {
  // Validate everything before mutating state or cancelling the existing experiment.
  const safe=decodeGeographyExperiment(encodeGeographyExperiment(next));
  pendingNotice='';state=safe;syncInputs();client.request(state);schedule();
}
el<HTMLFormElement>('science-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {
    const c=normalizeGeographyConfiguration({tilt:Number(input('tilt').value),reference:input('reference').checked,
      orbit:{eccentricity:Number(input('eccentricity').value),perihelion:Number(input('perihelion').value),axis:Number(input('axis').value)}});
    apply({...state,...c,layer:state.layer==='difference'&&!c.reference?'temperature':state.layer});
  }catch{pendingNotice='Invalid settings; the previous experiment is unchanged.';schedule();}
});
el('cancel').addEventListener('click',()=>{++loadSerial;client.cancel();});
for(const id of ['day','latitude','longitude'] as const)input(id).addEventListener(id==='day'?'input':'change',()=>{
  const value=Number(input(id).value),range=id==='latitude'?90:id==='longitude'?180:365;
  if(!input(id).value.trim()||!Number.isFinite(value)||(id==='day'?(value<1||value>=366):Math.abs(value)>range)){syncSelection(true);return;}
  state={...state,[id]:value};schedule();
});
el('layer').addEventListener('change',()=>{state={...state,layer:el<HTMLSelectElement>('layer').value as GeographyExperiment['layer']};schedule();});
function pointer(canvas:HTMLCanvasElement,get:()=>PlotBounds|null,select:(x:number,y:number)=>void) {
  let start:{x:number;y:number;id:number}|null=null;
  canvas.addEventListener('pointerdown',e=>{start=e.isPrimary&&e.button===0?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});
  canvas.addEventListener('pointercancel',()=>{start=null;});
  canvas.addEventListener('pointerup',e=>{
    const prev=start;start=null;const b=get();if(!prev||!b||prev.id!==e.pointerId||Math.hypot(e.clientX-prev.x,e.clientY-prev.y)>6)return;
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;
    if(x<b.left||x>b.right||y<b.top||y>b.bottom)return;
    select((x-b.left)/(b.right-b.left),(y-b.top)/(b.bottom-b.top));schedule();
  });
}
pointer(canvases[0],()=>mapBounds,(x,y)=>{
  const row=Math.min(17,Math.floor((1-y)*18)),col=Math.min(35,Math.floor(x*36));
  state={...state,latitude:-85+row*10,longitude:-175+col*10};
});
pointer(canvases[2],()=>atlasBounds,(x,y)=>{state={...state,day:1+Math.round(x*364),latitude:85-Math.min(17,Math.floor(y*18))*10};});
for(const canvas of [canvases[0],canvases[2]])canvas.addEventListener('keydown',e=>{
  if(!pair||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();
  if(e.key==='ArrowUp'||e.key==='ArrowDown')state.latitude=Math.max(-85,Math.min(85,state.latitude+(e.key==='ArrowUp'?10:-10)));
  else if(canvas===canvases[2])state.day=((state.day-1+(e.key==='ArrowRight'?1:-1)+365)%365)+1;
  else state.longitude=((state.longitude+180+(e.key==='ArrowRight'?10:-10)+360)%360)-180;
  schedule();
});
el('language').addEventListener('change',()=>{const lang=el<HTMLSelectElement>('language').value as Language;setLanguage(lang);try{localStorage.setItem('earth-geography:language',lang);}catch{}schedule();});
el('large').addEventListener('click',()=>{const large=document.documentElement.dataset.large!=='true';document.documentElement.dataset.large=String(large);el('large').setAttribute('aria-pressed',String(large));schedule();});
el('copy').addEventListener('click',async()=>{
  try {const url=new URL(location.href);url.username='';url.password='';url.search='';url.hash=geographyExperimentHash(state);await navigator.clipboard.writeText(url.href);pendingNotice='Link copied';}
  catch{pendingNotice='Clipboard unavailable; use Save JSON.';}schedule();
});
el('save').addEventListener('click',()=>{
  const url=URL.createObjectURL(new Blob([encodeGeographyExperiment(state)+'\n'],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='earth-geography-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
el('open-json').addEventListener('click',()=>input('load').click());
let loadSerial=0;
input('load').addEventListener('change',async()=>{
  const token=++loadSerial,file=input('load').files?.[0];input('load').value='';if(!file)return;
  try {if(file.size>4096)throw new Error('Too large');const next=decodeGeographyExperiment(await file.text());if(token!==loadSerial)return;apply(next);pendingNotice='Settings loaded';}
  catch{if(token!==loadSerial)return;pendingNotice='Invalid settings; the previous experiment is unchanged.';}schedule();
});
function loadHash():void{try{const next=geographyExperimentFromHash(location.hash);if(next)apply(next);}catch{pendingNotice='Invalid settings; the previous experiment is unchanged.';schedule();}}
window.addEventListener('hashchange',()=>{++loadSerial;loadHash();});
// Direct scientific edits supersede any still-reading file; navigation can never race it.
for(const id of ['science-form','day','latitude','longitude','layer'])el(id).addEventListener('input',()=>{++loadSerial;});
window.addEventListener('resize',schedule);
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;++loadSerial;client.dispose();cancelAnimationFrame(frame);});
window.addEventListener('pageshow',schedule);
try {const lang=localStorage.getItem('earth-geography:language')??localStorage.getItem('earth-lab:language');if(lang==='en'||lang==='ja'){setLanguage(lang);el<HTMLSelectElement>('language').value=lang;}}catch{}
syncInputs();let restored=false;
try{const next=geographyExperimentFromHash(location.hash);if(next){apply(next);restored=true;}}catch{pendingNotice='Invalid settings; the previous experiment is unchanged.';}
if(!restored)client.request(state);schedule();
