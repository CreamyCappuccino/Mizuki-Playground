import { PLANETS, type PlanetId } from './definitions';
import { decodePlanetState } from './state';
import type { WorldChoice } from './geometry';

export interface ExplorerState {
  version: 1;
  a: WorldChoice;
  b: WorldChoice;
  clock: 'season' | 'elapsed';
  season: number;
  days: number;
  latitude: number;
  longitude: number;
}
export const DEFAULT_EXPLORER: Readonly<ExplorerState> = Object.freeze({
  version:1, a:Object.freeze({id:'earth',tilt:null}), b:Object.freeze({id:'uranus',tilt:null}),
  clock:'season',season:90,days:0,latitude:65,longitude:0,
});
function record(x: unknown): x is Record<string,unknown> { return !!x && typeof x==='object' && !Array.isArray(x); }
function keys(x: Record<string,unknown>, expected: string[]): boolean {
  return Object.keys(x).length===expected.length && Object.keys(x).every(k=>expected.includes(k));
}
function number(x: unknown, lo:number, hi:number): x is number {
  return typeof x==='number' && Number.isFinite(x) && x>=lo && x<=hi;
}
function world(x: unknown): WorldChoice {
  if (!record(x) || !keys(x,['id','tilt']) || typeof x.id!=='string' || !Object.hasOwn(PLANETS,x.id) ||
    !(x.tilt===null || number(x.tilt,0,180))) throw new RangeError('Invalid world.');
  return {id:x.id as PlanetId,tilt:x.tilt as number|null};
}
export function validateExplorer(x:unknown): ExplorerState {
  if(!record(x)||!keys(x,['version','a','b','clock','season','days','latitude','longitude'])||x.version!==1 ||
    (x.clock!=='season' && x.clock!=='elapsed') || !number(x.season,0,360)||!number(x.days,0,100000)||
    !number(x.latitude,-90,90)||!number(x.longitude,-180,180)) throw new RangeError('Invalid explorer state.');
  return {version:1,a:world(x.a),b:world(x.b),clock:x.clock,season:x.season,days:x.days,latitude:x.latitude,longitude:x.longitude};
}
export function explorerFile(x:ExplorerState): string {
  return JSON.stringify({application:'planet-explorer',state:validateExplorer(x)},null,2);
}
export function parseExplorerFile(raw:string): ExplorerState {
  if(raw.length>4096)throw new RangeError('Oversized state.');
  const x:unknown=JSON.parse(raw);
  if(!record(x)||!keys(x,['application','state'])||x.application!=='planet-explorer')throw new RangeError('Wrong application.');
  return validateExplorer(x.state);
}
export function explorerHash(x:ExplorerState): string {
  return '#'+new URLSearchParams({explorer:'1',state:JSON.stringify(validateExplorer(x))}).toString();
}
export function parseExplorerHash(hash:string): ExplorerState|null {
  if(!hash)return null;
  if(hash.length>4096||/%(?![a-f0-9]{2})/i.test(hash))throw new RangeError('Malformed link.');
  // Importing v2.1's five-field comparison preserves its Earth/Mars scientific meaning.
  if(hash.startsWith('#planet=')) {
    const old=decodePlanetState(hash);
    if(old.status!=='ok')throw new RangeError('Invalid legacy comparison.');
    return validateExplorer({...DEFAULT_EXPLORER,a:{id:old.state.worldA,tilt:null},b:{id:old.state.worldB,tilt:null},
      season:old.state.seasonalLongitudeDeg,latitude:old.state.latitudeDeg});
  }
  const p=new URLSearchParams(hash.startsWith('#')?hash.slice(1):hash);
  if(p.getAll('explorer').length!==1||p.getAll('state').length!==1||p.get('explorer')!=='1'||
    Array.from(p.keys()).some(k=>k!=='explorer'&&k!=='state'))throw new RangeError('Invalid link.');
  return validateExplorer(JSON.parse(p.get('state')!));
}
export function explorerURL(base:string,x:ExplorerState): string {
  const u=new URL(base);u.username='';u.password='';u.search='';u.hash=explorerHash(x);return u.toString();
}
