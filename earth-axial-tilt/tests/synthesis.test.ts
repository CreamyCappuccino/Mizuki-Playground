import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_SWEEP, calculateRow, validateSweep, sweepCase, sweepValue, sectorDays, type SweepSettings } from '../src/synthesis/model';
import { CLASSIC_ORBIT, orbitalMoment } from '../src/physics/orbit';
import { decodeExperiment } from '../src/experiments/state';
import { parseFeedbackHash } from '../src/feedback/experiment';
import { sweepFile, parseSweepFile, sweepHash, parseSweepHash, sweepURL } from '../src/synthesis/state';
import { earthState,earthLink,feedbackLink,RECIPES } from '../src/synthesis/bridges';
import { SweepRunner, type SweepStatus } from '../src/synthesis/runner';
import { metricsCSV } from '../src/synthesis/plots';
const settings=(v:Partial<SweepSettings>={})=>validateSweep({...DEFAULT_SWEEP,...v});
const wrap=(d:number)=>((d%360)+360)%360;
/** Independent direct solar-longitude oracle: no production inverse calendar,
 * solarDeclination/dailyMeanInsolation, or Kepler solver. */
function angleFlux(lat:number,theta:number,tilt:number,e:number,peri:number,axis:number):number {
 const rad=Math.PI/180,phi=lat*rad,delta=Math.asin(Math.sin(tilt*rad)*Math.sin(theta*rad));
 const a=Math.sin(phi)*Math.sin(delta),b=Math.cos(phi)*Math.cos(delta);
 const h=Math.abs(b)<1e-12?(a>1e-12?Math.PI:a< -1e-12?0:Math.PI/2):Math.acos(Math.max(-1,Math.min(1,-a/b)));
 const r=(1-e*e)/(1+e*Math.cos((theta+axis-peri)*rad));
 return Math.max(0,1361/(Math.PI*r*r)*(h*a+b*Math.sin(h)));
}
describe('bounded conceptual orbital sweep',()=>{
 it('samples exact endpoints, overrides only the requested parameter, and preserves background snapshots',()=>{
  for(const parameter of ['tilt','eccentricity','perihelionSeason'] as const){
   const end=parameter==='tilt'?90:parameter==='eccentricity'?.3:360;
   const s=settings({parameter,start:0,end,count:41,base:{tilt:23.44,eccentricity:.1,perihelion:50,axis:37}});
   expect(sweepValue(s,0)).toBe(0);expect(sweepValue(s,40)).toBe(end);
   const row=sweepCase(s,20);if(parameter==='perihelionSeason'){expect(row.perihelion).toBe(217);expect(row.axis).toBe(37);}else expect(row[parameter]).toBe(end/2);
   expect(s.base.perihelion).toBe(50);
  }
 });
 it.each([0,2,42,NaN,Infinity,3.5])('rejects invalid count %s before allocation',count=>{expect(()=>settings({count})).toThrow();});
 it.each([{start:5,end:5},{start:20,end:10},{latitude:91},{longitude:-181},{selected:99},{comparison:-1},{depth:8},{summer:0},{parameter:'history'},{profile:'mars'}])('rejects malformed state %j',bad=>{
  expect(()=>validateSweep({...DEFAULT_SWEEP,...bad})).toThrow();
 });
 it('rejects unknown, missing and nonfinite nested fields',()=>{
  expect(()=>validateSweep({...DEFAULT_SWEEP,epoch:12000})).toThrow();
  expect(()=>validateSweep({...DEFAULT_SWEEP,base:{...DEFAULT_SWEEP.base,axis:NaN}})).toThrow();
  const rest={...DEFAULT_SWEEP} as Record<string,unknown>;delete rest.summer;expect(()=>validateSweep(rest)).toThrow();
 });
 it('recovers reference seasonal angle and independently matches solstice and 72-bin arrays',()=>{
  for(const tilt of [0,23.44,60,90])for(const latitude of [-90,-65,0,65,90])for(const summer of [90,270] as const){
   const s=settings({latitude,summer,base:{tilt,eccentricity:.3,perihelion:127,axis:37}}),r=calculateRow(s,3);
   expect(wrap(orbitalMoment(r.day,r.world).seasonalLongitude*180/Math.PI)).toBeCloseTo(summer,9);
   expect(r.solstice).toBeCloseTo(angleFlux(latitude,summer,tilt,.3,r.world.perihelion,r.world.axis),8);
   r.seasonal.forEach((v,k)=>expect(v).toBeCloseTo(angleFlux(latitude,(k+.5)*5,tilt,.3,r.world.perihelion,r.world.axis),8));
   expect(r.quarters.reduce((sum,v)=>sum+v,0)).toBeCloseTo(365,10);
  }
 });
 it('keeps equal seasonal sectors at 91.25d on a circle; perihelion degeneracy is numeric, not just a label',()=>{
  expect(sectorDays(270,360,CLASSIC_ORBIT)).toBe(91.25);
  const s=settings({base:{...DEFAULT_SWEEP.base,eccentricity:0}}),a=calculateRow(s,0),b=calculateRow(s,6);
  expect(a.daily).toEqual(b.daily);expect(a.halfDays).toBe(182.5);expect(a.quarters).toEqual([91.25,91.25,91.25,91.25]);
 });
 it('gives stronger but shorter summer at perihelion while HALF-YEAR energy stays invariant',()=>{
  const s=settings({base:{...DEFAULT_SWEEP.base,eccentricity:.2}}),near=calculateRow(s,3),far=calculateRow(s,9);
  expect(near.solstice/far.solstice).toBeCloseTo(((1+.2)/(1-.2))**2,10);
  expect(near.halfDays).toBeLessThan(far.halfDays);expect(near.halfMean).toBeGreaterThan(far.halfMean);
  expect(near.halfEnergy).toBeCloseTo(far.halfEnergy,7);
  expect(near.halfMean*near.halfDays*.0864).toBeCloseTo(near.halfEnergy,10);
 });
 it('matches independent dense angular energy quadrature including polar day/night',()=>{
  for(const latitude of [-90,0,65,90]){
   const s=settings({latitude,base:{...DEFAULT_SWEEP.base,tilt:60,eccentricity:.3}}),r=calculateRow(s,7);
   let energy=0;const bins=7200;
   for(let k=0;k<bins;k++){const theta=(k+.5)*180/bins,nu=(theta+r.world.axis-r.world.perihelion)*Math.PI/180;
    const dt=365/2*(1-.3**2)**1.5/(1+.3*Math.cos(nu))**2/bins;
    energy+=angleFlux(latitude,theta,60,.3,r.world.perihelion,r.world.axis)*dt*.0864;}
   expect(Math.abs(r.halfEnergy-energy)).toBeLessThan(.2); // fixed 0.5° midpoint quadrature; not climate precision
  }
 });
 it('preserves relative-azimuth gauge and hemisphere symmetry, including day wrap',()=>{
  const a=calculateRow(settings({base:{tilt:60,eccentricity:.2,perihelion:100,axis:0}}),3);
  const b=calculateRow(settings({base:{tilt:60,eccentricity:.2,perihelion:173,axis:73}}),3);
  a.daily.forEach((v,k)=>expect(v).toBeCloseTo(b.daily[k],8));
  const n=calculateRow(settings({latitude:65}),3),s=calculateRow(settings({latitude:-65,summer:270}),9);
  expect(n.solstice).toBeCloseTo(s.solstice,9);expect(n.halfEnergy).toBeCloseTo(s.halfEnergy,7);
  expect(a.globalMean).toBeCloseTo(1361/(4*Math.sqrt(1-.2**2)),12);
 });
 it('does not let linked climate storage/material/longitude change sunlight',()=>{
  const a=calculateRow(settings(),3),b=calculateRow(settings({longitude:150,profile:'earth-geography',depth:50}),3);
  expect(a.daily).toEqual(b.daily);expect(a.halfEnergy).toBe(b.halfEnergy);
 });
});
describe('portable settings and cross-laboratory contracts',()=>{
 it('roundtrips with no dated epoch, and rejects unknown/duplicate/versioned inputs',()=>{
  const s=settings();expect(parseSweepFile(sweepFile(s))).toEqual(s);expect(parseSweepHash(sweepHash(s))).toEqual(s);
  expect(parseSweepHash('')).toBeNull();
  for(const hash of [sweepHash(s)+'&state=x',sweepHash(s)+'&epoch=100',sweepHash(s).replace('synthesis=1','synthesis=2'),'#'+ 'x'.repeat(30000)])expect(()=>parseSweepHash(hash)).toThrow();
  expect(()=>parseSweepFile(sweepFile(s).replace('"version": 1','"version": 2'))).toThrow();
  expect(()=>parseSweepFile(sweepFile(s).replace('"application":','"extra":true,"application":'))).toThrow();
  const url=new URL(sweepURL('https://user:password@example.org/lab/synthesis-lab.html?token=secret',s));
  expect(url.username+url.password+url.search).toBe('');expect(()=>sweepURL('javascript:foo',s)).toThrow();
 });
 it('bridges exact A/B orbital conditions with one shared day, longitude and current schema',()=>{
  const s=settings({profile:'earth-geography',longitude:121.5}),a=earthState(s),parsed=decodeExperiment(earthLink(s).split('#')[1]);
  expect(parsed.status).toBe('ok');if(parsed.status==='ok')expect(parsed.state).toEqual(a);
  expect(a.climateProfile).toBe('earth-geography');expect(a.perihelion).toBe(90);expect(a.perihelionB).toBe(270);
  expect(a.tiltB).toBe(a.tilt);expect(a.day).toBe(calculateRow(s,s.selected).day);expect(a.day).not.toBe(calculateRow(s,s.comparison).day);
  expect(a.longitude).toBe(121.5);expect(a.dual).toBe(true);
 });
 it('makes the orbit-only zonal feedback transition explicit and maps fixed material capacity',()=>{
  for(const [profile,depth] of [['idealized-land',2.5],['idealized-ocean',50],['earth-geography',10]] as const){
   const s=settings({profile}),parsed=parseFeedbackHash(feedbackLink(s).split('#')[1])!;
   expect(parsed.depth).toBe(depth);expect(parsed.latitude).toBe(65);expect(parsed.perihelion).toBe(90);expect(parsed.mode).toBe('compare');
  }
 });
 it('all seven synthesis recipes open valid existing state formats',()=>{
  expect(new Set(RECIPES.map(r=>r.id)).size).toBe(7);
  for(const r of RECIPES){const hash=r.href.slice(r.href.indexOf('#'));
   if(r.kind==='earth')expect(decodeExperiment(hash).status).toBe('ok');else expect(parseFeedbackHash(hash)).not.toBeNull();}
 });
 it('exports all actual metrics and no localized or rounded scientific values',()=>{
  const s=settings({count:3,selected:0,comparison:2}),rows=Array.from({length:3},(_,i)=>calculateRow(s,i));
  const text=metricsCSV({settings:s,rows}),lines=text.trim().split('\n');expect(lines).toHaveLength(4);
  expect(text).toContain(String(rows[0].halfEnergy));expect(text).toContain('halfEnergy_MJ/m²');
 });
});
describe('bounded cooperative runner',()=>{
 afterEach(()=>vi.useRealTimers());
 it('yields each row, cancels without automatic restart, and discards superseded work',()=>{
  vi.useFakeTimers();const states:SweepStatus[]=[],compute=vi.fn(calculateRow),runner=new SweepRunner(s=>states.push(s),compute);
  runner.run(settings());expect(compute).not.toHaveBeenCalled();runner.cancel();vi.runAllTimers();expect(states.at(-1)?.status).toBe('canceled');
  runner.run(settings());runner.run(settings({count:3,selected:0,comparison:2}));vi.runAllTimers();
  expect(compute).toHaveBeenCalledTimes(3);const last=states.at(-1)!;expect(last.status).toBe('ready');if(last.status==='ready')expect(last.result.rows).toHaveLength(3);
  runner.dispose();runner.run(settings());vi.runAllTimers();expect(compute).toHaveBeenCalledTimes(3);
 });
 it('surfaces failures and releases all timers; invalid requests are atomic',()=>{
  vi.useFakeTimers();const states:SweepStatus[]=[],runner=new SweepRunner(s=>states.push(s),()=>{throw new Error('fixture failure');});
  runner.run(settings());expect(()=>runner.run({...settings(),count:Infinity})).toThrow();vi.runAllTimers();
  expect(states.at(-1)?.status).toBe('error');expect(vi.getTimerCount()).toBe(0);runner.dispose();
 });
});

describe('standalone surface integrity',()=>{
 it('has unique HTML ids and complete bilingual static labels',async()=>{
  const {readFileSync}=await import('node:fs');const {TEXT}=await import('../src/synthesis/i18n');
  const html=readFileSync(new URL('../synthesis-lab.html',import.meta.url),'utf8');
  const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);expect(new Set(ids).size).toBe(ids.length);
  for(const m of html.matchAll(/data-sy="([^"]+)"/g)){expect(Object.hasOwn(TEXT,m[1])).toBe(true);const pair=TEXT[m[1] as keyof typeof TEXT];expect(pair[0].length>0&&pair[1].length>0).toBe(true);}
 });
});
