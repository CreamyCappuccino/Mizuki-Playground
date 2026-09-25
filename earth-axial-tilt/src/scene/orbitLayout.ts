import { sunDirection, type Vector3Tuple } from '../physics/geometry';
import { degToRad } from '../physics/solar';
/** Display distances only: this does not alter flux, orbital period or the thermal model. */
export const ORBIT_RADIUS = 14;
export const ORBIT_EARTH_SCALE = 0.55;
export const MODEL_SEASONS = [
  { label: 'March', day: 80 }, { label: 'June', day: 171.25 },
  { label: 'September', day: 262.5 }, { label: 'December', day: 353.75 },
] as const;
export function orbitLayout(day: number, tilt: number): { position: Vector3Tuple; axis: Vector3Tuple } {
  if (!Number.isFinite(day) || !Number.isFinite(tilt) || tilt < 0 || tilt > 90) throw new RangeError('Invalid orbit view geometry.');
  const sun = sunDirection(day), angle = degToRad(tilt);
  return { position: sun.map(x => -ORBIT_RADIUS * x) as Vector3Tuple,
    axis: [0, Math.cos(angle), Math.sin(angle)] };
}
