import { buildClimateGrid } from '../physics/energyBalance';
import { FEEDBACK_MODEL, FEEDBACK, type FeedbackSolution } from './model';
import { feedbackKey, validateFeedbackExperiment, type FeedbackExperiment, type FeedbackExperimentResult } from './experiment';

export interface FeedbackRequest { id: number; key: string; experiment: FeedbackExperiment }
export type FeedbackReply = { id: number; key: string } & (
  { status: 'progress'; completed: number; total: number; year: number } |
  { status: 'ready'; result: FeedbackExperimentResult } | { status: 'error'; error: string });
export const MAX_FEEDBACK_BYTES = 6 * 1024 * 1024;
const arrays = ['latitude','weight','temperatures','initialState','endState','dailyIceArea'] as const;
const grid = buildClimateGrid(90);
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const record = (v: unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const near = (a: number, b: number, tolerance=1e-9): boolean => Math.abs(a-b) <= tolerance;
export function feedbackRequest(id: number, value: FeedbackExperiment): FeedbackRequest {
  if (!Number.isSafeInteger(id) || id < 1) throw new RangeError('Invalid feedback request id.');
  const experiment = validateFeedbackExperiment(value);
  return {id,key:feedbackKey(experiment),experiment};
}
export function parseFeedbackRequest(value: unknown): FeedbackRequest {
  if (!record(value)) throw new RangeError('Invalid feedback request.');
  const r = feedbackRequest(value.id as number,value.experiment as FeedbackExperiment);
  if (value.key !== r.key) throw new Error('Feedback identity mismatch.');
  return r;
}
export function resultBuffers(result: FeedbackExperimentResult): ArrayBuffer[] {
  const buffers = new Set<ArrayBuffer>();
  for (const item of result.items) for (const name of arrays) buffers.add(item[name].buffer as ArrayBuffer);
  return [...buffers];
}
export function feedbackBytes(result: FeedbackExperimentResult): number {
  return resultBuffers(result).reduce((total,b)=>total+b.byteLength,0);
}
function validSolution(s: FeedbackSolution, e: FeedbackExperiment, index: number): boolean {
  const c=s.conditions, factor=e.multipliers[e.mode==='compare'?0:index];
  if(s.model!==FEEDBACK_MODEL || s.bands!==90 || s.stepsPerDay!==2 || !c || c.tilt!==e.tilt || c.depth!==e.depth ||
    c.enabled!==e.enabled || c.solarScale!==factor || !c.orbit || c.orbit.eccentricity!==e.eccentricity ||
    c.orbit.perihelion!==e.perihelion || c.orbit.axis!==e.axis) return false;
  const lengths={latitude:90,weight:90,temperatures:365*90,initialState:90,endState:90,dailyIceArea:365};
  for(const name of arrays) if(!(s[name] instanceof Float64Array) || s[name].length!==lengths[name] || !s[name].every(Number.isFinite)) return false;
  if(!s.latitude.every((v,k)=>v===grid.latitude[k]) || !s.weight.every((v,k)=>v===grid.weight[k])) return false;
  if(!Number.isInteger(s.years)||s.years<2||s.years>80 || typeof s.converged!=='boolean'||typeof s.maskRepeated!=='boolean') return false;
  if(!finite(s.periodicError)||s.periodicError<0||s.converged!==(s.periodicError<FEEDBACK.tolerance&&s.maskRepeated)) return false;
  if(!s.converged&&s.years!==80) return false;
  if(!finite(s.energyResidual)||!finite(s.maxStepEnergyResidual)||s.maxStepEnergyResidual<0||s.maxStepEnergyResidual>1e-5) return false;
  if(s.converged&&Math.abs(s.energyResidual)>1e-4) return false;
  if(!finite(s.meanIceArea)||s.meanIceArea<0||s.meanIceArea>1+1e-12||(!e.enabled&&s.meanIceArea!==0)) return false;
  let low=Infinity,high=-Infinity,mean=0;
  for(let day=0;day<365;day++) {
    let ice=0;
    for(let band=0;band<90;band++) {
      const t=s.temperatures[day*90+band]; low=Math.min(low,t);high=Math.max(high,t);mean+=t*grid.weight[band]/(2*365);
      if(e.enabled&&t<FEEDBACK.threshold) ice+=grid.weight[band]/2;
    }
    if(!near(s.dailyIceArea[day],ice,1e-12))return false;
  }
  return finite(s.mean)&&near(s.mean,mean)&&s.minimum===low&&s.maximum===high;
}
/** Full validation ONCE at worker ingress. No all-year scans in render paths. */
export function matchingFeedbackResult(value: unknown, request: FeedbackRequest): value is FeedbackExperimentResult {
  try {
    if(!record(value)||value.key!==request.key||feedbackKey(value.experiment as FeedbackExperiment)!==request.key||!Array.isArray(value.items))return false;
    const r=value as unknown as FeedbackExperimentResult, e=request.experiment, total=e.mode==='compare'?2:e.multipliers.length;
    if(r.items.length<1||r.items.length>total||r.stoppedEarly!==(r.items.length<total)||(e.mode==='compare'&&r.items.length!==2))return false;
    for(let i=0;i<r.items.length;i++) {
      const s=r.items[i]; if(!s||!validSolution(s,e,i))return false;
      if(e.mode==='path'&&i>0) {
        const prev=r.items[i-1];if(!prev.converged||!s.initialState.every((v,k)=>v===prev.endState[k]))return false;
      } else if(!s.initialState.every(v=>v===(e.mode==='compare'?(i===0?20:-60):(e.seed==='warm'?20:-60))))return false;
    }
    if(r.stoppedEarly&&r.items.at(-1)!.converged)return false;
    const bytes=feedbackBytes(r);return bytes>0&&bytes<=MAX_FEEDBACK_BYTES;
  } catch{return false;}
}
export function isFeedbackReply(v: unknown): v is FeedbackReply {
  if(!record(v)||!Number.isSafeInteger(v.id)||(v.id as number)<1||typeof v.key!=='string')return false;
  if(v.status==='error')return typeof v.error==='string';
  if(v.status==='ready')return record(v.result);
  return v.status==='progress'&&Number.isInteger(v.completed)&&Number.isInteger(v.total)&&Number.isInteger(v.year)&&
    (v.total as number)>=1&&(v.total as number)<=17&&(v.completed as number)>=0&&(v.completed as number)<=(v.total as number)&&
    (v.year as number)>=0&&(v.year as number)<=80;
}
