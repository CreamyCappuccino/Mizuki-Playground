import { GeographyClient, type GeographyState } from '../ui/geographyClient';
import { geographyRequest, geographyRequestKey, type GeographyConditions } from '../physics/geographyProtocol';
import { geographyCell, sampleGeographyTemperature } from '../physics/geographySampling';
import { DEFAULT_GEOGRAPHY_EXPERIMENT, decodeGeographyExperiment, encodeGeographyExperiment,
  geographyExperimentHash, geographyExperimentFromHash, type GeographyExperiment } from '../experiments/geographyExperiment';
import { clearPlot, differenceBound, renderAnnual, renderAtlas, renderMap, selectedMaterial, type PlotBounds } from './plots';
import { setLanguage, t, translateDocument, type Language } from './i18n';
import type { GeographyClimateSolution } from '../physics/geographyClimate';
import { normalizeOrbit } from '../physics/orbit';

const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
const input=(id:string)=>el<HTMLInputElement>(id);
const select=(id:string)=>el<HTMLSelectElement>(id);
const canvases={map:el<HTMLCanvasElement>('map'),annual:el<HTMLCanvasElement>('annual'),atlas:el<HTMLCanvasElement>('atlas')};
const RETAINED_DEPTH=10 as const;
let state:GeographyExperiment=structuredClone(DEFAULT_GEOGRAPHY_EXPERIMENT);
let current:GeographyClimateSolution|null=null,reference:GeographyClimateSolution|null=null;
let currentStatus:GeographyState={status:'canceled'},referenceStatus:GeographyState={status:'canceled'};
let currentKey='',referenceKey='',bound=1,mapBounds:PlotBounds|null=null,atlasBounds:PlotBounds|null=null;
let frame=0,disposed=false,pendingNotice='',loadSerial=0;

const client=new GeographyClient(()=>new Worker(new URL('../physics/geography.worker.ts',import.meta.url),{type:'module'}));
function conditions(tilt=state.tilt):GeographyConditions {return {tilt,orbit:state.orbit,retainedDepth:RETAINED_DEPTH};}
function keyFor(tilt=state.tilt):string{return geographyRequestKey(geographyRequest(1,conditions(tilt)));}
function handle(owner:'A'|'reference',next:GeographyState):void {
  if(owner==='A'){currentStatus=next;current=next.status==='ready'?next.solution:null;}
  else {referenceStatus=next;reference=next.status==='ready'?next.solution:null;}
  bound=differenceBound(current??reference??dummySolution(),reference);
  schedule();
}
function dummySolution():GeographyClimateSolution {
  // Called only before either field is ready; differenceBound returns 1 without a reference.
  return {tilt:0,orbit:{eccentricity:0,perihelion:0,axis:0},grid:{nlat:0,nlon:0,size:0,diffusion:0,dphi:0,dlambda:0,
    phi:new Float64Array(),lambda:new Float64Array(),weight:new Float64Array(),northSouth:new Float64Array(),eastWest:new Float64Array()},
    landFraction:new Float64Array(),temperatures:new Float64Array(),years:0,stepsPerDay:2,periodicError:0,energyResidual:0,
    maxStepEnergyResidual:0,maxRelativeLinearResidual:0,maxLinearIterations:0,minimum:0,maximum:0,provenance:{}};
}
function requestField(owner:'A'|'reference',tilt:number):void {
  const key=keyFor(tilt),status=owner==='A'?currentStatus:referenceStatus,oldKey=owner==='A'?currentKey:referenceKey;
  if(owner==='A')currentKey=key;else referenceKey=key;
  const notify=(next:GeographyState)=>handle(owner,next);
  if(oldKey!==key){if(owner==='A')current=null;else reference=null;client.request(owner,conditions(tilt),notify);return;}
  if(status.status==='error')client.retry(owner);
  else if(status.status==='canceled')client.request(owner,conditions(tilt),notify);
}
function startScience():void {
  requestField('A',state.tilt);
  if(state.reference)requestField('reference',23.44);
  else {client.cancel('reference');reference=null;referenceStatus={status:'canceled'};referenceKey='';}
  schedule();
}
function syncInputs(force=false):void {
  const values:Record<string,string>={tilt:String(state.tilt),eccentricity:String(state.orbit.eccentricity),perihelion:String(state.orbit.perihelion),axis:String(state.orbit.axis),day:String(state.day),latitude:String(state.latitude),longitude:String(state.longitude)};
  for(const [id,value] of Object.entries(values)){const field=input(id);if(force||document.activeElement!==field)field.value=value;}
  input('reference').checked=state.reference;select('layer').value=state.layer;
  select('layer').querySelector<HTMLOptionElement>('option[value=difference]')!.disabled=!state.reference;
  el('day-output').textContent=state.day.toFixed(state.day%1?2:0);
}
function combinedStatus():{status:string;text:string} {
  const describe=(value:GeographyState,label:string)=>value.status==='queued'?`${label}: ${t('Queued…')}`:
    value.status==='computing'?`${label}: ${t('Computing…')}`:value.status==='error'?`${label}: ${value.error}`:
    value.status==='canceled'?`${label}: ${t('Cancelled')}`:`${label}: ${t('Ready')}`;
  if(currentStatus.status==='error')return{status:'error',text:`${describe(currentStatus,'A')} · ${t('Retry with Calculate. No fallback temperatures are shown.')}`};
  if(currentStatus.status==='queued'||currentStatus.status==='computing')return{status:'loading',text:t('Calculating; previous temperatures are hidden.')+' '+describe(currentStatus,'A')};
  if(currentStatus.status==='canceled'&&!current)return{status:'canceled',text:t('Cancelled')};
  if(state.reference&&(referenceStatus.status==='queued'||referenceStatus.status==='computing'))return{status:'loading',text:`${t('Ready')} · ${describe(referenceStatus,'23.44°')}`};
  if(state.reference&&referenceStatus.status==='error')return{status:'error',text:`${describe(referenceStatus,'23.44°')} · ${t('Retry with Calculate. No fallback temperatures are shown.')}`};
  if(current)return{status:'ready',text:t('Ready')};
  return{status:'idle',text:t('Not computed')};
}
function schedule():void{if(disposed||frame)return;frame=requestAnimationFrame(()=>{frame=0;draw();});}
function draw():void {
  translateDocument();syncInputs();const status=combinedStatus();el('status').dataset.status=status.status;el('status').textContent=status.text;
  el('notice').textContent=pendingNotice?t(pendingNotice):'';
  el('current-config').textContent=`${t('Tilt (°)')}: ${state.tilt} · e=${state.orbit.eccentricity} · ${t('day')} ${state.day.toFixed(1)} · 10°×10°`;
  const needReference=state.layer==='difference';const plotsReady=!!current&&(!needReference||!!reference);
  canvases.map.setAttribute('aria-busy',String(!plotsReady));canvases.annual.setAttribute('aria-busy',String(!current));canvases.atlas.setAttribute('aria-busy',String(!plotsReady));
  el<HTMLButtonElement>('cancel').disabled=!['queued','computing'].includes(currentStatus.status)&&!['queued','computing'].includes(referenceStatus.status);
  if(!current){delete el('temperature').dataset.value;for(const id of ['temperature','fraction','depth','cell'])el(id).textContent='—';
    el('diagnostics').textContent='';el('annual-summary').textContent='';el('section-longitude').textContent='';el('map-scale').textContent='';el('warning').hidden=true;
    clearPlot(canvases.map);clearPlot(canvases.annual);clearPlot(canvases.atlas);mapBounds=atlasBounds=null;return;}
  const cell=geographyCell(current.grid,state.latitude,state.longitude),material=selectedMaterial(current,state);
  const a=sampleGeographyTemperature(current,state.latitude,state.longitude,state.day);
  const b=reference?sampleGeographyTemperature(reference,state.latitude,state.longitude,state.day):null;
  el('temperature').textContent=`${a.toFixed(2)} °C / ${b===null?'—':b.toFixed(2)+' °C'}`;el('temperature').dataset.value=String(a);
  el('fraction').textContent=`${(100*material.landFraction).toFixed(2)}%`;el('depth').textContent=`${material.effectiveDepth.toFixed(2)} m`;
  el('cell').textContent=`${cell.latitude.toFixed(1)}° / ${cell.longitude.toFixed(1)}°`+(cell.polarCap?` · ${t('Polar-cap sector. Longitude is not unique at the geometric pole.')}`:'');
  el('diagnostics').textContent=`${current.years} ${t('years to convergence')} · ΔT=${current.periodicError.toExponential(2)} °C · R=${current.energyResidual.toExponential(2)} W/m² · ${t('Retained result memory')} ${(client.cacheBytes/1048576).toFixed(2)} MiB`;
  if(plotsReady){bound=differenceBound(current,reference);mapBounds=renderMap(canvases.map,current,reference,state,bound);atlasBounds=renderAtlas(canvases.atlas,current,reference,state,bound);}
  else {clearPlot(canvases.map);clearPlot(canvases.atlas);mapBounds=atlasBounds=null;}
  const annual=renderAnnual(canvases.annual,current,state.reference?reference:null,state);
  el('annual-summary').textContent=`${t('Annual mean')} ${annual.mean.toFixed(2)} °C · ${annual.minimum.toFixed(2)}…${annual.maximum.toFixed(2)} °C`;
  el('annual-legend').hidden=!state.reference;
  const lonCell=geographyCell(current.grid,0,state.longitude);el('section-longitude').textContent=`${(lonCell.longitude-5).toFixed(0)}°…${(lonCell.longitude+5).toFixed(0)}° · ${state.layer==='difference'?t('Difference from 23.44°'):t(state.layer==='land'?'Land fraction':'Temperature')}`;
  el('map-scale').textContent=t(state.layer==='land'?'Land fraction: 0–100%.':state.layer==='difference'?'Difference colours are symmetric around zero.':'Fixed temperature colours: −100 to 180 °C. Numeric values are not clipped.')+(state.layer==='difference'?` ±${bound} °C`:'');
  el('warning').hidden=!([current,reference].some(s=>s&&(s.minimum<-60||s.maximum>60)));
}
function validatedState(next:GeographyExperiment):GeographyExperiment{return decodeGeographyExperiment(encodeGeographyExperiment(next));}
function apply(next:GeographyExperiment,run=true):void {const safe=validatedState(next);pendingNotice='';state=safe;syncInputs(true);if(run)startScience();schedule();}

el<HTMLFormElement>('science-form').addEventListener('submit',event=>{
  event.preventDefault();
  try {const orbit=normalizeOrbit({eccentricity:Number(input('eccentricity').value),perihelion:Number(input('perihelion').value),axis:Number(input('axis').value)});
    const tilt=Number(input('tilt').value),referenceEnabled=input('reference').checked;
    apply({...state,tilt,orbit,reference:referenceEnabled,layer:state.layer==='difference'&&!referenceEnabled?'temperature':state.layer});
  } catch {pendingNotice='Invalid settings; the previous experiment is unchanged.';schedule();}
});
el('cancel').addEventListener('click',()=>{++loadSerial;client.cancel('A');client.cancel('reference');current=null;reference=null;schedule();});
for(const id of ['day','latitude','longitude'] as const) input(id).addEventListener(id==='day'?'input':'change',()=>{
  const value=Number(input(id).value),valid=id==='day'?Number.isFinite(value)&&value>=1&&value<366:
    id==='latitude'?Number.isFinite(value)&&value>=-90&&value<=90:Number.isFinite(value)&&value>=-180&&value<=180;
  if(!input(id).value.trim()||!valid){syncInputs(true);return;}state=validatedState({...state,[id]:value});schedule();
});
select('layer').addEventListener('change',()=>{const layer=select('layer').value as GeographyExperiment['layer'];state=validatedState({...state,layer});schedule();});

function pointer(canvas:HTMLCanvasElement,get:()=>PlotBounds|null,selectPoint:(x:number,y:number)=>void) {
  let start:{x:number;y:number;id:number}|null=null;
  canvas.addEventListener('pointerdown',e=>{start=e.isPrimary&&e.button===0?{x:e.clientX,y:e.clientY,id:e.pointerId}:null;});
  canvas.addEventListener('pointercancel',()=>{start=null;});
  canvas.addEventListener('pointerup',e=>{const prev=start;start=null;const b=get();if(!prev||!b||prev.id!==e.pointerId||Math.hypot(e.clientX-prev.x,e.clientY-prev.y)>6)return;
    const rect=canvas.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top;if(x<b.left||x>b.right||y<b.top||y>b.bottom)return;
    selectPoint((x-b.left)/(b.right-b.left),(y-b.top)/(b.bottom-b.top));schedule();});
}
pointer(canvases.map,()=>mapBounds,(x,y)=>{if(!current)return;const row=Math.min(current.grid.nlat-1,Math.floor((1-y)*current.grid.nlat)),column=Math.min(current.grid.nlon-1,Math.floor(x*current.grid.nlon));
  state=validatedState({...state,latitude:current.grid.phi[row]*180/Math.PI,longitude:current.grid.lambda[column]*180/Math.PI});});
pointer(canvases.atlas,()=>atlasBounds,(x,y)=>{if(!current)return;const row=Math.min(current.grid.nlat-1,Math.floor((1-y)*current.grid.nlat));
  state=validatedState({...state,day:1+Math.round(x*364),latitude:current.grid.phi[row]*180/Math.PI});});
for(const canvas of [canvases.map,canvases.atlas]) canvas.addEventListener('keydown',e=>{
  if(!current||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const cell=geographyCell(current.grid,state.latitude,state.longitude);
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){const row=Math.max(0,Math.min(current.grid.nlat-1,cell.row+(e.key==='ArrowUp'?1:-1)));state=validatedState({...state,latitude:current.grid.phi[row]*180/Math.PI});}
  else if(canvas===canvases.atlas)state=validatedState({...state,day:((state.day-1+(e.key==='ArrowRight'?1:-1)+365)%365)+1});
  else {const column=(cell.column+(e.key==='ArrowRight'?1:-1)+current.grid.nlon)%current.grid.nlon;state=validatedState({...state,longitude:current.grid.lambda[column]*180/Math.PI});}
  schedule();
});

select('language').addEventListener('change',()=>{const lang=select('language').value as Language;setLanguage(lang);try{localStorage.setItem('earth-geography:language',lang);}catch{}schedule();});
el('large').addEventListener('click',()=>{const large=document.documentElement.dataset.large!=='true';document.documentElement.dataset.large=String(large);el('large').setAttribute('aria-pressed',String(large));try{localStorage.setItem('earth-geography:large',String(large));}catch{}schedule();});
el('copy').addEventListener('click',async()=>{try{const url=new URL(location.href);url.username='';url.password='';url.search='';url.hash=geographyExperimentHash(state);await navigator.clipboard.writeText(url.href);pendingNotice='Link copied';}catch{pendingNotice='Clipboard unavailable; use Save JSON.';}schedule();});
el('save').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([encodeGeographyExperiment(state)+'\n'],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='earth-geography-experiment.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
el('open-json').addEventListener('click',()=>input('load').click());
input('load').addEventListener('change',async()=>{const token=++loadSerial,file=input('load').files?.[0];input('load').value='';if(!file)return;
  try{if(file.size>4096)throw new Error('Too large');const next=decodeGeographyExperiment(await file.text());if(token!==loadSerial)return;apply(next);pendingNotice='Settings loaded';}
  catch{if(token!==loadSerial)return;pendingNotice='Invalid settings; the previous experiment is unchanged.';schedule();}});
function loadHash():void{try{const next=geographyExperimentFromHash(location.hash);if(next)apply(next);}catch{pendingNotice='Invalid settings; the previous experiment is unchanged.';schedule();}}
window.addEventListener('hashchange',()=>{++loadSerial;loadHash();});
window.addEventListener('resize',schedule);
window.addEventListener('pagehide',event=>{if(event.persisted)return;disposed=true;++loadSerial;client.dispose();cancelAnimationFrame(frame);});
window.addEventListener('pageshow',schedule);
try{const lang=localStorage.getItem('earth-geography:language')??localStorage.getItem('earth-lab:language');if(lang==='en'||lang==='ja'){setLanguage(lang);select('language').value=lang;}
  const large=localStorage.getItem('earth-geography:large')==='true';document.documentElement.dataset.large=String(large);el('large').setAttribute('aria-pressed',String(large));}catch{}
syncInputs(true);try{const next=geographyExperimentFromHash(location.hash);if(next){state=next;syncInputs(true);}}catch{pendingNotice='Invalid settings; the previous experiment is unchanged.';}
startScience();schedule();
