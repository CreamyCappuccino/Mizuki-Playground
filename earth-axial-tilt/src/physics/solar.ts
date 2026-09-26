import { CLASSIC_ORBIT, modelDayAtTrueLongitude, orbitalState, type OrbitParameters } from './orbit';

export const SOLAR_CONSTANT = 1361;

const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function degToRad(value: number): number {
  return value * DEG;
}

export function radToDeg(value: number): number {
  return value * RAD;
}

export function orbitalLongitudeRad(dayOfYear: number, orbit: OrbitParameters = CLASSIC_ORBIT): number {
  return orbitalState(dayOfYear, orbit).trueLongitudeRad;
}

export function solarDeclinationDeg(dayOfYear: number, obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT): number {
  const epsilon = degToRad(obliquityDeg);
  const lambda = orbitalLongitudeRad(dayOfYear, orbit) - degToRad(orbit.axisLongitude);
  return radToDeg(Math.asin(clamp(Math.sin(epsilon) * Math.sin(lambda), -1, 1)));
}

export function sunsetHourAngleRad(latitudeDeg: number, declinationDeg: number): number {
  const phi = degToRad(latitudeDeg);
  const delta = degToRad(declinationDeg);
  const a = Math.sin(phi) * Math.sin(delta);
  const b = Math.cos(phi) * Math.cos(delta);
  // cos(zenith) = a + b*cos(hour angle); no singular tangents at either pole.
  // At an exact all-day horizon (a=b=0), 12 h is a reporting convention.
  // Incoming energy is zero there; it is not 12 hours of effective sunlight.
  if (Math.abs(b) < 1e-12) {
    if (a > 1e-12) return Math.PI;
    if (a < -1e-12) return 0;
    return Math.PI / 2;
  }
  const x = -a / b;

  if (x <= -1) return Math.PI;
  if (x >= 1) return 0;
  return Math.acos(x);
}

export function dayLengthHours(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT,
): number {
  const declination = solarDeclinationDeg(dayOfYear, obliquityDeg, orbit);
  const hourAngle = sunsetHourAngleRad(latitudeDeg, declination);
  return clamp((24 * hourAngle) / Math.PI, 0, 24);
}

export function dailyMeanInsolation(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT,
): number {
  const phi = degToRad(latitudeDeg);
  const delta = degToRad(solarDeclinationDeg(dayOfYear, obliquityDeg, orbit));
  const h0 = sunsetHourAngleRad(latitudeDeg, radToDeg(delta));

  const q =
    (SOLAR_CONSTANT * orbitalState(dayOfYear, orbit).relativeFlux / Math.PI) *
    (h0 * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(h0));

  return Math.max(0, q);
}

export function subsolarLatitudeDeg(dayOfYear: number, obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT): number {
  return solarDeclinationDeg(dayOfYear, obliquityDeg, orbit);
}

export function seasonLabel(dayOfYear: number, orbit: OrbitParameters = CLASSIC_ORBIT): string {
  const axis = degToRad(orbit.axisLongitude);
  const anchors = [
    { day: modelDayAtTrueLongitude(axis, orbit), label: 'Near March equinox (model)' },
    { day: modelDayAtTrueLongitude(axis + Math.PI / 2, orbit), label: 'Near June solstice (model)' },
    { day: modelDayAtTrueLongitude(axis + Math.PI, orbit), label: 'Near September equinox (model)' },
    { day: modelDayAtTrueLongitude(axis + Math.PI * 1.5, orbit), label: 'Near December solstice (model)' },
  ];

  let best = anchors[0];
  let bestDistance = 999;
  for (const anchor of anchors) {
    const direct = Math.abs(dayOfYear - anchor.day);
    const wrapped = Math.min(direct, 365 - direct);
    if (wrapped < bestDistance) {
      bestDistance = wrapped;
      best = anchor;
    }
  }

  if (bestDistance <= 5) return best.label;

  const monthStarts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let month = 0;
  for (let i = 0; i < monthStarts.length; i += 1) {
    if (dayOfYear >= monthStarts[i]) month = i;
  }
  return months[month];
}
