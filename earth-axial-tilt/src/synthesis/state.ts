import { SYNTHESIS_MODEL, validateSweep, type SweepSettings } from './model';
const MAX = 8192;
export function sweepFile(state: SweepSettings): string {
  return JSON.stringify({ application:'earth-synthesis', version:1, model:SYNTHESIS_MODEL, state:validateSweep(state) },null,2);
}
export function parseSweepFile(text: string): SweepSettings {
  if (text.length > MAX) throw new RangeError('Sweep settings too long.');
  const v: unknown = JSON.parse(text);
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new RangeError('Invalid sweep file.');
  const r = v as Record<string, unknown>;
  if (Object.keys(r).length !== 4 || Object.keys(r).some(k=>!['application','version','model','state'].includes(k)) ||
      r.application !== 'earth-synthesis' || r.version !== 1 || r.model !== SYNTHESIS_MODEL) throw new RangeError('Unsupported sweep version/model.');
  return validateSweep(r.state);
}
export function sweepHash(state: SweepSettings): string { return '#synthesis=1&state='+encodeURIComponent(sweepFile(state)); }
export function parseSweepHash(hash: string): SweepSettings | null {
  if (!hash || hash === '#') return null;
  if (hash.length > MAX * 3) throw new RangeError('Sweep link too long.');
  const p = new URLSearchParams(hash.replace(/^#/,''));
  if (p.getAll('synthesis').length !== 1 || p.get('synthesis') !== '1' || p.getAll('state').length !== 1 ||
      [...p.keys()].some(k=>k !== 'synthesis' && k !== 'state')) throw new RangeError('Invalid sweep link.');
  return parseSweepFile(p.get('state')!);
}
/** Never includes credentials, tracking queries or personal display settings. */
export function sweepURL(base: string, state: SweepSettings): string {
  const url = new URL(base);
  if (!['https:','http:'].includes(url.protocol)) throw new RangeError('Unsupported share URL.');
  url.username=''; url.password=''; url.search=''; url.hash=sweepHash(state); return url.href;
}
