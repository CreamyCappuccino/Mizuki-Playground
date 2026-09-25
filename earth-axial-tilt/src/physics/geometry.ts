import { clamp, degToRad, orbitalLongitudeRad, radToDeg } from './solar';

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

export function sunDirection(day: number): Vector3Tuple {
  const lambda = orbitalLongitudeRad(day);
  // Prograde orbit about +Y; same handedness as positive eastward Ry spin.
  return [Math.cos(lambda), 0, -Math.sin(lambda)];
}

export function subsolarDirectionLocal(day: number, tilt: number): Vector3Tuple {
  const [x, , z] = sunDirection(day);
  const epsilon = degToRad(tilt);
  // Inverse of the globe's X-axis obliquity rotation.
  // Inverse of Rx(-obliquity). Annual declination is unchanged.
  return [x, -z * Math.sin(epsilon), z * Math.cos(epsilon)];
}
