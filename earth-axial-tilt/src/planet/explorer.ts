import './explorer.css';
import { PLANETS, getPlanetDefinition, type PlanetId } from './definitions';
import { planetaryMomentAtSeason, wrapDegrees } from './astronomy';
import { illumination, seasonAtElapsed, seasonSeries, worldDefinition } from './geometry';
import { DEFAULT_EXPLORER, explorerFile, explorerURL, parseExplorerFile, parseExplorerHash, validateExplorer, type ExplorerState } from './explorerState';
import { renderCurve, renderWorldCanvas } from './explorerVisuals';

const $=<T extends HTMLElement>(id:string):T=>{const n=document.getElementById('px-'+id);if(!n)throw new Error('Missing '+id);return n as T;};
const input=(id:string)=>$<HTMLInputElement>(id),select=(id:string)=>$<HTMLSelectElement>(id);
const events=new AbortController();
const on=(id:string,ev:string,fn:()=>void)=>$(id).addEventListener(ev,fn,{signal:events.signal});
let state=validateExplorer(DEFAULT_EXPLORER),lang:'en'|'ja'='en',large=false,playing=false,disposed=false;
let raf=0,last=0,lastPaint=0,notice:'input'|'link'|null=null;
let seriesKey='',curves:ReturnType<typeof seasonSeries>[]=[];
try{lang=localStorage.getItem('planet-lab-language')==='ja'?'ja':'en';large=localStorage.getItem('earth-lab:text-size')==='large';}catch{/* optional storage */}
const tr=(en:string,ja:string)=>lang==='ja'?ja:en;
const fmt=(x:number,d=2)=>Number(x.toFixed(d)).toLocaleString(lang==='ja'?'ja-JP':'en-US',{maximumFractionDigits:d});
function translate():void{
  document.documentElement.lang=lang;document.documentElement.dataset.pxLarge=String(large);
  document.querySelectorAll<HTMLElement>('[data-en]').forEach(n=>{n.textContent=(lang==='ja'?n.dataset.ja:n.dataset.en)??'';});
  $('play').textContent=playing?tr('Pause','一時停止'):tr('Play this clock','この時計で再生');
}
for(const side of ['a','b'])for(const p of Object.values(PLANETS))select(side).add(new Option(p.name,p.id));
function controls():void{
  for(const side of ['a','b'] as const){select(side).value=state[side].id;input('custom-'+side).checked=state[side].tilt!==null;
    input('tilt-'+side).value=String(state[side].tilt??getPlanetDefinition(state[side].id).rotation.obliquityDeg);input('tilt-'+side).disabled=state[side].tilt===null;}
  for(const k of ['season','days','latitude','longitude'] as const)input(k).value=String(state[k]);
  select('clock').value=state.clock;input('season').disabled=state.clock!=='season';input('days').disabled=state.clock!=='elapsed';
}
function number(id:string):number{if(!input(id).value.trim())throw new RangeError('Empty field');return input(id).valueAsNumber;}
function read():ExplorerState{
  return validateExplorer({version:1,a:{id:select('a').value,tilt:input('custom-a').checked?number('tilt-a'):null},
    b:{id:select('b').value,tilt:input('custom-b').checked?number('tilt-b'):null},
    clock:select('clock').value,season:number('season'),days:number('days'),latitude:number('latitude'),longitude:number('longitude')});
}
function showNotice():void{
  $('notice').textContent=notice===null?'':notice==='input'?tr('Invalid input. The last accepted experiment is still shown.','入力値を確認してください。直前の有効な実験を表示しています。'):
    tr('Invalid link/settings. The last accepted experiment is still shown.','リンク・設定が不正です。直前の有効な実験を表示しています。');
}
function metrics(side:'a'|'b'):void{
  const choice=state[side],p=worldDefinition(choice),ls=state.clock==='season'?state.season:seasonAtElapsed(p,state.days);
  // Seasonal inspection holds spin fixed; elapsed mode advances the actual sidereal spin.
  const spin=state.clock==='elapsed'?wrapDegrees(360*24*state.days/p.rotation.siderealDayHours):0;
  const m=planetaryMomentAtSeason(p,ls),v=illumination(p,ls,state.latitude,state.longitude,spin);
  const card=$('world-'+side),heading=card.querySelector('h2')!;
  heading.textContent=p.name+(choice.tilt!==null?tr(' · modified','・仮想'): '');
  const canvas=$<HTMLCanvasElement>('canvas-'+side);canvas.setAttribute('aria-label',`${p.name}: ${fmt(ls)}° Ls, ${fmt(v.declination)}° declination`);
  renderWorldCanvas(canvas,p,ls,state.latitude,state.longitude,spin);
  const rows:[string,string,string][]=[
    [tr('Spin-axis tilt','自転軸の傾き'),fmt(p.rotation.obliquityDeg)+'°','tilt'],
    [tr('Orbital direction of spin','公転に対する自転方向'),p.rotation.obliquityDeg>90?tr('Retrograde','逆行'):p.rotation.obliquityDeg===90?tr('Sideways','横倒し'):tr('Prograde','順行'),'direction'],
    [tr('Sun distance','太陽までの距離'),fmt(m.distanceAU,4)+' AU','distance'],
    [tr('Ray-normal solar flux','太陽光に垂直な面の日射'),fmt(m.irradianceWm2,2)+' W/m²','flux'],
    [tr('Sun above latitude','太陽直下の緯度'),fmt(v.declination)+'°','declination'],
    [tr('Lit fraction · orbit frozen','明るい割合・軌道固定'),fmt(v.rotationFraction*100)+'%','fraction'],
    [tr('Orbital year','公転周期'),fmt(p.orbit.yearEarthDays)+' '+tr('Earth d','地球日'),'year'],
    [tr('Sidereal rotation','恒星に対する自転周期'),fmt(p.rotation.siderealDayHours,4)+' '+tr('Earth h','地球時間'),'rotation'],
    [tr('Seasonal angle Ls','季節角Ls'),fmt(ls)+'°','season'],
    [tr('Spring → this orbital phase','春からこの公転位相まで'),fmt(m.elapsedEarthDays)+' '+tr('Earth d','地球日'),'phaseDays'],
  ];
  const parent=card.querySelector('.px-metrics')!;parent.replaceChildren();
  for(const [label,value,key] of rows){const a=document.createElement('div');a.className='px-metric';a.dataset.metric=key;const l=document.createElement('span'),n=document.createElement('strong');l.textContent=label;n.textContent=value;a.append(l,n);parent.append(a);}
  card.querySelector('.px-capability')!.textContent=p.id==='earth'?tr('Astronomy here. Earth climate remains in the original 3D Lab.','この画面は天文比較。Earthの気候実験は元の3D Labに残しています。'):
    tr('No temperature model. Geometry does not predict weather or habitability.','温度モデルは未提供。照明の形から天気や居住可能性は予測しません。');
}
function plot():void{
  const key=JSON.stringify([state.a,state.b,state.latitude]);
  if(key!==seriesKey){curves=[seasonSeries(worldDefinition(state.a),state.latitude),seasonSeries(worldDefinition(state.b),state.latitude)];seriesKey=key;}
  const cursor=state.clock==='season'?state.season:seasonAtElapsed(worldDefinition(state.a),state.days);
  renderCurve($('fraction'),curves.map((c,i)=>({values:c.map(v=>v.fraction*100),name:i?'World B':'World A'})),100,360,'%',cursor,large);
  const max=Math.max(1,...curves.flatMap(c=>c.map(v=>v.mean)))*1.05;
  renderCurve($('energy'),curves.map((c,i)=>({values:c.map(v=>v.mean),name:i?'World B':'World A'})),max,360,'W/m²',cursor,large);
}
function render():void{
  if(disposed)return;metrics('a');metrics('b');plot();
  input('timeline').max=state.clock==='season'?'360':'100000';input('timeline').step=state.clock==='season'?'.1':'.01';
  input('timeline').value=String(state.clock==='season'?state.season:state.days);
  $('timeline-label').textContent=state.clock==='season'?`Ls ${fmt(state.season)}°`:`${fmt(state.days)} ${tr('Earth days','地球日')}`;
  $('clock-note').textContent=state.clock==='season'?
    tr('Same season angle, different elapsed time. Spin is held still. Playback browses 20° of Ls per second.','同じ季節角で比較し、経過日数は惑星ごとに異なります。自転は固定。再生は1秒にLsを20°進めます。'):
    tr('Shared elapsed time from each world’s own spring, not a common real date. Coupled spin and orbit; 10 Earth days per second. Graph cursor follows A’s Ls.','各世界の春を起点に同じ経過時間で比較。実際の同時刻ではありません。自転と公転を連動し、1秒に地球10日。グラフの縦線はAのLsです。');
  $('play').setAttribute('aria-pressed',String(playing));$('play').textContent=playing?tr('Pause','一時停止'):tr('Play this clock','この時計で再生');showNotice();
}
function pause():void{playing=false;cancelAnimationFrame(raf);raf=0;last=0;}
function adopt(next:ExplorerState,writeURL=false):void{
  pause();state=validateExplorer(next);notice=null;controls();if(writeURL)history.replaceState(null,'',new URL(explorerURL(location.href,state)).hash);render();
}
function edit():void{
  pause();try{const next=read();state=next;notice=null;for(const s of ['a','b'])input('tilt-'+s).disabled=!input('custom-'+s).checked;
    input('season').disabled=state.clock!=='season';input('days').disabled=state.clock!=='elapsed';history.replaceState(null,'',new URL(explorerURL(location.href,state)).hash);
    if(input('url').value)$('share-status').textContent=tr('The saved link is a snapshot. Create it again for these settings.','リンクは作成時の状態です。現在の設定では作り直してください。');render();
  }catch{notice='input';showNotice();$('play').setAttribute('aria-pressed','false');$('play').textContent=tr('Play this clock','この時計で再生');}
}
for(const id of ['a','b','clock','custom-a','custom-b','tilt-a','tilt-b','season','days','latitude','longitude'])on(id,'change',()=>{
  if(id==='a'||id==='b'){input('custom-'+id).checked=false;input('tilt-'+id).value=String(getPlanetDefinition(select(id).value as PlanetId).rotation.obliquityDeg);}edit();
});
on('timeline','input',()=>{const value=number('timeline');adopt({...state,...(state.clock==='season'?{season:value}:{days:value})},true);});
document.querySelectorAll<HTMLButtonElement>('[data-ls]').forEach(b=>b.addEventListener('click',()=>adopt({...state,clock:'season',season:Number(b.dataset.ls)},true),{signal:events.signal}));
document.querySelectorAll<HTMLButtonElement>('[data-recipe]').forEach(b=>b.addEventListener('click',()=>{
  const preset=b.dataset.recipe;adopt({...DEFAULT_EXPLORER,
    a:{id:'earth',tilt:preset==='sideways'?90:null},b:{id:preset==='equal'?'earth':preset==='mars'?'mars':'uranus',tilt:null},
    latitude:preset==='mars'?25:65},true);
},{signal:events.signal}));
function tick(now:number):void{
  if(!playing||disposed)return;
  const dt=last?Math.min(.1,(now-last)/1000):0;last=now;
  state={...state,...(state.clock==='season'?{season:(state.season+20*dt)%360}:{days:Math.min(100000,state.days+10*dt)})};
  if(now-lastPaint>70){input('season').value=String(state.season);input('days').value=String(state.days);render();lastPaint=now;}
  if(state.clock==='elapsed'&&state.days===100000){pause();render();return;}raf=requestAnimationFrame(tick);
}
on('play','click',()=>{if(playing){pause();history.replaceState(null,'',new URL(explorerURL(location.href,state)).hash);}else{try{state=read();notice=null;playing=true;last=0;raf=requestAnimationFrame(tick);}catch{notice='input';}}render();});
select('language').value=lang;input('large').checked=large;
on('language','change',()=>{lang=select('language').value==='ja'?'ja':'en';try{localStorage.setItem('planet-lab-language',lang);}catch{/* optional */}translate();render();});
on('large','change',()=>{large=input('large').checked;try{localStorage.setItem('earth-lab:text-size',large?'large':'comfortable');}catch{/* optional */}translate();render();});
function saveFile(name:string,text:string,type:string):void{
  const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),0);
}
on('share','click',()=>{try{state=read();notice=null;input('url').value=explorerURL(location.href,state);$('share-status').textContent=tr('Link ready. No playback or personal display preferences are imported.','リンク作成済み。再生や個人の表示設定は読み込みません。');}catch{notice='input';showNotice();}});
on('copy','click',()=>{void navigator.clipboard?.writeText(input('url').value).then(()=>{$('share-status').textContent=tr('Copied.','コピーしました。');}).catch(()=>{$('share-status').textContent=tr('Select and copy the URL manually.','URLを選択してコピーしてください。');});});
on('save','click',()=>{try{const text=explorerFile(read());$<HTMLTextAreaElement>('json').value=text;saveFile('planet-experiment.json',text,'application/json');}catch{notice='input';showNotice();}});
on('load','click',()=>{try{adopt(parseExplorerFile($<HTMLTextAreaElement>('json').value),true);}catch{notice='link';showNotice();}});
function restore():void{try{adopt(parseExplorerHash(location.hash)??validateExplorer(DEFAULT_EXPLORER));}catch{notice='link';showNotice();}}
window.addEventListener('hashchange',restore,{signal:events.signal});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();render();}},{signal:events.signal});
const observer=new ResizeObserver(()=>{if(!disposed)plot();});observer.observe($('fraction'));observer.observe($('energy'));
window.addEventListener('pagehide',e=>{pause();if(e.persisted){render();return;}disposed=true;events.abort();observer.disconnect();},{signal:events.signal});
controls();translate();render();restore();
