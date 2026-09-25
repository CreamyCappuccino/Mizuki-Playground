/** Circular 365-mean-solar-day model, not a historical ephemeris. */
export const MODEL_YEAR_DAYS = 365;
export const INERTIAL_TURNS_PER_YEAR = MODEL_YEAR_DAYS + 1;
export const SPIN_DEGREES_PER_MODEL_DAY = 360 * INERTIAL_TURNS_PER_YEAR / MODEL_YEAR_DAYS;
export const COUPLED_DAYS_PER_SECOND = 0.1;

export function advanceCoupled(day: number, rotation: number, days: number): { day: number; rotation: number } {
  if (![day, rotation, days].every(Number.isFinite)) throw new RangeError('Motion inputs must be finite.');
  return { day: ((day - 1 + days) % MODEL_YEAR_DAYS + MODEL_YEAR_DAYS) % MODEL_YEAR_DAYS + 1,
    rotation: ((rotation + days * SPIN_DEGREES_PER_MODEL_DAY) % 360 + 360) % 360 };
}
