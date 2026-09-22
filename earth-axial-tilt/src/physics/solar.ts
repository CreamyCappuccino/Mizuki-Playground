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

export function orbitalLongitudeRad(dayOfYear: number): number {
  // Circular-orbit approximation with the March equinox near day 80.
  return (2 * Math.PI * (dayOfYear - 80)) / 365;
}

export function solarDeclinationDeg(dayOfYear: number, obliquityDeg: number): number {
  const epsilon = degToRad(obliquityDeg);
  const lambda = orbitalLongitudeRad(dayOfYear);
  return radToDeg(Math.asin(Math.sin(epsilon) * Math.sin(lambda)));
}

export function sunsetHourAngleRad(latitudeDeg: number, declinationDeg: number): number {
  const phi = degToRad(latitudeDeg);
  const delta = degToRad(declinationDeg);
  const x = -Math.tan(phi) * Math.tan(delta);

  if (x <= -1) return Math.PI;
  if (x >= 1) return 0;
  return Math.acos(x);
}

export function dayLengthHours(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
): number {
  const declination = solarDeclinationDeg(dayOfYear, obliquityDeg);
  const hourAngle = sunsetHourAngleRad(latitudeDeg, declination);
  return clamp((24 * hourAngle) / Math.PI, 0, 24);
}

export function dailyMeanInsolation(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
): number {
  const phi = degToRad(latitudeDeg);
  const delta = degToRad(solarDeclinationDeg(dayOfYear, obliquityDeg));
  const h0 = sunsetHourAngleRad(latitudeDeg, radToDeg(delta));

  const q =
    (SOLAR_CONSTANT / Math.PI) *
    (h0 * Math.sin(phi) * Math.sin(delta) +
      Math.cos(phi) * Math.cos(delta) * Math.sin(h0));

  return Math.max(0, q);
}

export function subsolarLatitudeDeg(dayOfYear: number, obliquityDeg: number): number {
  return solarDeclinationDeg(dayOfYear, obliquityDeg);
}

export function seasonLabel(dayOfYear: number): string {
  const anchors = [
    { day: 80, label: 'March equinox' },
    { day: 172, label: 'June solstice' },
    { day: 266, label: 'September equinox' },
    { day: 355, label: 'December solstice' },
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
