import { clamp, degToRad, radToDeg } from './solar';
import { CLASSIC_ORBIT, orbitalSunDirection, type OrbitParameters } from './orbit';

export type Vector3Tuple = [number, number, number];

// Three.js SphereGeometry + an equirectangular map whose centre is Greenwich.
// +Y is north, +X is longitude 0, -Z is longitude 90 E.
export function geographicToCartesian(latitude: number, longitude: number, radius = 1): Vector3Tuple {
  const phi = degToRad(latitude);
  const lambda = degToRad(longitude);
  return [radius * Math.cos(phi) * Math.cos(lambda), radius * Math.sin(phi),
    -radius * Math.cos(phi) * Math.sin(lambda)];
}

export function cartesianToGeographic([x, y, z]: Vector3Tuple): { latitude: number; longitude: number } {
  const radius = Math.hypot(x, y, z);
  if (radius === 0) throw new RangeError('A surface point must be non-zero.');
  return { latitude: radToDeg(Math.asin(clamp(y / radius, -1, 1))),
    longitude: radToDeg(Math.atan2(-z, x)) };
}

export function sunDirection(day: number, orbit: OrbitParameters = CLASSIC_ORBIT): Vector3Tuple {
  return orbitalSunDirection(day, orbit);
}

export function subsolarDirectionLocal(day: number, tilt: number,
  orbit: OrbitParameters = CLASSIC_ORBIT): Vector3Tuple {
  const [x, , z] = sunDirection(day, orbit);
  const epsilon = degToRad(tilt);
  const axis = degToRad(orbit.axisLongitude);
  // Inverse of Ry(axis) * Rx(-obliquity), before inverse surface spin.
  const untiltedX = x * Math.cos(axis) - z * Math.sin(axis);
  const untiltedZ = x * Math.sin(axis) + z * Math.cos(axis);
  return [untiltedX, -untiltedZ * Math.sin(epsilon), untiltedZ * Math.cos(epsilon)];
}
