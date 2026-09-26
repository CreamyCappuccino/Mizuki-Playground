export const MODEL_YEAR_DAYS = 365;
export const MAX_EDUCATIONAL_ECCENTRICITY = 0.6;

export interface OrbitParameters {
  eccentricity: number;
  /** Inertial true longitude of perihelion in the shared +Y prograde frame. */
  perihelionLongitude: number;
  /** Inertial azimuth of the north-axis lean; 0 preserves the v1.1 frame. */
  axisLongitude: number;
}

export interface OrbitalState {
  meanLongitudeRad: number;
  meanAnomalyRad: number;
  eccentricAnomalyRad: number;
  trueLongitudeRad: number;
  distanceAu: number;
  relativeFlux: number;
  relativeSpeed: number;
}

export const CLASSIC_ORBIT: Readonly<OrbitParameters> = Object.freeze({
  eccentricity: 0,
  perihelionLongitude: 0,
  axisLongitude: 0,
});

const TAU = Math.PI * 2;
const DEG = Math.PI / 180;

export function normalizeDegrees(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError('Angle must be finite.');
  return ((value % 360) + 360) % 360;
}

function normalizeRadians(value: number): number {
  return ((value % TAU) + TAU) % TAU;
}

function signedRadians(value: number): number {
  const normalized = normalizeRadians(value);
  return normalized > Math.PI ? normalized - TAU : normalized;
}

export function validateOrbit(parameters: OrbitParameters): OrbitParameters {
  if (!Number.isFinite(parameters.eccentricity)
    || parameters.eccentricity < 0
    || parameters.eccentricity > MAX_EDUCATIONAL_ECCENTRICITY) {
    throw new RangeError(`Eccentricity must be between 0 and ${MAX_EDUCATIONAL_ECCENTRICITY}.`);
  }
  return {
    eccentricity: parameters.eccentricity,
    perihelionLongitude: normalizeDegrees(parameters.perihelionLongitude),
    axisLongitude: normalizeDegrees(parameters.axisLongitude),
  };
}

/** Uniform model time expressed as inertial mean longitude; model day 80 is longitude 0. */
export function meanLongitudeRad(day: number): number {
  if (!Number.isFinite(day)) throw new RangeError('Model day must be finite.');
  return TAU * (day - 80) / MODEL_YEAR_DAYS;
}

/** Solve M = E - e sin(E). The educational limit makes Newton iteration well behaved. */
export function solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  if (!Number.isFinite(meanAnomaly)) throw new RangeError('Mean anomaly must be finite.');
  if (!Number.isFinite(eccentricity) || eccentricity < 0 || eccentricity > MAX_EDUCATIONAL_ECCENTRICITY) {
    throw new RangeError(`Eccentricity must be between 0 and ${MAX_EDUCATIONAL_ECCENTRICITY}.`);
  }
  const mean = signedRadians(meanAnomaly);
  if (eccentricity === 0) return mean;
  let anomaly = mean + eccentricity * Math.sin(mean);
  for (let i = 0; i < 12; i += 1) {
    const delta = (anomaly - eccentricity * Math.sin(anomaly) - mean)
      / (1 - eccentricity * Math.cos(anomaly));
    anomaly -= delta;
    if (Math.abs(delta) < 1e-14) break;
  }
  return anomaly;
}

export function orbitalState(day: number, input: OrbitParameters = CLASSIC_ORBIT): OrbitalState {
  const parameters = validateOrbit(input);
  const meanLongitude = meanLongitudeRad(day);
  const perihelion = parameters.perihelionLongitude * DEG;
  const meanAnomaly = signedRadians(meanLongitude - perihelion);
  const eccentricAnomaly = solveEccentricAnomaly(meanAnomaly, parameters.eccentricity);
  const trueAnomaly = Math.atan2(
    Math.sqrt(1 - parameters.eccentricity ** 2) * Math.sin(eccentricAnomaly),
    Math.cos(eccentricAnomaly) - parameters.eccentricity,
  );
  const distanceAu = 1 - parameters.eccentricity * Math.cos(eccentricAnomaly);
  return {
    meanLongitudeRad: meanLongitude,
    meanAnomalyRad: meanAnomaly,
    eccentricAnomalyRad: eccentricAnomaly,
    trueLongitudeRad: trueAnomaly + perihelion,
    distanceAu,
    relativeFlux: 1 / (distanceAu * distanceAu),
    relativeSpeed: Math.sqrt(2 / distanceAu - 1),
  };
}

/** Earth-to-Sun unit direction in the existing Three.js orbital frame. */
export function orbitalSunDirection(day: number, parameters: OrbitParameters = CLASSIC_ORBIT): [number, number, number] {
  const longitude = orbitalState(day, parameters).trueLongitudeRad;
  return [Math.cos(longitude), 0, -Math.sin(longitude)];
}

/** North-axis direction in the same inertial frame as perihelion and true longitude. */
export function orbitalAxisDirection(tilt: number, axisLongitude: number): [number, number, number] {
  if (!Number.isFinite(tilt) || tilt < 0 || tilt > 90) throw new RangeError('Obliquity must be between 0 and 90.');
  const epsilon = tilt * DEG;
  const axis = normalizeDegrees(axisLongitude) * DEG;
  return [
    -Math.sin(epsilon) * Math.sin(axis),
    Math.cos(epsilon),
    -Math.sin(epsilon) * Math.cos(axis),
  ];
}

/** Model day at a requested inertial true longitude, useful for season markers. */
export function modelDayAtTrueLongitude(trueLongitudeRad: number, input: OrbitParameters = CLASSIC_ORBIT): number {
  const parameters = validateOrbit(input);
  const perihelion = parameters.perihelionLongitude * DEG;
  const trueAnomaly = signedRadians(trueLongitudeRad - perihelion);
  const eccentricAnomaly = 2 * Math.atan2(
    Math.sqrt(1 - parameters.eccentricity) * Math.sin(trueAnomaly / 2),
    Math.sqrt(1 + parameters.eccentricity) * Math.cos(trueAnomaly / 2),
  );
  const meanAnomaly = eccentricAnomaly - parameters.eccentricity * Math.sin(eccentricAnomaly);
  const meanLongitude = normalizeRadians(meanAnomaly + perihelion);
  return ((80 - 1 + meanLongitude * MODEL_YEAR_DAYS / TAU) % MODEL_YEAR_DAYS) + 1;
}

export function orbitKey(parameters: OrbitParameters): string {
  const orbit = validateOrbit(parameters);
  return `${orbit.eccentricity}:${orbit.perihelionLongitude}:${orbit.axisLongitude}`;
}
