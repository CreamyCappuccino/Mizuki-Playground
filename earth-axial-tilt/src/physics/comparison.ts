import { dailyMeanInsolation, dayLengthHours } from './solar';
import { temperatureFromSource, type TemperatureSource } from './temperatureModel';
export interface ComparisonRow { key: 'daylight' | 'solar' | 'temperature'; a: number | null; b: number | null; difference: number | null }
export function compareMeasurements(a: TemperatureSource, b: TemperatureSource, latitude: number, day: number): ComparisonRow[] {
  if (a.model !== b.model || a.depth !== b.depth) throw new RangeError('Comparison requires the same model and heat storage.');
  const row = (key: ComparisonRow['key'], x: number | null, y: number | null): ComparisonRow => ({ key, a: x, b: y,
    difference: x === null || y === null ? null : x - y });
  return [row('daylight', dayLengthHours(latitude,day,a.tilt),dayLengthHours(latitude,day,b.tilt)),
    row('solar', dailyMeanInsolation(latitude,day,a.tilt),dailyMeanInsolation(latitude,day,b.tilt)),
    row('temperature',temperatureFromSource(a,latitude,day),temperatureFromSource(b,latitude,day))];
}
export interface ComparisonViewport { x: number; y: number; width: number; height: number; side: 'A' | 'B' }
/** Top-origin CSS pixel rectangles. Scissor converts Y only at the WebGL boundary. */
export function comparisonViewports(width: number, height: number, enabled: boolean): ComparisonViewport[] {
  if (![width,height].every(v=>Number.isFinite(v)&&v>0)) return [];
  if (!enabled) return [{x:0,y:0,width,height,side:'A'}];
  return width < 760
    ? [{x:0,y:0,width,height:height/2,side:'A'},{x:0,y:height/2,width,height:height/2,side:'B'}]
    : [{x:0,y:0,width:width/2,height,side:'A'},{x:width/2,y:0,width:width/2,height,side:'B'}];
}
