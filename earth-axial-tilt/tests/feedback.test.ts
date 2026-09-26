import { describe,it,expect,vi,afterEach } from 'vitest';
import { buildClimateGrid, solveSeasonalClimate, planetaryAlbedo } from '../src/physics/energyBalance';
import { feedbackAlbedo, feedbackStepper, solveFeedback, sampleFeedback } from '../src/feedback/model';
import { DEFAULT_FEEDBACK, MEMORY_PATH, feedbackKey, feedbackFile, feedbackHash, parseFeedbackFile, parseFeedbackHash, validateFeedbackExperiment, runFeedbackExperiment } from '../src/feedback/experiment';
import { feedbackRequest, matchingFeedbackResult, feedbackBytes, MAX_FEEDBACK_BYTES } from '../src/feedback/protocol';
import { FeedbackClient,type FeedbackWorker } from '../src/feedback/client';
import type { FeedbackRequest } from '../src/feedback/protocol';
const c={tilt:23.44,depth:10 as const,orbit:{eccentricity:0,perihelion:0,axis:0},enabled:true,solarScale:1};
const e=()=>validateFeedbackExperiment(DEFAULT_FEEDBACK);

describe('explicit ice-albedo scheme and history',()=>{
 it('defines cold strictly below the proxy threshold, not water freezing',()=>{
   expect(feedbackAlbedo(-10-1e-8,0,true)).toBe(.62);
   expect(feedbackAlbedo(-10,0,true)).toBe(planetaryAlbedo(0));
   expect(feedbackAlbedo(-60,0,false)).toBe(planetaryAlbedo(0));
   expect(()=>feedbackAlbedo(NaN,0,true)).toThrow();
 });
 it.each(['warm','cold'] as const)('matches analytical D=0 backward-Euler solution on %s branch',seed=>{
   const grid=buildClimateGrid(12,0), start=seed==='warm'?20:-60, q=new Float64Array(12).fill(340);
   let old:Float64Array=new Float64Array(12).fill(start), next:Float64Array=new Float64Array(12);
   const advance=feedbackStepper(grid,10,2,true);
   for(let n=0;n<500;n++){expect(advance(old,q,next).energyError).toBeLessThan(1e-9);[old,next]=[next,old];}
   for(let i=0;i<12;i++){
     const alpha=feedbackAlbedo(start,grid.x[i],true), eq=((1-alpha)*340-210)/2;
     const expected=eq+(start-eq)/(1+2*43200/4e7)**500;
     expect(Math.abs(old[i]-expected)).toBeLessThan(1e-10);
   }
 });
 it('is order-preserving across the albedo jump and conserves step energy',()=>{
   const grid=buildClimateGrid(), advance=feedbackStepper(grid,10,2,true);
   const low=Float64Array.from(grid.x,x=>-12+8*x), high=Float64Array.from(low,t=>t+5);
   const q=Float64Array.from(grid.x,x=>300+100*x), a=new Float64Array(90),b=new Float64Array(90);
   expect(advance(low,q,a).energyError).toBeLessThan(1e-8);expect(advance(high,q,b).energyError).toBeLessThan(1e-8);
   expect(a.every((t,i)=>t<=b[i]+1e-12)).toBe(true);
   expect(()=>advance(low,q,low)).toThrow();
 });
 it('has distinct repeating warm/cold states at the same forcing',()=>{
   const warm=solveFeedback(c,'warm'),cold=solveFeedback(c,'cold');
   expect(warm.converged&&cold.converged).toBe(true);expect(warm.maskRepeated&&cold.maskRepeated).toBe(true);
   expect(warm.mean).toBeCloseTo(11.9196243,5);expect(cold.mean).toBeCloseTo(-40.3492638,5);
   expect(warm.meanIceArea).toBeCloseTo(.1231932,5);expect(cold.meanIceArea).toBeCloseTo(1,10);
   expect(warm.periodicError).toBeLessThan(1e-6);expect(Math.abs(cold.energyResidual)).toBeLessThan(1e-5);
   expect(sampleFeedback(warm,65,366)).toBe(sampleFeedback(warm,65,1));
   expect(sampleFeedback(warm,90,1)).toBe(warm.temperatures[89]);
   expect(()=>sampleFeedback(warm,NaN,1)).toThrow();
 },15000);
 it('with feedback off reaches unchanged Classic despite opposite initial states',()=>{
   const old=solveSeasonalClimate(23.44,10);
   for(const seed of ['warm','cold'] as const){
     const s=solveFeedback({...c,enabled:false},seed);
     let error=0;for(let i=0;i<s.temperatures.length;i++)error=Math.max(error,Math.abs(s.temperatures[i]-old.temperatures[i]));
     expect(error).toBeLessThan(1e-5);expect(s.meanIceArea).toBe(0);
   }
 },15000);
 it('retains actual day-1 state through repeated-forcing history',()=>{
   const result=runFeedbackExperiment({...e(),mode:'path',multipliers:[...MEMORY_PATH]});
   expect(result.items).toHaveLength(5);expect(result.stoppedEarly).toBe(false);
   for(let i=1;i<5;i++)expect(result.items[i].initialState).toEqual(result.items[i-1].endState);
   expect(result.items[0].mean).toBeGreaterThan(10);expect(result.items[2].mean).toBeLessThan(-30);
   expect(result.items[4].mean).toBeGreaterThan(10);
 },20000);
 it('reports the finite-bound last year as unsettled; input seed is immutable',()=>{
   const seed=new Float64Array(90).fill(20),before=seed.slice(),s=solveFeedback(c,seed,{maxYears:2});
   expect(s.converged).toBe(false);expect(s.years).toBe(2);expect(s.periodicError).toBeGreaterThan(1e-6);expect(seed).toEqual(before);
   expect(()=>solveFeedback(c,'warm',{maxYears:81})).toThrow();expect(()=>solveFeedback({...c,solarScale:2},'warm')).toThrow();
 });
});

describe('bounded portable feedback identity',()=>{
 it('roundtrips full scientific history without storing cached fields',()=>{
   const v={...e(),mode:'path' as const,multipliers:[...MEMORY_PATH],seed:'cold' as const};
   expect(parseFeedbackFile(feedbackFile(v))).toEqual(v);expect(parseFeedbackHash(feedbackHash(v))).toEqual(v);
   expect(feedbackFile(v)).not.toContain('temperatures');expect(parseFeedbackHash('')).toBeNull();
 });
 it('keys seed and full path but not viewing coordinates',()=>{
   const v=e();expect(feedbackKey(v)).toBe(feedbackKey({...v,latitude:0,day:1}));
   expect(feedbackKey(v)).not.toBe(feedbackKey({...v,seed:'cold'}));
   expect(feedbackKey({...v,mode:'path',multipliers:[1,.9,1]})).not.toBe(feedbackKey({...v,mode:'path',multipliers:[1,1.4,1]}));
 });
 it.each([null,{}, {...DEFAULT_FEEDBACK,enabled:'yes'}, {...DEFAULT_FEEDBACK,tilt:NaN}, {...DEFAULT_FEEDBACK,day:0},
   {...DEFAULT_FEEDBACK,multipliers:new Array(18).fill(1)}, {...DEFAULT_FEEDBACK,multipliers:[.6]}, {...DEFAULT_FEEDBACK,extra:true}])('rejects malformed experiment %#',v=>{
   expect(()=>validateFeedbackExperiment(v)).toThrow();
 });
 it('rejects unknown envelope and duplicate hash keys without partially applying',()=>{
   expect(()=>parseFeedbackFile(feedbackFile(e()).replace('"version": 1','"version": 2'))).toThrow();
   expect(()=>parseFeedbackHash(feedbackHash(e())+'&feedback=1')).toThrow();
   expect(()=>parseFeedbackFile('x'.repeat(8193))).toThrow();
 });
});
class FakeWorker implements FeedbackWorker{
 onmessage:FeedbackWorker['onmessage']=null;onerror:FeedbackWorker['onerror']=null;terminated=false;request!:FeedbackRequest;
 postMessage(v:FeedbackRequest){this.request=v;}terminate(){this.terminated=true;}
 reply(v:unknown){this.onmessage?.({data:v} as MessageEvent<unknown>);}
}
describe('transactional worker ingress and lifetime',()=>{
 afterEach(()=>vi.useRealTimers());
 it('validates actual complete arrays, mask summaries, seeds, history and fixed grid',()=>{
   const experiment=e(),request=feedbackRequest(1,experiment),result=runFeedbackExperiment(experiment);
   expect(matchingFeedbackResult(result,request)).toBe(true);expect(feedbackBytes(result)).toBeLessThan(MAX_FEEDBACK_BYTES);
   const original=result.items[0].weight;result.items[0].weight=new Float64Array(1);expect(matchingFeedbackResult(result,request)).toBe(false);result.items[0].weight=original;
   result.items[0].initialState[0]=21;expect(matchingFeedbackResult(result,request)).toBe(false);result.items[0].initialState[0]=20;
   result.items[0].dailyIceArea[0]+=.1;expect(matchingFeedbackResult(result,request)).toBe(false);
 },15000);
 it('stops on malformed replies, ignores obsolete replies and never silently retries cancel',()=>{
   const workers:FakeWorker[]=[];const client=new FeedbackClient(()=>{},()=>{const w=new FakeWorker();workers.push(w);return w;});
   client.run(e());workers[0].reply(null);expect(client.state.status).toBe('error');expect(workers[0].terminated).toBe(true);
   client.run(e());client.cancel();expect(client.state.status).toBe('canceled');expect(workers[1].terminated).toBe(true);
   workers[1].reply({...workers[1].request,status:'error',error:'late'});expect(client.state.status).toBe('canceled');
   client.run(e());client.invalidate();expect(client.state.status).toBe('idle');client.dispose();
 });
 it('absolute timeout includes progress; supersede and dispose release timers',()=>{
   vi.useFakeTimers();const workers:FakeWorker[]=[];const client=new FeedbackClient(()=>{},()=>{const w=new FakeWorker();workers.push(w);return w;},100);
   client.run(e());vi.advanceTimersByTime(99);const r=workers[0].request;
   workers[0].reply({id:r.id,key:r.key,status:'progress',completed:0,total:2,year:10});vi.advanceTimersByTime(1);
   expect(client.state.status).toBe('error');expect(vi.getTimerCount()).toBe(0);
   client.run(e());client.run({...e(),tilt:60});expect(workers[1].terminated).toBe(true);expect(vi.getTimerCount()).toBe(1);
   client.dispose();expect(vi.getTimerCount()).toBe(0);
 });
 it('invalid new settings do not discard the current request',()=>{
   const w=new FakeWorker(),client=new FeedbackClient(()=>{},()=>w);client.run(e());
   expect(()=>client.run({...e(),tilt:NaN})).toThrow();expect(w.terminated).toBe(false);client.dispose();
 });
});

describe('feedback workspace static contract',()=>{
 it('uses unique HTML ids and complete typed translation keys',async()=>{
   const {readFileSync}=await import('node:fs'),{en}=await import('../src/feedback/i18n');
   const html=readFileSync(new URL('../feedback-lab.html',import.meta.url),'utf8');
   const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]);
   expect(new Set(ids).size).toBe(ids.length);
   for(const key of [...html.matchAll(/data-fb="([^"]+)"/g)].map(m=>m[1]))expect(Object.hasOwn(en,key),key).toBe(true);
 });
});

describe('feedback numerical edge cases',()=>{
 it('zero sunlight has an exact damped response even while the proxy changes branch',()=>{
   const grid=buildClimateGrid(12,0),advance=feedbackStepper(grid,10,2,true),initial=20;
   let old:Float64Array=new Float64Array(12).fill(initial),next:Float64Array=new Float64Array(12);const q=new Float64Array(12);
   for(let i=0;i<1000;i++){expect(advance(old,q,next).energyError).toBeLessThan(1e-9);[old,next]=[next,old];}
   const expected=-105+(initial+105)/(1+2*43200/4e7)**1000;
   expect(old.every(t=>Math.abs(t-expected)<1e-10)).toBe(true);expect(old[0]).toBeLessThan(-10);
 });
 it('does not accept a mismatched path end-state or changed science reply',()=>{
   const value={...e(),mode:'path' as const,multipliers:[1,1]},r=runFeedbackExperiment(value),request=feedbackRequest(1,value);
   expect(matchingFeedbackResult(r,request)).toBe(true);r.items[1].initialState[0]+=.1;expect(matchingFeedbackResult(r,request)).toBe(false);
   expect(matchingFeedbackResult(null,request)).toBe(false);
 });
});


describe('production-bound unsettled history',()=>{
 it('retains the 80th year as unsettled and stops instead of inventing the next equilibrium',()=>{
   const value={...e(),depth:50 as const,mode:'path' as const,multipliers:[.92,1]};
   const result=runFeedbackExperiment(value),request=feedbackRequest(1,value);
   expect(result.items).toHaveLength(1);expect(result.stoppedEarly).toBe(true);
   expect(result.items[0].years).toBe(80);expect(result.items[0].converged).toBe(false);
   expect(result.items[0].maxStepEnergyResidual).toBeLessThan(1e-5);
   expect(matchingFeedbackResult(result,request)).toBe(true);
 });
});
