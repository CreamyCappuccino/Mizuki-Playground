import type { AtlasMetric, AtlasScale } from '../physics/atlas';

type RGB = readonly [number, number, number];
const SOLAR: RGB[] = [[18, 21, 57], [74, 49, 132], [175, 63, 107], [241, 145, 64], [255, 238, 148]];
const DAYLIGHT: RGB[] = [[13, 28, 62], [48, 84, 138], [155, 149, 154], [236, 191, 111], [255, 239, 174]];
const TEMPERATURE: RGB[] = [[32, 48, 102], [60, 148, 190], [225, 235, 201], [231, 146, 90], [161, 42, 59]];
const DIFFERENCE: RGB[] = [[35, 72, 132], [110, 171, 206], [232, 234, 224], [237, 161, 101], [165, 49, 49]];

export function atlasColor(value: number, metric: AtlasMetric, scale: AtlasScale): [number, number, number] {
  if (!Number.isFinite(value) || !Number.isFinite(scale.minimum) || !Number.isFinite(scale.maximum) || scale.maximum <= scale.minimum) {
    throw new RangeError('Atlas colors require finite values and a positive scale span.');
  }
  const palette = scale.diverging ? DIFFERENCE : metric === 'temperature' ? TEMPERATURE : metric === 'insolation' ? SOLAR : DAYLIGHT;
  const p = Math.min(1, Math.max(0, (value - scale.minimum) / (scale.maximum - scale.minimum))) * 4;
  const i = Math.min(3, Math.floor(p)), f = p - i;
  return [0, 1, 2].map(c => Math.round(palette[i][c] * (1 - f) + palette[i + 1][c] * f)) as [number, number, number];
}
