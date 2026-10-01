import type { PlanetId } from './definitions';

export const PLANET_STATE_VERSION = 1;

export interface PlanetLabState {
  version: 1;
  worldA: PlanetId;
  worldB: PlanetId;
  seasonalLongitudeDeg: number;
  latitudeDeg: number;
}

export const DEFAULT_PLANET_STATE: Readonly<PlanetLabState> = Object.freeze({
  version: 1,
  worldA: 'earth',
  worldB: 'mars',
  seasonalLongitudeDeg: 90,
  latitudeDeg: 25,
});

function isPlanet(value: unknown): value is PlanetId {
  return value === 'earth' || value === 'mars';
}

export function validatePlanetState(value: unknown): PlanetLabState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const state = value as Partial<PlanetLabState>;
  if (state.version !== 1 || !isPlanet(state.worldA) || !isPlanet(state.worldB)) return null;
  if (typeof state.seasonalLongitudeDeg !== 'number' || !Number.isFinite(state.seasonalLongitudeDeg) ||
      state.seasonalLongitudeDeg < 0 || state.seasonalLongitudeDeg >= 360) return null;
  if (typeof state.latitudeDeg !== 'number' || !Number.isFinite(state.latitudeDeg) ||
      state.latitudeDeg < -90 || state.latitudeDeg > 90) return null;
  return {
    version: 1,
    worldA: state.worldA,
    worldB: state.worldB,
    seasonalLongitudeDeg: state.seasonalLongitudeDeg,
    latitudeDeg: state.latitudeDeg,
  };
}

export function encodePlanetState(state: PlanetLabState): string {
  const valid = validatePlanetState(state);
  if (!valid) throw new RangeError('Invalid Planet Lab state.');
  const params = new URLSearchParams({
    planet: String(PLANET_STATE_VERSION),
    a: valid.worldA,
    b: valid.worldB,
    ls: String(valid.seasonalLongitudeDeg),
    lat: String(valid.latitudeDeg),
  });
  return '#' + params.toString();
}

export type DecodePlanetState =
  | { status: 'ok'; state: PlanetLabState }
  | { status: 'empty' }
  | { status: 'error' };

export function decodePlanetState(hash: string): DecodePlanetState {
  if (typeof hash !== 'string' || hash.length > 2048) return { status: 'error' };
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!raw) return { status: 'empty' };
  const params = new URLSearchParams(raw);
  const keys = ['planet', 'a', 'b', 'ls', 'lat'];
  for (const key of keys)
    if (params.getAll(key).length !== 1 || !params.get(key)?.trim()) return { status: 'error' };
  let unknown = false;
  params.forEach((_value, key) => { if (!keys.includes(key)) unknown = true; });
  if (unknown || /%(?![0-9a-f]{2})/i.test(raw)) return { status: 'error' };
  const decimal = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
  if (!decimal.test(params.get('ls')!) || !decimal.test(params.get('lat')!)) return { status: 'error' };
  if (params.get('planet') !== String(PLANET_STATE_VERSION)) return { status: 'error' };
  const state = validatePlanetState({
    version: 1,
    worldA: params.get('a'),
    worldB: params.get('b'),
    seasonalLongitudeDeg: Number(params.get('ls')),
    latitudeDeg: Number(params.get('lat')),
  });
  return state ? { status: 'ok', state } : { status: 'error' };
}

export function planetShareURL(base: string, state: PlanetLabState): string {
  const url = new URL(base);
  url.username = '';
  url.password = '';
  url.search = '';
  url.hash = encodePlanetState(state);
  return url.toString();
}
