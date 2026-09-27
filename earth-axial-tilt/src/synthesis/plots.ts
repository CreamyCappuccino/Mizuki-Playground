import { tr, type TextKey } from './i18n';
import type { SweepResult, SweepRow } from './model';
export type Metric='solstice'|'halfMean'|'halfDays'|'halfEnergy'|'annualMean'|'globalMean';
export const unit=(m:Metric):string=>m==='halfDays'?'d':m==='halfEnergy'?'MJ/m²':'W/m²';
export const format=(n:number,digits=2):string=>Number(n.toFixed(digits)).toString();
function chart(el:HTMLElement,lines:{x:number;y:number}[][],labels:[string,string],selected?:number):void {
 const width=Math.max(300,el.clientWidth),height=300,large=document.documentElement.dataset.textSize==='large',font=large?18:15;
 const left=65,right=width-18,top=20,bottom=height-62;
 const xs=lines.flat().map(p=>p.x),ys=lines.flat().map(p=>p.y);
 let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(0,...ys),ymax=Math.max(...ys);
 if(xmin===xmax){xmin-=.5;xmax+=.5;} if(ymin===ymax)ymax=ymin+1; else ymax+=(ymax-ymin)*.05;
 const x=(v:number)=>left+(v-xmin)/(xmax-xmin)*(right-left),y=(v:number)=>bottom-(v-ymin)/(ymax-ymin)*(bottom-top);
 const ticks=width<500?3:5, parts:string[]=[];
 for(let k=0;k<ticks;k++){
  const vx=xmin+(xmax-xmin)*k/(ticks-1),vy=ymin+(ymax-ymin)*k/(ticks-1);
  parts.push(`<line x1="${left}" x2="${right}" y1="${y(vy)}" y2="${y(vy)}" class="sy-grid"/><text x="${left-8}" y="${y(vy)+font*.35}" text-anchor="end">${format(vy,1)}</text><text x="${x(vx)}" y="${bottom+font+10}" text-anchor="middle">${format(vx,3)}</text>`);
 }
 lines.forEach((line,k)=>parts.push(`<path class="sy-curve ${k?'sy-dashed':''}" d="${line.map((p,j)=>`${j?'L':'M'}${x(p.x).toFixed(3)},${y(p.y).toFixed(3)}`).join(' ')}"/>`));
 if(selected!==undefined){const p=lines[0][selected];parts.push(`<circle class="sy-point" cx="${x(p.x)}" cy="${y(p.y)}" r="6"/>`);}
 parts.push(`<text x="${(left+right)/2}" y="${height-7}" text-anchor="middle">${labels[0]}</text><text x="${left}" y="14">${labels[1]}</text>`);
 el.innerHTML=`<svg role="img" viewBox="0 0 ${width} ${height}" style="font-size:${font}px" xmlns="http://www.w3.org/2000/svg">${parts.join('')}</svg>`;
 el.querySelector('svg')!.setAttribute('aria-label',el.dataset.label??labels.join(' / '));
}
export function renderTrend(el:HTMLElement,result:SweepResult,metric:Metric):void {
 el.dataset.label=tr(metric)+' / '+tr(result.settings.parameter);
 chart(el,[result.rows.map(row=>({x:row.value,y:row[metric]}))],[result.settings.parameter==='tilt'?'ε (°)':result.settings.parameter==='eccentricity'?'e':'peri − axis (°)',unit(metric)],result.settings.selected);
}
export function renderAnnual(el:HTMLElement,a:SweepRow,b:SweepRow):void {
 el.dataset.label=tr('annualNote');
 chart(el,[a,b].map(row=>Array.from(row.daily,(v,k)=>({x:k+1,y:v}))),[tr('modelDay'),'W/m²']);
}
export function renderMap(canvas:HTMLCanvasElement,result:SweepResult):number {
 const width=Math.max(300,canvas.clientWidth),height=340,dpr=Math.min(2,window.devicePixelRatio||1);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
 const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);const left=57,right=width-14,top=25,bottom=height-57;
 const max=Math.max(1,...result.rows.flatMap(row=>Array.from(row.seasonal)));
 for(let row=0;row<result.rows.length;row++)for(let k=0;k<72;k++){
  const ratio=result.rows[row].seasonal[k]/max;
  ctx.fillStyle=`hsl(${230-200*ratio} 80% ${16+45*ratio}%)`;
  const x=left+k*(right-left)/72,y=top+row*(bottom-top)/result.rows.length;
  ctx.fillRect(x,y,(right-left)/72+.2,(bottom-top)/result.rows.length+.2);
 }
 const font=document.documentElement.dataset.textSize==='large'?17:14;
 ctx.font=`${font}px system-ui`;ctx.fillStyle='#dce9ef';ctx.textAlign='center';
 for(const angle of [0,90,180,270,360])ctx.fillText(String(angle),left+(right-left)*angle/360,bottom+24);
 ctx.fillText(tr('angle'),(left+right)/2,height-8);ctx.textAlign='right';
 for(const row of [0,Math.floor((result.rows.length-1)/2),result.rows.length-1])
  ctx.fillText(format(result.rows[row].value,2),left-8,top+(row+.5)*(bottom-top)/result.rows.length+font*.35);
 ctx.strokeStyle='#fff';ctx.lineWidth=2;
 const h=(bottom-top)/result.rows.length;
 ctx.strokeRect(left,top+result.settings.selected*h,right-left,h);
 canvas.setAttribute('aria-label',tr('atlasNote'));canvas.dataset.rows=String(result.rows.length);canvas.dataset.max=String(max);
 return max;
}
export const METRICS:readonly Metric[]=['solstice','halfMean','halfDays','halfEnergy','annualMean','globalMean'];
export function metricsCSV(result:SweepResult):string {
 const names=['parameter','value','tilt_deg','eccentricity','perihelion_azimuth_deg','axis_azimuth_deg','latitude_deg','summer_longitude_deg','reference_model_day',...METRICS.map(m=>`${m}_${unit(m)}`)];
 return [names.join(','),...result.rows.map(r=>[result.settings.parameter,r.value,r.world.tilt,r.world.eccentricity,r.world.perihelion,r.world.axis,result.settings.latitude,result.settings.summer,r.day,...METRICS.map(m=>r[m])].join(','))].join('\n')+'\n';
}
export function metricKey(m:Metric):TextKey{return m;}
