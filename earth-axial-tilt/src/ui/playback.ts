import { advanceCoupled, COUPLED_DAYS_PER_SECOND } from '../physics/motion';
import { wrapRotation } from '../physics/diurnal';

export type Playback = 'paused' | 'year' | 'day' | 'coupled';
export function togglePlayback(current: Playback, requested: Exclude<Playback, 'paused'>): Playback {
  return current === requested ? 'paused' : requested;
}

export function advanceSimulation(
  day: number, rotation: number, playback: Playback, seconds: number, speed: number,
): { day: number; rotation: number } {
  // Clamp long/invalid frame gaps so returning to a hidden tab never jumps seasons.
  const elapsed = Number.isFinite(seconds) ? Math.max(0, Math.min(seconds, 0.1)) : 0;
  speed = Number.isFinite(speed) && speed > 0 ? speed : 0;
  if (playback === 'coupled') return advanceCoupled(day, rotation, elapsed * speed * COUPLED_DAYS_PER_SECOND);
  if (playback === 'year') return { day: ((day - 1 + elapsed * speed * 7) % 365) + 1, rotation };
  // 30 real seconds per full turn at x1; this is an accelerated frozen-date experiment.
  if (playback === 'day') return { day, rotation: wrapRotation(rotation + elapsed * speed * 12) };
  return { day, rotation };
}
