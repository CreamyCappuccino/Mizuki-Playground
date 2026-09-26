import { dailyMeanInsolation, dayLengthHours } from './solar';
import { isGeographySource, temperatureFromSource, type ScientificTemperatureSource } from './temperatureModel';
export interface ComparisonRow { key: 'daylight' | 'solar' | 'temperature'; a: number | null; b: number | null; difference: number | null }
export function compareMeasurements(a: ScientificTemperatureSource, b: ScientificTemperatureSource, latitude: number, day: number, longitude?: number): ComparisonRow[] {
  if (a.model !== b.model || a.depth !== b.depth) throw new RangeError('Comparison requires the same model and heat storage.');
  if (isGeographySource(a) !== isGeographySource(b)) throw new RangeError('Comparison requires the same geography profile.');
  if (isGeographySource(a) && isGeographySource(b) && a.geography && b.geography &&
      a.geography.provenance.id !== b.geography.provenance.id) throw new RangeError('Comparison requires the same mask.');
  const row = (key: ComparisonRow['key'], x: number | null, y: number | null): ComparisonRow => ({ key, a: x, b: y,
    difference: x === null || y === null ? null : x - y });
  return [row('daylight', dayLengthHours(latitude,day,a.tilt,a.orbit),dayLengthHours(latitude,day,b.tilt,b.orbit)),
    row('solar', dailyMeanInsolation(latitude,day,a.tilt,a.orbit),dailyMeanInsolation(latitude,day,b.tilt,b.orbit)),
    row('temperature',temperatureFromSource(a,latitude,day,longitude),temperatureFromSource(b,latitude,day,longitude))];
}
export interface ComparisonViewport { x: number; y: number; width: number; height: number; side: 'A' | 'B' }
/** Top-origin CSS pixel rectangles. Scissor converts Y only at the WebGL boundary. */
export function comparisonViewports(width: number, height: number, enabled: boolean): ComparisonViewport[] {
  if (![width,height].every(v=>Number.isFinite(v)&&v>0)) return [];
  if (!enabled) return [{x:0,y:0,width,height,side:'A'}];
  const middleX=Math.floor(width/2), middleY=Math.floor(height/2);
  return width < 760
    ? [{x:0,y:0,width,height:middleY,side:'A'},{x:0,y:middleY,width,height:height-middleY,side:'B'}]
    : [{x:0,y:0,width:middleX,height,side:'A'},{x:middleX,y:0,width:width-middleX,height,side:'B'}];
}
