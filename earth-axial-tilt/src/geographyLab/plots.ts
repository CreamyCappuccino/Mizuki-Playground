import type { GeographyClimateSolution } from '../physics/geographyClimate';
import { geographyAnnualTemperatures, geographyCell, geographyLongitudeSlice, geographyMaterial,
  sampleGeographyCell } from '../physics/geographySampling';
import type { GeographyExperiment } from '../experiments/geographyExperiment';
import { t } from './i18n';

export interface PlotBounds { left:number; right:number; top:number; bottom:number; width:number; height:number; }

function prepare(canvas: HTMLCanvasElement) {
  const width = Math.max(1, canvas.clientWidth), height = Math.max(1, canvas.clientHeight);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable.');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.fillStyle = '#091522'; ctx.fillRect(0, 0, width, height);
  const font = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  ctx.font = `${font}px system-ui`; ctx.fillStyle = '#c3d1e0';
  const b: PlotBounds = { left: Math.max(48, font * 3), right: width - 14, top: 24,
    bottom: height - font * 2.35, width, height };
  return { ctx, b, font };
}
function mix(a:number[], b:number[], v:number): string {
  return `rgb(${a.map((x, i) => Math.round(x + (b[i] - x) * v)).join(',')})`;
}
function colour(value:number, kind:'temperature'|'difference'|'land', bound:number): string {
  const u = Math.min(1, Math.max(0, kind === 'land' ? value :
    kind === 'temperature' ? (value + 100) / 280 : (value + bound) / (2 * bound)));
  if (kind === 'land') return mix([16,59,92], [199,157,101], u);
  return u < .5 ? mix([34,83,146], [224,233,230], u * 2) : mix([224,233,230], [193,61,48], u * 2 - 1);
}
function labelAxes(ctx:CanvasRenderingContext2D, b:PlotBounds, xTicks:[number,string][], yTicks:[number,string][]) {
  ctx.fillStyle = '#c3d1e0'; ctx.strokeStyle = '#36506a'; ctx.lineWidth = 1;
  ctx.strokeRect(b.left, b.top, b.right - b.left, b.bottom - b.top);
  for (const [u, text] of xTicks) {
    ctx.textAlign = u === 0 ? 'left' : u === 1 ? 'right' : 'center';
    ctx.fillText(text, b.left + u * (b.right - b.left), b.height - 8);
  }
  ctx.textAlign = 'right';
  for (const [v, text] of yTicks) ctx.fillText(text, b.left - 6, b.top + v * (b.bottom - b.top) + 5);
}
function marker(ctx:CanvasRenderingContext2D, x:number, y:number) {
  ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#ef4444'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#ffffff'; ctx.stroke();
}
export function clearPlot(canvas:HTMLCanvasElement): void {
  const {ctx,b}=prepare(canvas); ctx.textAlign='center'; ctx.fillStyle='#c3d1e0'; ctx.fillText('—',b.width/2,b.height/2);
}
export function differenceBound(current:GeographyClimateSolution, reference:GeographyClimateSolution|null): number {
  if (!reference || reference.temperatures.length !== current.temperatures.length) return 1;
  let bound=1;
  for(let i=0;i<current.temperatures.length;i++) bound=Math.max(bound,Math.abs(current.temperatures[i]-reference.temperatures[i]));
  return Math.ceil(bound);
}

export function renderMap(
  canvas:HTMLCanvasElement, current:GeographyClimateSolution, reference:GeographyClimateSolution|null,
  state:GeographyExperiment, bound:number,
): PlotBounds {
  const {ctx,b}=prepare(canvas),g=current.grid;
  const dx=(b.right-b.left)/g.nlon, dy=(b.bottom-b.top)/g.nlat;
  for(let row=0;row<g.nlat;row++) for(let column=0;column<g.nlon;column++) {
    const index=row*g.nlon+column;
    const value=state.layer==='land' ? current.landFraction[index] :
      state.layer==='difference' && reference ? sampleGeographyCell(current,index,state.day)-sampleGeographyCell(reference,index,state.day) :
      sampleGeographyCell(current,index,state.day);
    ctx.fillStyle=colour(value,state.layer,bound);
    ctx.fillRect(b.left+column*dx,b.top+(g.nlat-1-row)*dy,dx+.5,dy+.5);
  }
  labelAxes(ctx,b,[[0,'180°W'],[.5,'0°'],[1,'180°E']],[[0,'90°N'],[.5,'0°'],[1,'90°S']]);
  const cell=geographyCell(g,state.latitude,state.longitude);
  const x=b.left+(cell.column+.5)/g.nlon*(b.right-b.left);
  const y=b.top+(g.nlat-.5-cell.row)/g.nlat*(b.bottom-b.top);
  marker(ctx,x,y);
  canvas.setAttribute('aria-label',`${t('Geographic field')} · ${state.layer} · ${t('day')} ${state.day}`);
  return b;
}

export function renderAnnual(
  canvas:HTMLCanvasElement, current:GeographyClimateSolution, reference:GeographyClimateSolution|null,
  state:GeographyExperiment,
): {mean:number;minimum:number;maximum:number} {
  const {ctx,b}=prepare(canvas),a=geographyAnnualTemperatures(current,state.latitude,state.longitude);
  const other=reference?geographyAnnualTemperatures(reference,state.latitude,state.longitude):null;
  let lo=Math.min(...a),hi=Math.max(...a);
  if(other){lo=Math.min(lo,...other);hi=Math.max(hi,...other);}
  const padding=Math.max(1,(hi-lo)*.09);lo-=padding;hi+=padding;
  const x=(d:number)=>b.left+d/364*(b.right-b.left),y=(v:number)=>b.bottom-(v-lo)/(hi-lo)*(b.bottom-b.top);
  const path=(values:Float64Array,dashed:boolean)=>{
    ctx.strokeStyle=dashed?'#f3bb82':'#72d4e6';ctx.lineWidth=dashed?2:2.6;ctx.setLineDash(dashed?[7,5]:[]);ctx.beginPath();
    values.forEach((v,i)=>{if(i===0)ctx.moveTo(x(i),y(v));else ctx.lineTo(x(i),y(v));});ctx.stroke();ctx.setLineDash([]);
  };
  if(other)path(other,true);path(a,false);
  labelAxes(ctx,b,[[0,'1'],[.5,'183'],[1,'365']],[[0,hi.toFixed(0)],[.5,((lo+hi)/2).toFixed(0)],[1,lo.toFixed(0)]]);
  ctx.fillStyle='#c3d1e0';ctx.textAlign='left';ctx.fillText('°C',b.left,17);
  const selected=sampleGeographyCell(current,geographyCell(current.grid,state.latitude,state.longitude).index,state.day);
  marker(ctx,x((state.day-1)%365),y(selected));
  const mean=a.reduce((sum,v)=>sum+v,0)/365;
  canvas.setAttribute('aria-label',`${t('Annual response at the selected cell')} · ${t('Annual mean')} ${mean.toFixed(2)} °C · ${Math.min(...a).toFixed(2)}…${Math.max(...a).toFixed(2)} °C`);
  return {mean,minimum:Math.min(...a),maximum:Math.max(...a)};
}

export function renderAtlas(
  canvas:HTMLCanvasElement, current:GeographyClimateSolution, reference:GeographyClimateSolution|null,
  state:GeographyExperiment, bound:number,
): PlotBounds {
  const {ctx,b}=prepare(canvas),g=current.grid;
  const currentSlice=state.layer==='land'?null:geographyLongitudeSlice(current,state.longitude);
  const referenceSlice=state.layer==='difference'&&reference?geographyLongitudeSlice(reference,state.longitude):null;
  const column=geographyCell(g,0,state.longitude).column;
  const dx=(b.right-b.left)/365,dy=(b.bottom-b.top)/g.nlat;
  for(let row=0;row<g.nlat;row++) for(let day=0;day<365;day++) {
    const offset=row*365+day;
    const value=state.layer==='land'?current.landFraction[row*g.nlon+column]:
      referenceSlice?currentSlice![offset]-referenceSlice[offset]:currentSlice![offset];
    ctx.fillStyle=colour(value,state.layer,bound);
    ctx.fillRect(b.left+day*dx,b.top+(g.nlat-1-row)*dy,dx+.5,dy+.5);
  }
  labelAxes(ctx,b,[[0,'1'],[.5,'183'],[1,'365']],[[0,'90°N'],[.5,'0°'],[1,'90°S']]);
  const cell=geographyCell(g,state.latitude,state.longitude);
  marker(ctx,b.left+(state.day-1)/364*(b.right-b.left),b.top+(g.nlat-.5-cell.row)/g.nlat*(b.bottom-b.top));
  canvas.setAttribute('aria-label',`${t('Selected-longitude season atlas')} · ${cell.longitude.toFixed(1)}° · ${state.layer}`);
  return b;
}

export function selectedMaterial(solution:GeographyClimateSolution,state:GeographyExperiment) {
  return geographyMaterial(solution,geographyCell(solution.grid,state.latitude,state.longitude));
}
