import { clamp, dailyMeanInsolation, dayLengthHours } from './solar';

const CACHE = new Map<string, number>();

export function annualMeanInsolation(latitudeDeg: number, obliquityDeg: number): number {
  const key = `${latitudeDeg.toFixed(2)}:${obliquityDeg.toFixed(2)}`;
  const cached = CACHE.get(key);
  if (cached !== undefined) return cached;

  let total = 0;
  for (let day = 1; day <= 365; day += 1) {
    total += dailyMeanInsolation(latitudeDeg, day, obliquityDeg);
  }
  const mean = total / 365;
  CACHE.set(key, mean);
  return mean;
}

function wrapDay(day: number): number {
  return ((Math.round(day) - 1 + 365) % 365) + 1;
}

export function temperatureEstimateC(
  latitudeDeg: number,
  dayOfYear: number,
  obliquityDeg: number,
): number {
  // Deliberately simple: latitude baseline + lagged daily-mean solar anomaly.
  // This is designed to communicate relative seasonal change, not forecast climate.
  const absLat = Math.abs(latitudeDeg);
  const latitudeBaseline = 27 - 0.22 * absLat - 0.0018 * absLat * absLat;
  const thermalLagDays = 28;
  const laggedDay = wrapDay(dayOfYear - thermalLagDays);
  const currentSolar = dailyMeanInsolation(latitudeDeg, laggedDay, obliquityDeg);
  const annualSolar = annualMeanInsolation(latitudeDeg, obliquityDeg);
  const seasonalResponse = (currentSolar - annualSolar) * 0.055;

  return clamp(latitudeBaseline + seasonalResponse, -65, 55);
}

export interface AnnualPoint {
  day: number;
  insolation: number;
  daylight: number;
  temperature: number;
}

export function annualProfile(latitudeDeg: number, obliquityDeg: number): AnnualPoint[] {
  const points: AnnualPoint[] = [];

  for (let day = 1; day <= 365; day += 2) {
    points.push({
      day,
      insolation: dailyMeanInsolation(latitudeDeg, day, obliquityDeg),
      daylight: dayLengthHours(latitudeDeg, day, obliquityDeg),
      temperature: temperatureEstimateC(latitudeDeg, day, obliquityDeg),
    });
  }

  return points;
}
