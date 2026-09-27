import './lab.css';
import { getLanguage, setLanguage, onLanguageChange } from '../ui/i18n';
import { tr, translate } from './i18n';
import { DEFAULT_SWEEP, PARAMETER_LIMITS, validateSweep, type SweepSettings, type SweepResult } from './model';
import { SweepRunner, type SweepStatus } from './runner';
import { sweepFile, parseSweepFile, parseSweepHash, sweepURL } from './state';
import { earthLink, feedbackLink, RECIPES } from './bridges';
import { renderTrend, renderAnnual, renderMap, format, metricsCSV, METRICS, unit, type Metric } from './plots';
const $=<T extends HTMLElement>(id:string):T=>document.getElementById('sy-'+id) as T;
const input=(id:string)=>$<HTMLInputElement>(id),select=(id:string)=>$<HTMLSelectElement>(id);
const events=new AbortController(),on=(id:string,event:string,fn:()=>void)=>$(id).addEventListener(event,fn,{signal:events.signal});
let state=validateSweep(DEFAULT_SWEEP),result:SweepResult|null=null,status:SweepStatus={status:'idle'},disposed=false;
let renderFrame=0,destinationValid=true;
const runner=new SweepRunner(next=>{status=next;result=next.status==='ready'?next.result:null;render();});
const number=(id:string)=>{const el=input(id);if(!el.value.trim())throw new RangeError('Empty numeric field');return el.valueAsNumber;};
function readControls():SweepSettings {
 const count=number('count');
 return validateSweep({...state,base:{tilt:number('tilt'),eccentricity:number('eccentricity'),perihelion:number('perihelion'),axis:number('axis')},
  parameter:select('parameter').value,start:number('start'),end:number('end'),count,latitude:number('latitude'),summer:Number(select('summer').value),
  longitude:number('longitude'),profile:select('profile').value,depth:Number(select('depth').value),
  selected:Math.min(state.selected,count-1),comparison:Math.min(state.comparison,count-1)});
}
function writeControls():void {
 for(const id of ['start','end','count','latitude','longitude'] as const)input(id).value=String(state[id]);
 for(const id of ['tilt','eccentricity','perihelion','axis'] as const)input(id).value=String(state.base[id]);
 for(const id of ['parameter','summer','profile','depth'] as const)select(id).value=String(state[id]);
 const bounds=PARAMETER_LIMITS[state.parameter];
 for(const id of ['start','end']){input(id).min=String(bounds[0]);input(id).max=String(bounds[1]);}
}
function selectionOptions():void {
 for(const name of ['selected','comparison'] as const){
  const el=select(name);el.replaceChildren();
  for(const [k,row] of (result?.rows??[]).entries())el.add(new Option(`${k+1} · ${format(row.value,4)}`,String(k)));
  el.value=String(state[name]);el.disabled=!result;
 }
}
function renderRecipes():void {
 const parent=$('recipes');parent.replaceChildren();
 for(const recipe of RECIPES){const a=document.createElement('a');a.href=recipe.href;a.className='sy-recipe';a.dataset.recipe=recipe.id;
  const small=document.createElement('small');small.textContent=recipe.kind==='earth'?'3D EARTH →':'ZONAL FEEDBACK →';
  const title=document.createElement('h3');title.textContent=recipe.title[getLanguage()==='ja'?1:0];
  const desc=document.createElement('p');desc.textContent=recipe.lesson[getLanguage()==='ja'?1:0];a.append(small,title,desc);parent.append(a);}
}
function renderTable():void {
 const table=$('table');table.replaceChildren();if(!result)return;
 const head=document.createElement('thead'),header=document.createElement('tr');
 for(const title of ['#',tr(state.parameter),...METRICS.map(m=>`${tr(m)} (${unit(m)})`)]){const th=document.createElement('th');th.scope='col';th.textContent=title;header.append(th);}
 head.append(header);table.append(head);const body=document.createElement('tbody');
 result.rows.forEach((row,index)=>{const r=document.createElement('tr');r.setAttribute('aria-selected',String(index===state.selected));
  for(const value of [index+1,row.value,...METRICS.map(m=>row[m])]){const td=document.createElement('td');td.textContent=format(value,4);r.append(td);}body.append(r);});table.append(body);
}
function clearViews():void {
 delete $('status').dataset.retainedBytes;
 for(const id of ['cards','trend','annual','table'])$(id).replaceChildren();$('map').hidden=true;$('ramp').hidden=true;
 for(const id of ['orbits','map-scale','storage'])$(id).textContent='';
 for(const id of ['earth','feedback']){$(id).removeAttribute('href');$(id).setAttribute('aria-disabled','true');}
}
function render():void {
 if(disposed)return;
 const el=$('status');el.dataset.status=status.status;
 el.textContent=status.status==='running'?`${tr('running')} · ${status.completed}/${status.total}`:tr(status.status);
 $('cancel').toggleAttribute('disabled',status.status!=='running');$('csv').toggleAttribute('disabled',!result);$('empty').hidden=!!result;
 selectionOptions();
 if(!result){clearViews();return;}
 result.settings=state;
 const a=result.rows[state.selected],b=result.rows[state.comparison];
 $('orbits').textContent=`A: ε=${format(a.world.tilt)}°, e=${format(a.world.eccentricity,4)}, peri=${format(a.world.perihelion)}°, axis=${format(a.world.axis)}° · ${tr('modelDay')} ${format(a.day)} | B: ε=${format(b.world.tilt)}°, e=${format(b.world.eccentricity,4)}, peri=${format(b.world.perihelion)}°, axis=${format(b.world.axis)}° · ${tr('modelDay')} ${format(b.day)}`;
 const cards=$('cards');cards.replaceChildren();
 for(const m of METRICS){const card=document.createElement('div');card.className='sy-reading';card.dataset.metric=m;card.dataset.a=String(a[m]);card.dataset.b=String(b[m]);
  const h=document.createElement('h3');h.textContent=tr(m);const p=document.createElement('p');p.textContent=`A ${format(a[m])} / B ${format(b[m])}`;
  const small=document.createElement('small');small.textContent=`Δ(A−B) ${format(a[m]-b[m],4)} ${unit(m)}`;card.append(h,p,small);cards.append(card);}
 renderTrend($('trend'),result,select('metric').value as Metric);renderAnnual($('annual'),a,b);
 $('map').hidden=false;const max=renderMap($<HTMLCanvasElement>('map'),result);$('ramp').hidden=false;$('map-scale').textContent=`0 → ${format(max,1)} W/m²`;
 renderTable();
 el.dataset.retainedBytes=String(result.rows.reduce((sum,row)=>sum+row.daily.byteLength+row.seasonal.byteLength,0));
 for(const [id,href] of [['earth',earthLink(state)],['feedback',feedbackLink(state)]]){const link=$<HTMLAnchorElement>(id);if(destinationValid){link.href=href;link.removeAttribute('aria-disabled');}else{link.removeAttribute('href');link.setAttribute('aria-disabled','true');}}
 const linkedDepth=state.profile==='idealized-land'?2.5:state.profile==='idealized-ocean'?50:state.depth;
 $('storage').textContent=`${tr('linkStorage')}: ${linkedDepth} m`;
}
function adopt(next:SweepSettings):void {state=validateSweep(next);destinationValid=true;runner.cancel('idle');writeControls();$('error').textContent='';render();}
$('form').addEventListener('submit',e=>{e.preventDefault();try{state=readControls();destinationValid=true;$('error').textContent='';runner.run(state);}catch{$('error').textContent=tr('invalid');}},{signal:events.signal});
// Draft edits never overwrite their own controls or silently recompute results.
$('form').addEventListener('input',e=>{if((e.target as Element).id!=='sy-parameter')runner.cancel('idle');},{signal:events.signal});
on('parameter','change',()=>{
 const p=select('parameter').value as SweepSettings['parameter'];
 const [lo,hi]=PARAMETER_LIMITS[p];input('start').value=String(lo);input('end').value=String(hi);
 for(const id of ['start','end']){input(id).min=String(lo);input(id).max=String(hi);}runner.cancel('idle');
});
on('cancel','click',()=>runner.cancel());
for(const name of ['selected','comparison'] as const)on(name,'change',()=>{
 if(result){state=validateSweep({...state,[name]:Number(select(name).value)});render();}
});
on('metric','change',render);
for(const name of ['profile','depth','longitude'])on(name,'change',()=>{
 try{const next=validateSweep({...state,profile:select('profile').value,depth:Number(select('depth').value),longitude:number('longitude')});
  state=next;destinationValid=true;$('error').textContent='';render();}catch{destinationValid=false;$('error').textContent=tr('invalid');for(const id of ['earth','feedback']){$(id).removeAttribute('href');$(id).setAttribute('aria-disabled','true');}}
});
on('export','click',()=>{try{const next=readControls();$<HTMLTextAreaElement>('json').value=sweepFile(next);$('share-status').textContent=tr('saved');}catch{$('error').textContent=tr('invalid');}});
on('apply','click',()=>{try{adopt(parseSweepFile($<HTMLTextAreaElement>('json').value));}catch{$('error').textContent=tr('invalid');}});
on('link','click',()=>{try{input('url').value=sweepURL(location.href,readControls());$('share-status').textContent=tr('linkReady');}catch{$('error').textContent=tr('invalid');}});
on('csv','click',()=>{if(!result)return;const blob=new Blob([metricsCSV(result)],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download='earth-orbital-sweep.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);});
select('language').value=getLanguage();on('language','change',()=>setLanguage(select('language').value as 'ja'|'en'));
function languageChanged():void{translate();renderRecipes();render();}
const unsubscribe=onLanguageChange(languageChanged);
try{input('large').checked=localStorage.getItem('earth-lab:text-size')==='large';}catch{/* no storage required */}
function textSize():void{document.documentElement.dataset.textSize=input('large').checked?'large':'comfortable';try{localStorage.setItem('earth-lab:text-size',document.documentElement.dataset.textSize);}catch{/* local preference only */}render();}
on('large','change',textSize);
function restoreHash():void{try{const next=parseSweepHash(location.hash);if(next)adopt(next);}catch{$('error').textContent=tr('invalid');}}
window.addEventListener('hashchange',restoreHash,{signal:events.signal});
const observer=new ResizeObserver(()=>{cancelAnimationFrame(renderFrame);renderFrame=requestAnimationFrame(()=>{if(result&&!disposed)render();});});
observer.observe($('trend'));
window.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;runner.dispose();observer.disconnect();cancelAnimationFrame(renderFrame);unsubscribe();events.abort();},{signal:events.signal});
writeControls();translate();renderRecipes();textSize();restoreHash();render();
