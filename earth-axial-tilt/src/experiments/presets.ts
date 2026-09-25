import { LOCATIONS } from '../data/locations';
import { rotationAtSolarHour } from '../physics/diurnal';
import { DEFAULT_EXPERIMENT, type ExperimentState } from './state';

type Text = readonly [english: string, japanese: string];
export interface ExperimentPreset {
  id: string; title: Text; question: Text; watch: Text;
  state: Readonly<ExperimentState>;
}
function world(overrides: Partial<ExperimentState>): Readonly<ExperimentState> {
  return Object.freeze({...DEFAULT_EXPERIMENT,...overrides});
}
const taipei=LOCATIONS.find(place=>place.id==='taipei')!;
export const EXPERIMENT_PRESETS: readonly ExperimentPreset[] = [
  { id:'polar-contrast', title:['Earth vs 90°: polar summer','23.44° 対 90°：北極の夏'],
    question:['How does tilt change polar sunlight?','傾きで北極の日射はどれだけ変わる？'],
    watch:['Compare A/B daily sunlight at the North Pole, then step to December. Both worlds share heat storage.','北極の日平均日射をA・Bで読み、12月へ進めます。二つの世界の蓄熱設定は同じです。'],
    state:world({tiltB:90,dual:true,latitude:90,longitude:0,surfaceMode:'insolation',chartMetric:'insolation',sceneView:'orbit'}) },
  { id:'zero-seasons', title:['0°: no tilt-driven seasons','0°：傾きによる季節をなくす'],
    question:['What disappears when the axis is upright?','地軸をまっすぐにすると何が変わらなくなる？'],
    watch:['Press Play year and watch daylight and the flat annual curve. This is the circular-orbit model.','「一年を再生」で昼の長さと平らな年間カーブを観察します。円軌道モデルの実験です。'],
    state:world({tilt:0,surfaceMode:'daylight',chartMetric:'daylight',sceneView:'orbit'}) },
  { id:'taipei-day', title:['Taipei: a day in sunlight','台北：一日の昼と夜'],
    question:['Why can sunlight move while the daily mean stays still?','瞬間の日射が動いても日平均が変わらないのはなぜ？'],
    watch:['Prepared at local solar noon. Press Play day; instantaneous light changes but daily-mean values do not.','太陽時の正午に準備します。「一日を再生」で瞬間の日射は変わり、日平均はそのままです。'],
    state:world({rotation:rotationAtSolarHour(taipei.longitude,172,23.44,12)??0,surfaceMode:'instant',period:'day',chartMetric:'insolation'}) },
  { id:'polar-night', title:['North Pole: winter night','北極：冬の極夜'],
    question:['Can a whole day have no direct sunlight?','一日中、直射日光が届かない場所は？'],
    watch:['Spin the Earth in December, then switch to June. At a pole the local solar clock can be undefined.','12月のまま自転させ、次に6月へ切り替えます。極では地点の太陽時が未定義になることがあります。'],
    state:world({day:353.75,latitude:90,longitude:0,surfaceMode:'instant',period:'day',chartMetric:'insolation'}) },
  { id:'thermal-fast', title:['Heat storage: fast response','蓄熱：温まりやすく冷めやすい世界'],
    question:['How high and how late is the warm-season peak?','暖かい季節の山の高さと遅れは？'],
    watch:['Inspect the annual temperature curve, then choose Slow response. These are successive experiments, not different A/B heat capacities.','年間気温カーブを見てから「遅い応答」を選びます。順番に比べる実験で、A・Bの蓄熱を別々にはしません。'],
    state:world({heatDepth:2.5,surfaceMode:'temperature',chartMetric:'temperature'}) },
  { id:'thermal-slow', title:['Heat storage: slow response','蓄熱：熱をゆっくりためる世界'],
    question:['Does more heat storage flatten and delay the peak?','蓄熱を増やすと山はなだらかになり、遅れる？'],
    watch:['Compare with Fast response. Tilt, date and location match; only the global heat capacity differs.','「速い応答」と見比べます。傾き・日付・地点は同じで、地球全体の熱容量だけを変えています。'],
    state:world({heatDepth:50,surfaceMode:'temperature',chartMetric:'temperature'}) },
  { id:'coupled-orbit', title:['Spin and orbit: a fixed axis','自転と公転：動かない軸の向き'],
    question:['How does a fixed axis make different seasons?','軸の向きが同じなのに季節が変わるのはなぜ？'],
    watch:['Press Coupled motion for both motions, or Play year for a faster season tour. The preset itself never starts playback.','同時再生で両方を動かすか、「一年を再生」で季節を速く巡ります。この設定を選ぶだけでは再生を開始しません。'],
    state:world({tiltB:90,dual:true,sceneView:'orbit',surfaceMode:'normal'}) },
];
export function findExperimentPreset(id: string): ExperimentPreset | undefined {
  return EXPERIMENT_PRESETS.find(preset=>preset.id===id);
}
