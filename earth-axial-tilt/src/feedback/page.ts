import './lab.css';
import { ft,setFeedbackLanguage,translateFeedback } from './i18n';
import { DEFAULT_FEEDBACK,MEMORY_PATH,SWEEP_PATH,validateFeedbackExperiment,feedbackFile,feedbackHash,parseFeedbackFile,parseFeedbackHash,feedbackKey,type FeedbackExperiment } from './experiment';
import { FeedbackClient,type FeedbackClientState } from './client';
import { feedbackBytes } from './protocol';
import { sampleFeedback } from './model';
import { plotFeedbackAnnual,plotFeedbackMap,plotFeedbackHistory } from './plots';
const el=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(`fb-${id}`) as T;
const input=(id:string)=>el<HTMLInputElement>(id);
const events=new AbortController();
let settings=validateFeedbackExperiment(DEFAULT_FEEDBACK),selected=0,current:FeedbackClientState={status:'idle'},dirty=false;
const client=new FeedbackClient(state=>{current=state;render();});
function writeControls(){
 for(const [id,v] of [['tilt',settings.tilt],['depth',settings.depth],['ecc',settings.eccentricity],['peri',settings.perihelion],['axis',settings.axis],
   ['enabled',settings.enabled],['seed',settings.seed],['latitude',settings.latitude],['day',settings.day]] as const)input(id).value=String(v);
 input('factors').value=settings.multipliers.join(', ');
 input('preset').value=settings.mode==='compare'?'compare':JSON.stringify(settings.multipliers)===JSON.stringify(MEMORY_PATH)?'memory':JSON.stringify(settings.multipliers)===JSON.stringify(SWEEP_PATH)?'sweep':'custom';
 el('seed-control').hidden=settings.mode==='compare';
}
function readControls():FeedbackExperiment{
 const number=(id:string)=>{const value=input(id).value.trim();if(!value)throw new Error('Empty numeric setting');return Number(value);};
 const raw=input('factors').value.split(',').map(s=>s.trim());if(raw.some(v=>!v))throw new Error('Empty multiplier');
 return validateFeedbackExperiment({tilt:number('tilt'),depth:number('depth'),eccentricity:number('ecc'),
 perihelion:number('peri'),axis:number('axis'),enabled:input('enabled').value==='true',
 mode:input('preset').value==='compare'?'compare':'path',seed:input('seed').value,multipliers:raw.map(Number),latitude:settings.latitude,day:settings.day});
}
function label(index:number):string{
 if(current.status!=='ready')return '';
 return current.result.experiment.mode==='compare'?ft(index===0?'warm':'cold'):`${ft('checkpoint')} ${index+1} · ×${current.result.items[index].conditions.solarScale}`;
}
function statusText():string{
 if(current.status==='working')return `${ft('busy')} · ${current.completed}/${current.total} ${ft('step')} · ${current.year} ${ft('year')}`;
 if(current.status==='error')return ft('error');
 if(current.status==='canceled')return ft('canceled');
 if(current.status==='ready')return ft(current.result.items.some(s=>!s.converged)?'unsettled':'ready');
 return ft(dirty?'changed':'idle');
}
function render(){
 el('status').textContent=statusText();el('status').dataset.status=current.status;
 el<HTMLButtonElement>('cancel').disabled=current.status!=='working';el('day-output').textContent=String(settings.day);
 const ready=current.status==='ready'&&current.result.key===feedbackKey(settings);
 el<HTMLSelectElement>('selected').disabled=!ready;
 if(current.status!=='ready'||!ready){
   el('selected').replaceChildren();el('cards').replaceChildren();el('annual').textContent=ft('empty');el('history').replaceChildren();el('diagnostics').replaceChildren();el('reading').textContent='';
   el<HTMLCanvasElement>('map').getContext('2d')?.clearRect(0,0,el<HTMLCanvasElement>('map').width,el<HTMLCanvasElement>('map').height);
   el('ramp').hidden=true;el('map-scale').textContent='';el('unsettled').hidden=true;el('extreme').hidden=true;el('proxy-off').hidden=true;el('history-card').hidden=true;return;
 }
 const r=current.result;selected=Math.min(selected,r.items.length-1);
 const choose=el<HTMLSelectElement>('selected');
 choose.replaceChildren(...r.items.map((_,i)=>new Option(label(i),String(i))));choose.value=String(selected);
 const s=r.items[selected],cards=r.experiment.mode==='compare'?r.items:[s];
 el('cards').replaceChildren(...cards.map((item,i)=>{
   const card=document.createElement('article');card.className='fb-stat';
   const heading=document.createElement('h3');heading.textContent=label(r.experiment.mode==='compare'?i:selected);
   const value=document.createElement('strong');value.textContent=`${item.mean.toFixed(2)} °C`;value.dataset.mean=String(item.mean);
   const caption=document.createElement('p');caption.className='fb-meta';caption.textContent=ft('mean');
   const ice=document.createElement('p');ice.textContent=`${ft('ice')}: ${(100*item.meanIceArea).toFixed(1)}%`;
   const years=document.createElement('p');years.className='fb-meta';years.textContent=`${item.years} ${ft(item.converged?'readyYears':'year')} · ${ft(item.converged?'periodic':'last')}`;
   card.append(heading,value,caption,ice,years);return card;
 }));
 el('reading').textContent=`${ft('thermal')} ${sampleFeedback(s,settings.latitude,settings.day).toFixed(2)} °C · ${ft('day')} ${settings.day} · ${settings.latitude}°`;
 el('unsettled').hidden=!r.items.some(v=>!v.converged);el('extreme').hidden=!r.items.some(v=>v.minimum < -60||v.maximum >60);
 el('proxy-off').hidden=settings.enabled;el('annual-note').textContent=ft(r.experiment.mode==='compare'?'annualNote':'annualPath');
 plotFeedbackAnnual(el('annual'),r,selected,settings.latitude);
 el('ramp').hidden=input('layer').value==='proxy';
 const range=plotFeedbackMap(el('map'),r,selected,settings.day,settings.latitude,input('layer').value==='proxy');el('map-scale').textContent=input('layer').value==='proxy'?ft(settings.enabled?'proxyMap':'proxyOff'):`${ft('legend')}: ${range[0].toFixed(1)} → ${range[1].toFixed(1)} · ${label(selected)}`;
 el('history-card').hidden=r.experiment.mode!=='path';if(r.experiment.mode==='path')plotFeedbackHistory(el('history'),r);
 const entries=[[ft('residual'),s.energyResidual.toExponential(3)],[ft('stepError'),s.maxStepEnergyResidual.toExponential(3)],
 [ft('cycleError'),s.periodicError.toExponential(3)],[ft('bytes'),String(feedbackBytes(r))]];
 el('diagnostics').replaceChildren(...entries.flatMap(([key,value])=>{const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=key;dd.textContent=value;return [dt,dd];}));
}
function applySettings(next:FeedbackExperiment){settings=next;selected=0;dirty=false;writeControls();client.invalidate();el('form-error').textContent='';}
function run(){
 try{settings=readControls();writeControls();dirty=false;selected=0;el('form-error').textContent='';client.run(settings);}
 catch{el('form-error').textContent=ft('invalid');}
}
function invalidate(){dirty=true;client.invalidate();}
const on=(id:string,event:string,fn:()=>void)=>el(id).addEventListener(event,fn,{signal:events.signal});
on('run','click',run);on('cancel','click',()=>client.cancel());
on('preset','change',()=>{
 const preset=input('preset').value;
 if(preset==='compare')settings={...settings,mode:'compare',multipliers:[1]};
 else settings={...settings,mode:'path',multipliers:[...(preset==='sweep'?SWEEP_PATH:MEMORY_PATH)]};
 writeControls();if(preset==='custom')input('preset').value='custom';invalidate();
});
el('science').addEventListener('input',invalidate,{signal:events.signal});
on('layer','change',render);
on('selected','change',()=>{selected=Number(input('selected').value);render();});
on('latitude','change',()=>{const value=Number(input('latitude').value);if(!input('latitude').value.trim()||!Number.isFinite(value)||Math.abs(value)>90){input('latitude').value=String(settings.latitude);return;}settings={...settings,latitude:value};render();});
on('day','input',()=>{settings={...settings,day:Number(input('day').value)};render();});
on('export','click',()=>{try{el<HTMLTextAreaElement>('json').value=feedbackFile(readControls());}catch{el('share-status').textContent=ft('invalid');}});
on('apply','click',()=>{try{const next=parseFeedbackFile(input('json').value);applySettings(next);el('share-status').textContent=ft('applied');}catch{el('share-status').textContent=ft('invalid');}});
on('link','click',()=>{void(async()=>{try{const url=new URL(location.href);url.hash=feedbackHash(readControls());url.search='';url.username='';url.password='';
 try{await navigator.clipboard.writeText(url.href);el('share-status').textContent=ft('copied');}catch{input('json').value=url.href;el('share-status').textContent=ft('copyFallback');}}catch{el('share-status').textContent=ft('invalid');}})();});
on('language','change',()=>{setFeedbackLanguage(input('language').value);translateFeedback();render();});
on('large','change',()=>{document.documentElement.dataset.large=String(input('large').checked);render();});
let frame=0;
const observer=new ResizeObserver(()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(render);});observer.observe(el('annual'));
window.addEventListener('pagehide',event=>{if(event.persisted)return;observer.disconnect();cancelAnimationFrame(frame);client.dispose();events.abort();},{signal:events.signal});
input('language').value=navigator.language.startsWith('ja')?'ja':'en';setFeedbackLanguage(input('language').value);translateFeedback();writeControls();
/** Same-document links/back-forward change only the fragment; they do not reload
 * this module. Validate before mutation and never start work from a URL. */
function restoreHash(): void {
 try {
   const restored=parseFeedbackHash(location.hash);
   if(restored){applySettings(restored);el('share-status').textContent=ft('applied');}
   else render();
 } catch {
   // Invalid links leave the accepted experiment/result intact.
   render();el('form-error').textContent=ft('invalid');el('share-status').textContent=ft('invalid');
 }
}
window.addEventListener('hashchange',restoreHash,{signal:events.signal});
restoreHash();
