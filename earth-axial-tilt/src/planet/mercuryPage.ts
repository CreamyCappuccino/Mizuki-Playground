import './explorer.css';
import { DEFAULT_MERCURY,mercuryMoment,mercurySeries,mercuryHash,mercuryURL,parseMercuryHash,validateMercury,mercuryCSV,type MercurySettings } from './mercury';
import { renderWorldCanvas,renderCurve } from './explorerVisuals';
const $=<T extends HTMLElement>(id:string)=>document.getElementById('mc-'+id) as T;
const inp=(id:string)=>$<HTMLInputElement>(id);
let state=validateMercury(DEFAULT_MERCURY),lang='en',large=false,playing=false,disposed=false,raf=0,last=0,paint=0,problem=false;
let series:ReturnType<typeof mercurySeries>=[],seriesKey='',zoom=false;
const events=new AbortController();
const on=(id:string,event:string,fn:()=>void)=>$(id).addEventListener(event,fn,{signal:events.signal});
try{lang=localStorage.getItem('planet-lab-language')==='ja'?'ja':'en';large=localStorage.getItem('earth-lab:text-size')==='large';}catch{/* optional */}
const tr=(en:string,ja:string)=>lang==='ja'?ja:en,fmt=(v:number,n=3)=>Number(v.toFixed(n)).toLocaleString(lang==='ja'?'ja-JP':'en-US',{maximumFractionDigits:n});
function translate():void{document.documentElement.lang=lang;document.documentElement.dataset.pxLarge=String(large);document.querySelectorAll<HTMLElement>('[data-en]').forEach(n=>{n.textContent=(lang==='ja'?n.dataset.ja:n.dataset.en)??'';});}
function controls():void{for(const k of ['cycles','latitude','longitude','eccentricity'] as const)inp(k).value=String(state[k]);}
function read():MercurySettings{
  const n=(k:string)=>{if(!inp(k).value.trim())throw new RangeError('Empty');return inp(k).valueAsNumber;};
  return validateMercury({version:1,cycles:n('cycles'),latitude:n('latitude'),longitude:n('longitude'),eccentricity:n('eccentricity')});
}
function error():void{$('error').textContent=problem?tr('Invalid input or link. Last accepted experiment retained.','入力・リンクが不正です。直前の有効な実験を保持しています。'):'';}
function plot():void{
  const key=JSON.stringify([state.latitude,state.longitude,state.eccentricity,zoom]);
  if(seriesKey!==key){series=zoom?Array.from({length:401},(_,i)=>mercuryMoment({...state,cycles:.9+i*.2/400})):mercurySeries(state);seriesKey=key;}
  const vals=series.map(x=>x.sunBodyLongitude),els=series.map(x=>x.elevationDeg),lo=zoom?.9:0,hi=zoom?1.1:2;
  renderCurve($('motion'),[{values:vals,name:'Sun'}],zoom?Math.max(...vals)+.15:10,hi,'degrees',state.cycles,large,zoom?Math.min(...vals)-.15:-370,lo);
  renderCurve($('elevation'),[{values:els,name:'Sun elevation'}],zoom?Math.max(...els)+.15:90,hi,'degrees',state.cycles,large,zoom?Math.min(...els)-.15:-90,lo);
  $('motion').dataset.window=zoom?'perihelion':'full';

}
function render():void{
  if(disposed)return;const m=mercuryMoment(state);
  renderWorldCanvas($<HTMLCanvasElement>('canvas'),m.planet,m.seasonalLongitude,state.latitude,state.longitude,m.spinDegrees);
  $('canvas').dataset.cycles=String(state.cycles);$('canvas').dataset.turns=String(m.spinTurns);
  const rows:[string,string,string][]=[
    [tr('Elapsed time','経過時間'),fmt(m.earthDays)+' '+tr('Earth d','地球日'),'days'],
    [tr('Orbit / spin turns','公転 / 自転回数'),fmt(m.cycles)+' / '+fmt(m.spinTurns),'turns'],
    [tr('Sidereal rotation period','恒星に対する自転周期'),fmt(m.planet.rotation.siderealDayHours/24)+' '+tr('Earth d','地球日'),'sidereal'],
    [tr('Mean solar day · 2 orbits','平均太陽日・2公転'),fmt(m.planet.rotation.solarDayHours/24)+' '+tr('Earth d','地球日'),'solar'],
    [tr('Apparent Sun drift','太陽の見かけの移動速度'),fmt(m.apparentRateDegPerDay,4)+' °/'+tr('Earth d','地球日'),'rate'],
    [tr('Sun elevation here','この地点の太陽高度'),fmt(m.elevationDeg,2)+'°','elevation'],
    [tr('Instant horizontal TOA','この瞬間の水平面TOA日射'),fmt(m.instantWm2,1)+' W/m²','instant'],
    [tr('Sun distance','太陽までの距離'),fmt(m.distanceAU,5)+' AU','distance'],
  ];
  $('metrics').replaceChildren(...rows.map(([label,value,key])=>{const d=document.createElement('div');d.className='px-metric';d.dataset.metric=key;const a=document.createElement('span'),b=document.createElement('strong');a.textContent=label;b.textContent=value;d.append(a,b);return d;}));
  $('direction').dataset.reversing=String(m.reversing);
  $('direction').textContent=m.reversing?tr('Reversal: the apparent Sun is moving back.','反転中：見かけの太陽が戻っています。'):tr('Usual direction: spin is overtaking the apparent Sun.','通常の方向：自転が見かけの太陽を追い越しています。');
  if(zoom&&(state.cycles<.9||state.cycles>1.1))zoom=false;
  inp('timeline').min=zoom?'.9':'0';inp('timeline').max=zoom?'1.1':'2';
  inp('timeline').value=String(state.cycles);$('position').textContent=fmt(state.cycles,4)+' '+tr('orbital cycles','公転周回')+' · '+fmt(m.earthDays)+' '+tr('Earth days','地球日');
  $('play').textContent=playing?tr('Pause','一時停止'):tr('Play · one orbit / 20 s','再生・1公転を20秒で');$('play').setAttribute('aria-pressed',String(playing));
  if(inp('url').value)$('share-status').textContent=inp('url').value===mercuryURL(location.href,state)?tr('Link matches this state.','この状態のリンクです。'):tr('Snapshot of earlier settings. Create the link again.','前の設定のリンクです。作り直してください。');
  error();plot();
}
function pause():void{playing=false;cancelAnimationFrame(raf);last=0;}
function adopt(next:MercurySettings,link=true):void{pause();state=validateMercury(next);problem=false;controls();if(link)history.replaceState(null,'',mercuryHash(state));render();}
for(const k of ['cycles','latitude','longitude','eccentricity'])on(k,'change',()=>{pause();try{adopt(read());}catch{problem=true;render();}});
on('timeline','input',()=>adopt({...state,cycles:inp('timeline').valueAsNumber}));
document.querySelectorAll<HTMLButtonElement>('[data-cycle]').forEach(b=>b.addEventListener('click',()=>adopt({...state,cycles:Number(b.dataset.cycle)}),{signal:events.signal}));
on('native','click',()=>{zoom=false;adopt({...DEFAULT_MERCURY});});
on('circle','click',()=>{zoom=false;adopt({...state,eccentricity:0,cycles:0});});
on('horizon','click',()=>{zoom=true;adopt({...DEFAULT_MERCURY,cycles:.94,longitude:90});});
on('full','click',()=>{zoom=false;render();});
function tick(now:number):void{if(!playing||disposed)return;const dt=last?Math.min(.1,(now-last)/1000):0;last=now;state={...state,cycles:Math.min(2,state.cycles+dt/20)};
  if(now-paint>70){inp('cycles').value=String(state.cycles);render();paint=now;}if(state.cycles===2){pause();history.replaceState(null,'',mercuryHash(state));render();return;}raf=requestAnimationFrame(tick);}
on('play','click',()=>{if(playing){pause();history.replaceState(null,'',mercuryHash(state));}else{try{state=read();problem=false;if(state.cycles===2)state={...state,cycles:0};playing=true;last=0;raf=requestAnimationFrame(tick);}catch{problem=true;}}render();});
$<HTMLSelectElement>('language').value=lang;inp('large').checked=large;
on('language','change',()=>{lang=$<HTMLSelectElement>('language').value==='ja'?'ja':'en';try{localStorage.setItem('planet-lab-language',lang);}catch{/* optional */}translate();render();});
on('large','change',()=>{large=inp('large').checked;try{localStorage.setItem('earth-lab:text-size',large?'large':'comfortable');}catch{/* optional */}translate();render();});
on('share','click',()=>{try{adopt(read());inp('url').value=mercuryURL(location.href,state);render();}catch{problem=true;error();}});
on('copy','click',()=>{void (async()=>{try{if(!inp('url').value)throw new Error('No link');await navigator.clipboard.writeText(inp('url').value);$('share-status').textContent=tr('Copied.','コピーしました。');}catch{inp('url').focus();inp('url').select();$('share-status').textContent=tr('Create a link and copy the selected URL manually.','リンクを作成し、選択したURLを手動でコピーしてください。');}})();});
on('csv','click',()=>{try{const text=mercuryCSV(read());const url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='mercury-two-orbits.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}catch{problem=true;error();}});
function restore():void{try{adopt(parseMercuryHash(location.hash)??DEFAULT_MERCURY,false);}catch{pause();problem=true;render();}}
window.addEventListener('hashchange',restore,{signal:events.signal});document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();render();}},{signal:events.signal});
const observer=new ResizeObserver(()=>{if(!disposed)plot();});observer.observe($('motion'));observer.observe($('elevation'));
window.addEventListener('pagehide',e=>{pause();if(e.persisted){render();return;}disposed=true;events.abort();observer.disconnect();},{signal:events.signal});
controls();translate();restore();
