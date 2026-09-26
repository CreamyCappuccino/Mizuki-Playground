import type { FeedbackExperimentResult } from './experiment';
import { sampleFeedback } from './model';
import { ft } from './i18n';
const palette=['#84e0ca','#ffb599'];
const format=(n:number)=>Number(n.toFixed(1)).toString();
function linePlot(host:HTMLElement,series:{x:number[];y:number[];name:string;dashed?:boolean}[],xLabel:string):void{
 const font=document.documentElement.dataset.large==='true'?18:15;
 const width=Math.max(260,host.clientWidth),height=290,left=52,right=width-16,top=45,bottom=height-48;
 const xs=series.flatMap(s=>s.x),ys=series.flatMap(s=>s.y);
 let xmin=Math.min(...xs),xmax=Math.max(...xs);if(xmin===xmax){xmin-=.05;xmax+=.05;}
 let ymin=Math.min(...ys),ymax=Math.max(...ys);const pad=Math.max(2,(ymax-ymin)*.08);ymin-=pad;ymax+=pad;
 const x=(v:number)=>left+(v-xmin)/Math.max(1e-8,xmax-xmin)*(right-left),y=(v:number)=>bottom-(v-ymin)/(ymax-ymin)*(bottom-top);
 let body='';
 for(let k=0;k<=4;k++){const v=ymin+(ymax-ymin)*k/4;body+=`<line x1="${left}" x2="${right}" y1="${y(v)}" y2="${y(v)}" stroke="#294355"/><text x="${left-8}" y="${y(v)+5}" text-anchor="end">${format(v)}</text>`;}
 const xticks=xLabel==='day'?[1,91,182,274,365]:[xmin,(xmin+xmax)/2,xmax];
 // Solar multipliers need precision independent of °C labels: 1.15 must not
 // be presented as 1.1, nor collapse the three ticks of a one-point history.
 const solarDecimals=Math.min(12,Math.max(2,1-Math.floor(Math.log10(Math.max(xmax-xmin,1e-12)/2))));
 for(const v of xticks)body+=`<text x="${x(v)}" y="${bottom+25}" text-anchor="middle">${xLabel==='day'?format(v):Number(v.toFixed(solarDecimals))}</text>`;
 series.forEach((s,i)=>{
  body+=`<path class="feedback-curve" d="${s.x.map((v,k)=>`${k?'L':'M'}${x(v).toFixed(2)},${y(s.y[k]).toFixed(2)}`).join(' ')}" fill="none" stroke="${palette[i%2]}" stroke-width="2.5" ${s.dashed?'stroke-dasharray="7 5"':''}/>`;
  // Name is selected from the internal dictionary, never imported user text.
  const ly=15+i*20;body+=`<line x1="${left}" x2="${left+24}" y1="${ly}" y2="${ly}" stroke="${palette[i%2]}" stroke-width="3" ${s.dashed?'stroke-dasharray="6 4"':''}/><text x="${left+31}" y="${ly+5}">${s.name}</text>`;
  if(xLabel!=='day')s.x.forEach((v,k)=>{body+=`<circle cx="${x(v)}" cy="${y(s.y[k])}" r="4" fill="${palette[i%2]}"><title>${k+1}: ${v} / ${format(s.y[k])} °C</title></circle>`;});
 });
 body+=`<text x="${(left+right)/2}" y="${height-3}" text-anchor="middle">${xLabel==='day'?ft('day'):ft('solarAxis')}</text>`;
 host.innerHTML=`<svg role="img" aria-label="${ft(xLabel==='day'?'annual':'history')}" viewBox="0 0 ${width} ${height}" style="font:${font}px system-ui,sans-serif">${body}</svg>`;
}
export function plotFeedbackAnnual(host:HTMLElement,r:FeedbackExperimentResult,index:number,latitude:number):void{
 const items=r.experiment.mode==='compare'?r.items:[r.items[index]];
 linePlot(host,items.map((s,i)=>({x:Array.from({length:365},(_,k)=>k+1),y:Array.from({length:365},(_,k)=>sampleFeedback(s,latitude,k+1)),
  name:r.experiment.mode==='compare'?ft(i===0?'warmCurve':'coldCurve'):`${ft('checkpoint')} ${index+1}`,dashed:i===1})), 'day');
}
export function plotFeedbackHistory(host:HTMLElement,r:FeedbackExperimentResult):void{
 linePlot(host,[{x:r.items.map(s=>s.conditions.solarScale),y:r.items.map(s=>s.mean),name:ft('mean')}], 'scale');
}
export function plotFeedbackMap(canvas:HTMLCanvasElement,r:FeedbackExperimentResult,index:number,day:number,latitude:number,proxy=false):[number,number]{
 const s=r.items[index],width=Math.max(260,canvas.clientWidth),height=340,dpr=Math.min(devicePixelRatio||1,2);
 canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);const ctx=canvas.getContext('2d')!;ctx.scale(dpr,dpr);
 const left=45,right=width-12,top=14,bottom=height-37;
 const low=Math.min(...r.items.map(v=>v.minimum)),high=Math.max(...r.items.map(v=>v.maximum)),span=Math.max(1,high-low);
 const raster=document.createElement('canvas');raster.width=365;raster.height=90;const rc=raster.getContext('2d')!,image=rc.createImageData(365,90);
 for(let row=0;row<90;row++)for(let d=0;d<365;d++){
   const t=(s.temperatures[d*90+89-row]-low)/span;
   const anchors=[[47,78,141],[83,187,189],[247,213,151],[224,104,72]],part=Math.min(2,Math.floor(t*3)),mix=t*3-part;
   const color=proxy?(s.conditions.enabled&&s.temperatures[d*90+89-row]<-10?[226,243,247]:[22,55,77]):anchors[part].map((v,i)=>Math.round(v+(anchors[part+1][i]-v)*mix));image.data.set([...color,255],(row*365+d)*4);
 }
 rc.putImageData(image,0,0);ctx.imageSmoothingEnabled=false;ctx.drawImage(raster,left,top,right-left,bottom-top);
 ctx.font=`${document.documentElement.dataset.large==='true'?18:15}px system-ui,sans-serif`;ctx.fillStyle='#a8b9c9';ctx.textAlign='right';
 for(const lat of [90,45,0,-45,-90])ctx.fillText(`${lat}°`,left-7,top+(90-lat)/180*(bottom-top)+5);
 ctx.textAlign='center';for(const d of [1,91,182,274,365])ctx.fillText(String(d),left+(d-1)/364*(right-left),bottom+23);
 ctx.strokeStyle='#f7fbff';ctx.lineWidth=1;ctx.setLineDash([5,4]);ctx.beginPath();
 const dx=left+(day-.5)/365*(right-left),ly=top+(90-latitude)/180*(bottom-top);
 ctx.moveTo(dx,top);ctx.lineTo(dx,bottom);ctx.moveTo(left,ly);ctx.lineTo(right,ly);ctx.stroke();
 canvas.setAttribute('aria-label',`${ft(proxy?'proxyLayer':'map')}: ${format(low)}–${format(high)} °C; ${ft('day')} ${day}; ${ft('latitude')} ${latitude}`);
 return [low,high];
}
