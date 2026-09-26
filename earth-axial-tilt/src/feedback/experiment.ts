import { FEEDBACK_MODEL, feedbackConditions, solveFeedback, type FeedbackSolution } from './model';

export interface FeedbackExperiment {
  tilt: number; depth: 2.5 | 10 | 50; eccentricity: number; perihelion: number; axis: number;
  enabled: boolean; mode: 'compare' | 'path'; seed: 'warm' | 'cold'; multipliers: number[];
  latitude: number; day: number;
}
export const DEFAULT_FEEDBACK: Readonly<FeedbackExperiment> = Object.freeze({ tilt:23.44, depth:10, eccentricity:0,
  perihelion:0, axis:0, enabled:true, mode:'compare', seed:'warm', multipliers:[1], latitude:65, day:172 });
export const MEMORY_PATH = [1, .9, 1, 1.4, 1] as const;
export const SWEEP_PATH = [1, .95, .9, .85, .9, .95, 1, 1.1, 1.2, 1.3, 1.4, 1.3, 1.2, 1.1, 1] as const;
const MAX_TEXT = 8192;
const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
export function validateFeedbackExperiment(value: unknown): FeedbackExperiment {
  if (!isRecord(value) || Object.keys(value).some(k => !Object.hasOwn(DEFAULT_FEEDBACK, k))) throw new RangeError('Invalid feedback settings.');
  const v = value as unknown as FeedbackExperiment;
  if (!['compare','path'].includes(v.mode) || !['warm','cold'].includes(v.seed) ||
      !Array.isArray(v.multipliers) || v.multipliers.length < 1 || v.multipliers.length > 17 ||
      (v.mode === 'compare' && v.multipliers.length !== 1) || !Number.isFinite(v.latitude) || Math.abs(v.latitude) > 90 ||
      !Number.isInteger(v.day) || v.day < 1 || v.day > 365) throw new RangeError('Invalid feedback settings.');
  for (const factor of v.multipliers) feedbackConditions({ tilt:v.tilt, depth:v.depth, enabled:v.enabled, solarScale:factor,
    orbit:{eccentricity:v.eccentricity,perihelion:v.perihelion,axis:v.axis} });
  const c = feedbackConditions({ tilt:v.tilt, depth:v.depth, enabled:v.enabled, solarScale:v.multipliers[0],
    orbit:{eccentricity:v.eccentricity,perihelion:v.perihelion,axis:v.axis} });
  return { tilt:c.tilt, depth:c.depth, eccentricity:c.orbit.eccentricity, perihelion:c.orbit.perihelion, axis:c.orbit.axis,
    enabled:c.enabled, mode:v.mode, seed:v.seed, multipliers:[...v.multipliers], latitude:v.latitude, day:v.day };
}
/** Scientific key includes the complete initial history; location/day only resample. */
export function feedbackKey(value: FeedbackExperiment): string {
  const v = validateFeedbackExperiment(value);
  return JSON.stringify([FEEDBACK_MODEL,v.tilt,v.depth,v.eccentricity,v.perihelion,v.axis,v.enabled,v.mode,v.seed,v.multipliers]);
}
export function feedbackFile(value: FeedbackExperiment): string {
  return JSON.stringify({application:'earth-feedbacks',version:1,model:FEEDBACK_MODEL,state:validateFeedbackExperiment(value)},null,2);
}
export function parseFeedbackFile(text: string): FeedbackExperiment {
  if (text.length > MAX_TEXT) throw new RangeError('Feedback settings are too long.');
  const v: unknown = JSON.parse(text);
  if (!isRecord(v) || v.application !== 'earth-feedbacks' || v.version !== 1 || v.model !== FEEDBACK_MODEL)
    throw new RangeError('Unsupported feedback settings version/model.');
  return validateFeedbackExperiment(v.state);
}
export function feedbackHash(value: FeedbackExperiment): string {
  return '#feedback=1&state='+encodeURIComponent(feedbackFile(value));
}
export function parseFeedbackHash(hash: string): FeedbackExperiment | null {
  if (!hash || hash === '#') return null;
  if (hash.length > MAX_TEXT * 3) throw new RangeError('Feedback link too long.');
  const p = new URLSearchParams(hash.replace(/^#/,''));
  if (p.getAll('feedback').length !== 1 || p.get('feedback') !== '1' || p.getAll('state').length !== 1 || [...p.keys()].some(k=>k!=='feedback'&&k!=='state'))
    throw new RangeError('Invalid feedback link.');
  return parseFeedbackFile(p.get('state')!);
}
export interface FeedbackExperimentResult { key: string; experiment: FeedbackExperiment; items: FeedbackSolution[]; stoppedEarly: boolean }
/** Each continued point receives the actual end-of-year phase state, not a reset seed. */
export function runFeedbackExperiment(value: FeedbackExperiment, progress?: (completed:number,total:number,year:number)=>void): FeedbackExperimentResult {
  const experiment = validateFeedbackExperiment(value), items: FeedbackSolution[] = [];
  const total = experiment.mode === 'compare' ? 2 : experiment.multipliers.length;
  for (let i = 0; i < total; i++) {
    const factor = experiment.multipliers[experiment.mode === 'compare' ? 0 : i];
    const seed = experiment.mode === 'compare' ? (i === 0 ? 'warm' : 'cold') : i === 0 ? experiment.seed : items[i-1].endState;
    progress?.(i,total,0);
    const result = solveFeedback({tilt:experiment.tilt, depth:experiment.depth, enabled:experiment.enabled, solarScale:factor,
      orbit:{eccentricity:experiment.eccentricity,perihelion:experiment.perihelion,axis:experiment.axis}}, seed,
      {onYear:year=>{if(year%5===0) progress?.(i,total,year);}});
    items.push(result); progress?.(i+1,total,result.years);
    if (!result.converged && experiment.mode === 'path') break;
  }
  return {key:feedbackKey(experiment),experiment,items,stoppedEarly:items.length<total};
}
