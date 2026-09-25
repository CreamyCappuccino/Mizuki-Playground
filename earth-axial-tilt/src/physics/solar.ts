import { orbitalMoment, isClassicOrbit, dayAtSeasonalLongitude, type OrbitParameters } from './orbit';
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

export function orbitalLongitudeRad(dayOfYear: number, orbit?: OrbitParameters): number {
  // Inertial solar longitude; optional Kepler geometry, spring reference anchored at day 80.
  return orbitalMoment(dayOfYear, orbit).solarLongitude;
}

export function solarDeclinationDeg(dayOfYear: number, obliquityDeg: number, orbit?: OrbitParameters): number {
  const epsilon = degToRad(obliquityDeg);
  const lambda = orbitalMoment(dayOfYear, orbit).seasonalLongitude;
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
  orbit?: OrbitParameters,
): number {
  const declination = solarDeclinationDeg(dayOfYear, obliquityDeg, orbit);
  const hourAngle = sunsetHourAngleRad(latitudeDeg, declination);
  return clamp((24 * hourAngle) / Math.PI, 0, 24);
}

export function dailyMeanInsolation(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
  orbit?: OrbitParameters,
): number {
  const phi = degToRad(latitudeDeg);
  const delta = degToRad(solarDeclinationDeg(dayOfYear, obliquityDeg, orbit));
  const h0 = sunsetHourAngleRad(latitudeDeg, radToDeg(delta));

  const q =
    (solarIrradiance(dayOfYear, orbit) / Math.PI) *
    (h0 * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(h0));

  return Math.max(0, q);
}

export function subsolarLatitudeDeg(dayOfYear: number, obliquityDeg: number, orbit?: OrbitParameters): number {
  return solarDeclinationDeg(dayOfYear, obliquityDeg, orbit);
}

export function seasonLabel(dayOfYear: number, orbit?: OrbitParameters): string {
  const anchors = [
    { day: dayAtSeasonalLongitude(0, orbit), label: 'Near March equinox (model)' },
    { day: dayAtSeasonalLongitude(90, orbit), label: 'Near June solstice (model)' },
    { day: dayAtSeasonalLongitude(180, orbit), label: 'Near September equinox (model)' },
    { day: dayAtSeasonalLongitude(270, orbit), label: 'Near December solstice (model)' },
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

  if (bestDistance <= 5) return isClassicOrbit(orbit) ? best.label : ['Spring reference','Northern summer reference','Autumn reference','Northern winter reference'][anchors.indexOf(best)];

  const monthStarts = [1, 32, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let month = 0;
  for (let i = 0; i < monthStarts.length; i += 1) {
    if (dayOfYear >= monthStarts[i]) month = i;
  }
  return months[month];
}

/** Incoming ray-normal TOA flux; S0 is specified at 1 au, not renormalized per year. */
export function solarIrradiance(day:number, orbit?:OrbitParameters):number {
  return SOLAR_CONSTANT * orbitalMoment(day,orbit).irradianceFactor;
}
