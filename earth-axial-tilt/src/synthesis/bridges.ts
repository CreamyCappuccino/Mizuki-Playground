import { DEFAULT_EXPERIMENT, encodeExperiment, validateExperiment, type ExperimentState } from '../experiments/state';
import { DEFAULT_FEEDBACK, feedbackHash, MEMORY_PATH } from '../feedback/experiment';
import { dayAtSeasonalLongitude } from '../physics/orbit';
import { validateSweep, sweepCase, caseOrbit, type SweepSettings } from './model';

/** A/B use ONE shared model day: select A's season; B is not silently moved
 * to its own solstice. Selected latitude/longitude and material are shared. */
export function earthState(input:SweepSettings):ExperimentState {
  const s=validateSweep(input),a=sweepCase(s,s.selected),b=sweepCase(s,s.comparison);
  const value={...DEFAULT_EXPERIMENT,tilt:a.tilt,tiltB:b.tilt,
    eccentricity:a.eccentricity,perihelion:a.perihelion,axisAzimuth:a.axis,
    eccentricityB:b.eccentricity,perihelionB:b.perihelion,axisAzimuthB:b.axis,
    day:dayAtSeasonalLongitude(s.summer,caseOrbit(a)),latitude:s.latitude,longitude:s.longitude,
    dual:true,sceneView:'orbit' as const,surfaceMode:'insolation' as const,chartMetric:'insolation' as const,
    climateProfile:s.profile,heatDepth:s.depth};
  const clean=validateExperiment(value);if(!clean)throw new RangeError('Invalid Earth bridge.');return clean;
}
export function earthLink(s:SweepSettings):string{return './index.html'+encodeExperiment(earthState(s));}
/** Explicit orbit-only bridge: destination is zonal, NOT geographic feedback.
 * Round its display day because feedback settings accept integer model days. */
export function feedbackLink(input:SweepSettings):string {
  const s=validateSweep(input),a=sweepCase(s,s.selected);
  const depth=s.profile==='idealized-land'?2.5:s.profile==='idealized-ocean'?50:s.depth;
  return './feedback-lab.html'+feedbackHash({...DEFAULT_FEEDBACK,...a,depth,
    latitude:s.latitude,day:Math.min(365,Math.floor(dayAtSeasonalLongitude(s.summer,caseOrbit(a))))});
}
type Text=readonly[string,string];
export interface SynthesisRecipe { id:string; title:Text; lesson:Text; href:string; kind:'earth'|'feedback' }
const link=(v:Partial<ExperimentState>)=>'./index.html'+encodeExperiment({...DEFAULT_EXPERIMENT,...v});
/** A curated route through existing models, not another climate calculation. */
export const RECIPES:readonly SynthesisRecipe[]=[
 {id:'baseline',title:['Earth-like baseline','地球に近い条件から'],lesson:['23.44° and e=0.0167. A teaching configuration, not today’s ephemeris.','23.44°・e=0.0167。教材条件で、今日の天文暦ではありません。'],href:link({eccentricity:.0167,perihelion:283}),kind:'earth'},
 {id:'tilt',title:['No tilt vs a sideways Earth','傾きゼロと横倒しの地球'],lesson:['Hold the circular orbit fixed; compare 0° with 90°.','円軌道を固定し、0°と90°を比べます。'],href:link({tilt:0,tiltB:90,dual:true,surfaceMode:'insolation',chartMetric:'insolation',sceneView:'orbit',latitude:65,longitude:0}),kind:'earth'},
 {id:'perihelion',title:['Summer near or far from the Sun?','夏の太陽は近い？ 遠い？'],lesson:['Same tilt and e=0.2, opposite perihelion seasons. Shared model day, not two separate solstices.','傾きとe=0.2は同じ、近日点の季節が逆。共通のモデル日で比較します。'],href:link({eccentricity:.2,eccentricityB:.2,perihelion:90,perihelionB:270,tiltB:23.44,dual:true,sceneView:'orbit',surfaceMode:'insolation',chartMetric:'insolation',latitude:65,longitude:0}),kind:'earth'},
 {id:'materials',title:['Why does the ocean lag?','海の季節はなぜ遅れる？'],lesson:['Idealized land/ocean change heat capacity only. The dashed curve is the other material, not Earth B.','理想化した陸と海で熱容量だけを変更。破線は別の素材で、Earth Bではありません。'],href:link({climateProfile:'idealized-land',latitude:45,longitude:0,surfaceMode:'temperature'}),kind:'earth'},
 {id:'geography',title:['Same latitude, different longitude','同じ緯度、違う経度'],lesson:['Use the real 10° land-fraction cells; inspect the annual curve and selected-longitude Atlas.','実海陸の10°セル。年間曲線と選択経度のAtlasを見比べます。'],href:link({climateProfile:'earth-geography',latitude:45,longitude:105,surfaceMode:'temperature'}),kind:'earth'},
 {id:'warm-cold',title:['One Sun, two climates','同じ太陽、二つの気候'],lesson:['Zonal90 warm/cold seeds with ice-albedo feedback. Not 2D geographic feedback.','緯度90帯で暖冷初期状態を比較。実海陸2Dのfeedbackではありません。'],href:'./feedback-lab.html'+feedbackHash({...DEFAULT_FEEDBACK}),kind:'feedback'},
 {id:'history',title:['Does climate remember?','気候は過去を覚える？'],lesson:['Follow 1 → 0.9 → 1 → 1.4 → 1 solar forcing, carrying the actual final state forward.','日射倍率1→0.9→1→1.4→1。直前の計算結果を次へ引き継ぎます。'],href:'./feedback-lab.html'+feedbackHash({...DEFAULT_FEEDBACK,mode:'path',multipliers:[...MEMORY_PATH]}),kind:'feedback'},
];
