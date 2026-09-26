import { clamp, dailyMeanInsolation, dayLengthHours } from './solar';
import { CLASSIC_ORBIT, orbitKey, type OrbitParameters } from './orbit';

const CACHE = new Map<string, number>();

export function annualMeanInsolation(latitudeDeg: number, obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT): number {
  const key = `${latitudeDeg.toFixed(2)}:${obliquityDeg.toFixed(2)}:${orbitKey(orbit)}`;
  const cached = CACHE.get(key);
  if (cached !== undefined) return cached;

  let total = 0;
  for (let day = 1; day <= 365; day += 1) {
    total += dailyMeanInsolation(latitudeDeg, day, obliquityDeg, orbit);
  }
  const mean = total / 365;
  // Bounded FIFO: dragging the tilt slider must not retain an unlimited history.
  if (CACHE.size >= 256) CACHE.delete(CACHE.keys().next().value!);
  CACHE.set(key, mean);
  return mean;
}

function wrapDay(day: number): number {
  return (((day - 1) % 365 + 365) % 365) + 1;
}

export function temperatureEstimateC(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT,
): number {
  // Deliberately simple: latitude baseline + lagged daily-mean solar anomaly.
  // A daily-mean-style latitude-band estimate, not daily maximum or station data.
  // This is designed to communicate relative seasonal change, not forecast climate.
  const absLat = Math.abs(latitudeDeg);
  const latitudeBaseline = 27 - 0.22 * absLat - 0.0018 * absLat * absLat;
  const thermalLagDays = 28;
  const laggedDay = wrapDay(dayOfYear - thermalLagDays);
  const currentSolar = dailyMeanInsolation(latitudeDeg, laggedDay, obliquityDeg, orbit);
  const annualSolar = annualMeanInsolation(latitudeDeg, obliquityDeg, orbit);
  const seasonalResponse = (currentSolar - annualSolar) * 0.055;

  return clamp(latitudeBaseline + seasonalResponse, -65, 55);
}

export interface AnnualPoint {
  day: number;
  insolation: number;
  daylight: number;
  temperature: number;
}

export function annualProfile(latitudeDeg: number, obliquityDeg: number,
  orbit: OrbitParameters = CLASSIC_ORBIT): AnnualPoint[] {
  const points: AnnualPoint[] = [];

  for (let day = 1; day <= 365; day += 1) {
    points.push({
      day,
      insolation: dailyMeanInsolation(latitudeDeg, day, obliquityDeg, orbit),
      daylight: dayLengthHours(latitudeDeg, day, obliquityDeg, orbit),
      temperature: temperatureEstimateC(latitudeDeg, day, obliquityDeg, orbit),
    });
  }

  return points;
}
