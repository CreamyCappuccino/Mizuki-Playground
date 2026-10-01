import { planetaryMomentAtSeason } from './astronomy';
import { dot, spinPole, surfaceNormal, sunDirection, type Vec3 } from './geometry';
import type { PlanetDefinition } from './definitions';

const normalize=(v:Vec3):Vec3=>{const l=Math.hypot(...v);return [v[0]/l,v[1]/l,v[2]/l];};
const cross=(a:Vec3,b:Vec3):Vec3=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const front=normalize([2,3,1.8]),right=normalize(cross([0,0,1],front)),up=cross(front,right);
const colours:Record<string,readonly [number,number,number]>={earth:[74,168,223],mars:[226,135,97],uranus:[126,220,220],mercury:[184,174,160]};
const scratch=document.createElement('canvas');scratch.width=240;scratch.height=240;
const scratchCtx=scratch.getContext('2d')!;
const normals:({v:Vec3;edge:number}|null)[]=Array.from({length:240*240},(_,i)=>{
  const x=((i%240)+.5-120)/119,y=(120-Math.floor(i/240)-.5)/119,r=x*x+y*y;
  if(r>1)return null;const z=Math.sqrt(1-r);
  return {v:[x*right[0]+y*up[0]+z*front[0],x*right[1]+y*up[1]+z*front[1],x*right[2]+y*up[2]+z*front[2]],edge:z};
});
/** Orthographic scientific sphere. All shading, markers and graticules share the
 * SAME world vectors used for the readouts. Colours are illustrative, not textures. */
export function renderWorldCanvas(canvas:HTMLCanvasElement,p:Readonly<PlanetDefinition>,ls:number,
  lat:number,lon:number,spin:number):void {
  const context=canvas.getContext('2d');if(!context)return;
  const ctx:CanvasRenderingContext2D=context;
  canvas.width=520;canvas.height=300;ctx.clearRect(0,0,520,300);
  const sun=sunDirection(ls),colour=colours[p.id],im=scratchCtx.createImageData(240,240);
  for(let i=0;i<normals.length;i++){
    const n=normals[i];if(!n)continue;
    const light=.1+.87*Math.max(0,dot(n.v,sun));
    for(let j=0;j<3;j++)im.data[4*i+j]=colour[j]*light*(.68+.32*n.edge);
    im.data[4*i+3]=255;
  }
  scratchCtx.putImageData(im,0,0);
  const cx=149,cy=150,R=112;
  const project=(v:Vec3):[number,number,number]=>[cx+R*dot(v,right),cy-R*dot(v,up),dot(v,front)];
  const pole=spinPole(p.rotation.obliquityDeg),pa=project(pole.map(v=>v*1.25) as unknown as Vec3),pb=project(pole.map(v=>-v*1.25) as unknown as Vec3);
  ctx.strokeStyle='#c6d8e9';ctx.lineWidth=2;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(pa[0],pa[1]);ctx.lineTo(pb[0],pb[1]);ctx.stroke();ctx.setLineDash([]);
  ctx.drawImage(scratch,cx-R,cy-R,R*2,R*2);
  function line(points:Vec3[],colour:string,width=1):void{
    ctx.strokeStyle=colour;ctx.lineWidth=width;ctx.beginPath();let pen=false;
    for(const v of points){const [x,y,z]=project(v);if(z<0){pen=false;continue;}if(pen)ctx.lineTo(x,y);else ctx.moveTo(x,y);pen=true;}ctx.stroke();
  }
  for(const phi of [-60,-30,0,30,60])line(Array.from({length:181},(_,i)=>surfaceNormal(p.rotation.obliquityDeg,phi,i*2,spin)),'#d3eef755');
  for(let l=0;l<360;l+=45)line(Array.from({length:91},(_,i)=>surfaceNormal(p.rotation.obliquityDeg,i*2-90,l,spin)),'#d3eef733');
  line(Array.from({length:181},(_,i)=>surfaceNormal(p.rotation.obliquityDeg,lat,i*2,spin)),'#ffcf7b',2);
  if(p.id==='uranus'){
    // Equatorial reference ring, schematic radius; not real ring dimensions.
    line(Array.from({length:181},(_,i)=>surfaceNormal(p.rotation.obliquityDeg,0,i*2,0).map(v=>v*1.35) as unknown as Vec3),'#b5dddd88',2);
  }
  ctx.fillStyle='#e6f5ff';ctx.font='bold 18px system-ui';ctx.textAlign='center';ctx.fillText('+',pa[0],pa[1]+6);ctx.fillText('−',pb[0],pb[1]+6);
  const point=project(surfaceNormal(p.rotation.obliquityDeg,lat,lon,spin));
  if(point[2]>=0){ctx.fillStyle='#fff';ctx.strokeStyle='#10192a';ctx.lineWidth=2;ctx.beginPath();ctx.arc(point[0],point[1],5,0,2*Math.PI);ctx.fill();ctx.stroke();}
  const sub=project(sun);if(sub[2]>0){ctx.strokeStyle='#ffe2a0';ctx.lineWidth=2;ctx.strokeRect(sub[0]-4,sub[1]-4,8,8);}
  // Orbit inset: Sun at focus, constant independent scale per world (not to scale across cards).
  const ox=412,oy=150,scale=76/(1+p.orbit.eccentricity);
  ctx.strokeStyle='#69899b';ctx.lineWidth=1.5;ctx.beginPath();
  for(let a=0;a<=360;a+=2){const r=planetaryMomentAtSeason(p,a).distanceAU/p.orbit.semiMajorAxisAU;
    const x=ox-r*scale*Math.cos(a*Math.PI/180),y=oy+r*scale*Math.sin(a*Math.PI/180);if(a===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
  ctx.stroke();ctx.fillStyle='#ffd089';ctx.beginPath();ctx.arc(ox,oy,7,0,2*Math.PI);ctx.fill();
  const r=planetaryMomentAtSeason(p,ls).distanceAU/p.orbit.semiMajorAxisAU;
  const x=ox-r*scale*sun[0],y=oy+r*scale*sun[1];
  ctx.strokeStyle='#f9d48b55';ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(x,y);ctx.stroke();
  ctx.fillStyle=`rgb(${colour.join(',')})`;ctx.beginPath();ctx.arc(x,y,6,0,2*Math.PI);ctx.fill();
  canvas.dataset.ls=String(ls);canvas.dataset.poleZ=String(pole[2]);canvas.dataset.spin=String(spin);
}

export function renderCurve(host:HTMLElement,curves:readonly {values:readonly number[];name:string}[],
  max:number,xmax:number,yUnit:string,cursor:number,large:boolean,min=0,xmin=0):void {
  const W=Math.max(280,host.clientWidth),H=230,L=large?68:55,T=16,B=40,R=18;
  const ns='http://www.w3.org/2000/svg';const svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('role','img');svg.setAttribute('aria-label',host.dataset.label??yUnit);
  function node(tag:string,attrs:Record<string,string|number>,text?:string):SVGElement{
    const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,String(v));if(text)n.textContent=text;svg.append(n);return n;
  }
  const y=(v:number)=>H-B-(v-min)/(max-min)*(H-B-T),x=(v:number)=>L+(v-xmin)/(xmax-xmin)*(W-L-R);
  for(let i=0;i<5;i++){const v=min+i*(max-min)/4,Y=y(v);node('line',{x1:L,y1:Y,x2:W-R,y2:Y,class:'px-grid'});
    node('text',{x:L-8,y:Y+5,'text-anchor':'end','font-size':large?17:14},`${v<10?Number(v.toFixed(2)):Math.round(v)}`);}
  for(let i=0;i<5;i++)node('text',{x:x(xmin+i*(xmax-xmin)/4),y:H-12,'text-anchor':'middle','font-size':large?17:14},String(Number((xmin+i*(xmax-xmin)/4).toFixed(2))));
  curves.forEach((c,i)=>{const path=c.values.map((v,k)=>`${k?'L':'M'}${x(xmin+k*(xmax-xmin)/(c.values.length-1)).toFixed(2)},${y(v).toFixed(2)}`).join(' ');
    const n=node('path',{d:path,class:i?'px-line px-line-b':'px-line'});const title=document.createElementNS(ns,'title');title.textContent=c.name;n.append(title);});
  if(min<0&&max>0)node('line',{x1:L,x2:W-R,y1:y(0),y2:y(0),class:'px-grid','stroke-dasharray':'4 3'});
  if(cursor>=xmin&&cursor<=xmax)node('line',{x1:x(cursor),x2:x(cursor),y1:T,y2:H-B,class:'px-cursor'});
  host.replaceChildren(svg);
}
