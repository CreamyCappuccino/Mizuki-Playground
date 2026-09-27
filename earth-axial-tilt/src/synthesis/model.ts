import { dailyMeanInsolation, SOLAR_CONSTANT } from '../physics/solar';
import { dayAtSeasonalLongitude, normalizeOrbit, type OrbitParameters } from '../physics/orbit';

/** A bounded conceptual sweep, NOT a dated orbital solution or climate solver. */
export const SYNTHESIS_MODEL = 'earth-orbit-sweep-halfday-angular360-v1';
export type SweepParameter = 'tilt' | 'eccentricity' | 'perihelionSeason';
export interface OrbitalCase { tilt: number; eccentricity: number; perihelion: number; axis: number }
export interface SweepSettings {
  base: OrbitalCase; parameter: SweepParameter; start: number; end: number; count: number;
  latitude: number; longitude: number; summer: 90 | 270;
  selected: number; comparison: number;
  profile: 'classic' | 'idealized-land' | 'idealized-ocean' | 'earth-geography';
  depth: 2.5 | 10 | 50;
}
export const DEFAULT_SWEEP: Readonly<SweepSettings> = Object.freeze({
  base: Object.freeze({ tilt: 23.44, eccentricity: .05, perihelion: 90, axis: 0 }),
  parameter: 'perihelionSeason', start: 0, end: 360, count: 13,
  latitude: 65, longitude: 0, summer: 90, selected: 3, comparison: 9, profile: 'classic', depth: 10,
});
export const PARAMETER_LIMITS = Object.freeze({ tilt: [0, 90], eccentricity: [0, .3], perihelionSeason: [0, 360] } as const);
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
function finite(v: unknown, low: number, high: number): v is number { return typeof v === 'number' && Number.isFinite(v) && v >= low && v <= high; }
/** Complete, finite, known-key snapshots only; no coercion/defaulting of malformed links. */
export function validateSweep(value: unknown): SweepSettings {
  if (!record(value) || Object.keys(value).length !== Object.keys(DEFAULT_SWEEP).length ||
      Object.keys(value).some(k => !Object.hasOwn(DEFAULT_SWEEP, k)) || !record(value.base) ||
      Object.keys(value.base).length !== 4 || Object.keys(value.base).some(k => !Object.hasOwn(DEFAULT_SWEEP.base, k))) throw new RangeError('Invalid sweep settings.');
  const v = value as unknown as SweepSettings, b = v.base;
  if (!finite(b.tilt, 0, 90) || !finite(b.eccentricity, 0, .3) || !finite(b.perihelion, 0, 360) || !finite(b.axis, 0, 360) ||
      !Object.hasOwn(PARAMETER_LIMITS, v.parameter)) throw new RangeError('Invalid orbital parameters.');
  const [lo, hi] = PARAMETER_LIMITS[v.parameter];
  if (!finite(v.start, lo, hi) || !finite(v.end, lo, hi) || v.end <= v.start || !Number.isInteger(v.count) || v.count < 3 || v.count > 41 ||
      !finite(v.latitude, -90, 90) || !finite(v.longitude, -180, 180) || ![90,270].includes(v.summer) ||
      !Number.isInteger(v.selected) || !Number.isInteger(v.comparison) || Math.min(v.selected,v.comparison) < 0 || Math.max(v.selected,v.comparison) >= v.count ||
      !['classic','idealized-land','idealized-ocean','earth-geography'].includes(v.profile) || ![2.5,10,50].includes(v.depth)) throw new RangeError('Invalid sweep range or selection.');
  return { base: { tilt: b.tilt, eccentricity: b.eccentricity, perihelion: b.perihelion % 360, axis: b.axis % 360 },
    parameter: v.parameter, start: v.start, end: v.end, count: v.count, latitude: v.latitude, longitude: v.longitude,
    summer: v.summer, selected: v.selected, comparison: v.comparison, profile: v.profile, depth: v.depth };
}
export function sweepValue(s: SweepSettings, index: number): number {
  if (!Number.isInteger(index) || index < 0 || index >= s.count) throw new RangeError('Invalid sweep index.');
  return index === s.count - 1 ? s.end : s.start + (s.end - s.start) * index / (s.count - 1);
}
export function sweepCase(s: SweepSettings, index: number): OrbitalCase {
  const value = sweepValue(s, index), b = s.base;
  return { ...b, ...(s.parameter === 'perihelionSeason' ? { perihelion: (b.axis + value) % 360 } : { [s.parameter]: value }) };
}
export function caseOrbit(c: OrbitalCase): OrbitParameters { return normalizeOrbit(c); }
export interface SweepRow {
  value: number; world: OrbitalCase; day: number; solstice: number;
  halfDays: number; halfMean: number; halfEnergy: number; annualMean: number; globalMean: number;
  quarters: readonly number[];
  /** Fixed model calendar, day 1..365, distinct from equal seasonal-angle samples. */
  daily: Float64Array;
  /** 72 angle-bin midpoints, 2.5°, 7.5°, ...,357.5°. */
  seasonal: Float64Array;
}
/** Exact Kepler duration of a forward seasonal sector, even when it wraps day 1. */
export function sectorDays(start: number, end: number, orbit: OrbitParameters): number {
  return ((dayAtSeasonalLongitude(end, orbit) - dayAtSeasonalLongitude(start, orbit)) % 365 + 365) % 365;
}
/** Fixed e/tilt + opposite perihelion: stronger but shorter summers. We integrate
 * Q(theta) * dt/dtheta, NOT an unweighted mean over orbital angle. */
export function calculateRow(settings: SweepSettings, index: number): SweepRow {
  const s = validateSweep(settings), world = sweepCase(s, index), orbit = caseOrbit(world);
  const day = dayAtSeasonalLongitude(s.summer, orbit), e = orbit.eccentricity;
  const start = s.summer - 90, halfDays = sectorDays(start, start + 180, orbit);
  const bins = 360, dtheta = Math.PI / bins;
  let energyDays = 0;
  for (let k = 0; k < bins; k++) {
    const theta = start + (k + .5) * 180 / bins;
    const nu = (theta + orbit.axis - orbit.perihelion) * Math.PI / 180;
    const dt = 365 / (2 * Math.PI) * (1 - e * e) ** 1.5 / (1 + e * Math.cos(nu)) ** 2 * dtheta;
    energyDays += dailyMeanInsolation(s.latitude, dayAtSeasonalLongitude(theta, orbit), world.tilt, orbit) * dt;
  }
  let annualMean = 0;
  for (let k = 0; k < 730; k++) annualMean += dailyMeanInsolation(s.latitude, 1 + (k + .5) / 2, world.tilt, orbit) / 730;
  return { value: sweepValue(s,index), world, day,
    solstice: dailyMeanInsolation(s.latitude, day, world.tilt, orbit), halfDays,
    halfMean: energyDays / halfDays, halfEnergy: energyDays * .0864, annualMean,
    globalMean: SOLAR_CONSTANT / (4 * Math.sqrt(1 - e * e)),
    quarters: [0,90,180,270].map(a => sectorDays(a,a+90,orbit)),
    daily: Float64Array.from({length:365}, (_,k) => dailyMeanInsolation(s.latitude,k+1,world.tilt,orbit)),
    seasonal: Float64Array.from({length:72}, (_,k) => dailyMeanInsolation(s.latitude,dayAtSeasonalLongitude((k+.5)*5,orbit),world.tilt,orbit)),
  };
}
export interface SweepResult { settings: SweepSettings; rows: SweepRow[] }
