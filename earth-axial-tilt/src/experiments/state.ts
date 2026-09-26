import type { OrbitParameters } from '../physics/orbit';
import { DEFAULT_LOCATION, LOCATIONS, type LocationPreset } from '../data/locations';
import type { AppClimateProfile } from '../physics/climateGeography';

/** Public experiment data only. No playback, language, camera pose or user identity. */
export interface ExperimentState {
  eccentricity:number; perihelion:number; axisAzimuth:number;
  eccentricityB:number; perihelionB:number; axisAzimuthB:number;
  tilt: number;
  tiltB: number;
  day: number;
  rotation: number;
  latitude: number;
  longitude: number;
  dual: boolean;
  surfaceMode: 'normal' | 'instant' | 'insolation' | 'daylight' | 'temperature';
  temperatureModel: 'energy-balance' | 'illustrative';
  climateProfile: AppClimateProfile;
  heatDepth: 2.5 | 10 | 50;
  sceneView: 'earth' | 'orbit';
  period: 'year' | 'day';
  chartMetric: 'temperature' | 'insolation' | 'daylight';
  reference: boolean;
  guides: boolean;
  speed: 1 | 4 | 12;
}
export const EXPERIMENT_VERSION = 4;
export const MAX_EXPERIMENT_LENGTH = 4096;
export const DEFAULT_EXPERIMENT: Readonly<ExperimentState> = Object.freeze({
  eccentricity:0,perihelion:0,axisAzimuth:0,eccentricityB:0,perihelionB:0,axisAzimuthB:0,
  tilt: 23.44, tiltB: 90, day: 172, rotation: 0,
  latitude: DEFAULT_LOCATION.latitude, longitude: DEFAULT_LOCATION.longitude,
  dual: false, surfaceMode: 'normal', temperatureModel: 'energy-balance', climateProfile: 'classic', heatDepth: 10,
  sceneView: 'earth', period: 'year', chartMetric: 'temperature', reference: false,
  guides: true, speed: 1,
});
const KEYS: Record<keyof ExperimentState, string> = {
  eccentricity:'e',perihelion:'peri',axisAzimuth:'axis',eccentricityB:'be',perihelionB:'bperi',axisAzimuthB:'baxis',
  tilt: 'a', tiltB: 'b', day: 'day', rotation: 'spin', latitude: 'lat', longitude: 'lon',
  dual: 'dual', surfaceMode: 'layer', temperatureModel: 'model', climateProfile: 'geo', heatDepth: 'heat',
  sceneView: 'view', period: 'period', chartMetric: 'chart', reference: 'ref', guides: 'guides', speed: 'speed',
};
const ORBIT_FIELDS = new Set<keyof ExperimentState>(['eccentricity','perihelion','axisAzimuth','eccentricityB','perihelionB','axisAzimuthB']);
const GEOGRAPHY_FIELDS = new Set<keyof ExperimentState>(['climateProfile']);
const OWNED_KEYS = new Set(['lab', ...Object.values(KEYS)]);
export type ExperimentParse =
  | { status: 'none' }
  | { status: 'error'; reason: 'version' | 'invalid' | 'too-long' }
  | { status: 'ok'; state: ExperimentState };

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function numberIn(value: unknown, low: number, high: number, exclusiveHigh = false): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= low && (exclusiveHigh ? value < high : value <= high);
}
/** Build only known fields. Reject invalid owned fields atomically; never Object.assign untrusted data. */
export function validateExperiment(value: unknown, version = EXPERIMENT_VERSION): ExperimentState | null {
  if (!record(value)) return null;
  const field = <K extends keyof ExperimentState>(key: K): unknown =>
    Object.prototype.hasOwnProperty.call(value, key) ? value[key] : DEFAULT_EXPERIMENT[key];
  const eccentricity=field('eccentricity'),eccentricityB=field('eccentricityB');
  const perihelion=field('perihelion'),perihelionB=field('perihelionB'),axisAzimuth=field('axisAzimuth'),axisAzimuthB=field('axisAzimuthB');
  if(!numberIn(eccentricity,0,.3)||!numberIn(eccentricityB,0,.3)||!numberIn(perihelion,0,360)||!numberIn(perihelionB,0,360)||!numberIn(axisAzimuth,0,360)||!numberIn(axisAzimuthB,0,360))return null;
  const tilt=field('tilt'), tiltB=field('tiltB'), day=field('day'), rotation=field('rotation');
  const latitude=field('latitude'), longitude=field('longitude'), heatDepth=field('heatDepth'), speed=field('speed');
  const dual=field('dual'), reference=field('reference'), guides=field('guides');
  const surfaceMode=field('surfaceMode'), temperatureModel=field('temperatureModel'), climateProfile=field('climateProfile'), sceneView=field('sceneView');
  const period=field('period'), chartMetric=field('chartMetric');
  if (!numberIn(tilt,0,90) || !numberIn(tiltB,0,90) || !numberIn(day,1,366,true) || !numberIn(rotation,0,360) ||
      !numberIn(latitude,-90,90) || !numberIn(longitude,-180,180) ||
      ![2.5,10,50].includes(heatDepth as number) || ![1,4,12].includes(speed as number) ||
      typeof dual!=='boolean' || typeof reference!=='boolean' || typeof guides!=='boolean' ||
      !['normal','instant','insolation','daylight','temperature'].includes(surfaceMode as string) ||
      !['energy-balance','illustrative'].includes(temperatureModel as string) ||
      !['classic','idealized-land','idealized-ocean', ...(version === 4 ? ['earth-geography'] : [])].includes(climateProfile as string) ||
      (temperatureModel==='illustrative' && climateProfile!=='classic') || !['earth','orbit'].includes(sceneView as string) ||
      !['year','day'].includes(period as string) || !['temperature','insolation','daylight'].includes(chartMetric as string)) return null;
  // A partial coordinate pair is not a meaningful replacement for the selected place.
  if (Object.hasOwn(value,'latitude') !== Object.hasOwn(value,'longitude')) return null;
  return { eccentricity,eccentricityB,perihelion:perihelion%360,perihelionB:perihelionB%360,axisAzimuth:axisAzimuth%360,axisAzimuthB:axisAzimuthB%360, tilt, tiltB, day, rotation: rotation===360?0:rotation, latitude, longitude,
    heatDepth:heatDepth as ExperimentState['heatDepth'], speed:speed as ExperimentState['speed'], dual, reference, guides,
    surfaceMode:surfaceMode as ExperimentState['surfaceMode'], temperatureModel:temperatureModel as ExperimentState['temperatureModel'],
    climateProfile:climateProfile as ExperimentState['climateProfile'],
    sceneView:sceneView as ExperimentState['sceneView'], period:period as ExperimentState['period'], chartMetric:chartMetric as ExperimentState['chartMetric'] };
}

export function encodeExperiment(state: ExperimentState): string {
  const clean=validateExperiment(state);
  if (!clean) throw new RangeError('Invalid experiment state');
  const params=new URLSearchParams({lab:String(EXPERIMENT_VERSION)});
  for (const key of Object.keys(KEYS) as (keyof ExperimentState)[]) {
    const value=clean[key]; params.set(KEYS[key],typeof value==='boolean' ? (value?'1':'0') : String(value));
  }
  return `#${params}`;
}

export function decodeExperiment(hash: string): ExperimentParse {
  if (hash.length > MAX_EXPERIMENT_LENGTH) return {status:'error',reason:'too-long'};
  const params=new URLSearchParams(hash.startsWith('#')?hash.slice(1):hash);
  if (!params.has('lab')) return {status:'none'};
  for (const key of OWNED_KEYS) if (params.getAll(key).length>1) return {status:'error',reason:'invalid'};
  if (!['1','2','3',String(EXPERIMENT_VERSION)].includes(params.get('lab')!)) return {status:'error',reason:'version'};
  const version=params.get('lab')!;
  const data: Record<string,unknown>={};
  for (const key of Object.keys(KEYS) as (keyof ExperimentState)[]) {
    if(version==='1'&&ORBIT_FIELDS.has(key))continue;
    if(Number(version)<3&&GEOGRAPHY_FIELDS.has(key))continue;
    const input=params.get(KEYS[key]); if(input===null)continue;
    const fallback=DEFAULT_EXPERIMENT[key];
    if (typeof fallback==='boolean') {
      if(input!=='1'&&input!=='0')return {status:'error',reason:'invalid'};
      data[key]=input==='1';
    } else if(typeof fallback==='number') {
      if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(input)) return {status:'error',reason:'invalid'};
      data[key]=Number(input);
    } else data[key]=input;
  }
  const state=validateExperiment(data, Number(version));
  return state ? {status:'ok',state} : {status:'error',reason:'invalid'};
}

export function experimentLocation(state: ExperimentState): LocationPreset {
  const known=LOCATIONS.find(place=>place.latitude===state.latitude&&place.longitude===state.longitude);
  return known ? {...known} : {id:'custom',name:'Custom point',latitude:state.latitude,longitude:state.longitude};
}

/** Drop arbitrary search parameters, credentials and the previous hash before sharing. */
export function experimentURL(base: string, state: ExperimentState): string {
  const url=new URL(base);
  if (!['http:','https:'].includes(url.protocol)) throw new TypeError('Unsupported application URL');
  url.username=''; url.password=''; url.search=''; url.hash=encodeExperiment(state);
  return url.href;
}

export function experimentFile(state: ExperimentState): string {
  const clean=validateExperiment(state); if(!clean)throw new RangeError('Invalid experiment state');
  return JSON.stringify({application:'earth-axial-tilt',version:EXPERIMENT_VERSION,state:clean},null,2)+'\n';
}
export function decodeExperimentFile(text: string): ExperimentParse {
  if(text.length>MAX_EXPERIMENT_LENGTH)return {status:'error',reason:'too-long'};
  try {
    const value:unknown=JSON.parse(text);
    if(!record(value)||value.application!=='earth-axial-tilt')return {status:'error',reason:'invalid'};
    if(value.version!==1&&value.version!==2&&value.version!==3&&value.version!==EXPERIMENT_VERSION)return {status:'error',reason:'version'};
    let data=value.state;
    if(value.version<3&&record(data))data=Object.fromEntries(Object.entries(data).filter(([key])=>
      !(value.version===1&&ORBIT_FIELDS.has(key as keyof ExperimentState))&&!GEOGRAPHY_FIELDS.has(key as keyof ExperimentState)));
    const state=validateExperiment(data, value.version as number);
    return state ? {status:'ok',state} : {status:'error',reason:'invalid'};
  } catch { return {status:'error',reason:'invalid'}; }
}

/** Explicit astronomy settings for one world. Old schema1 restores the exact circular baseline. */
export function experimentOrbit(state:ExperimentState,side:'A'|'B'='A'):OrbitParameters {
  return side==='A'?{eccentricity:state.eccentricity,perihelion:state.perihelion,axis:state.axisAzimuth}
    :{eccentricity:state.eccentricityB,perihelion:state.perihelionB,axis:state.axisAzimuthB};
}
