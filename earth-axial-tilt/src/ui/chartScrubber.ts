import { chartValueAtClientX, getChartLayout } from './chartLayout';

export type ChartPeriod = 'year' | 'day';
export const LAST_SOLAR_MINUTE = 1439 / 60;

/** A selected day is integral; a selected solar time has one-minute resolution. */
export function quantizeChartValue(value: number, period: ChartPeriod): number {
  if (!Number.isFinite(value)) throw new RangeError('Chart selection must be finite.');
  return period === 'year' ? Math.min(365, Math.max(1, Math.round(value)))
    : Math.min(LAST_SOLAR_MINUTE, Math.max(0, Math.round(value * 60) / 60));
}

export function chartValueForKey(key: string, current: number, period: ChartPeriod): number | null {
  if (!Number.isFinite(current)) return null;
  // Start from the displayed day/minute, including after fractional playback.
  current = period === 'year' ? Math.floor(current) : Math.round(current * 60) / 60;
  const step = period === 'year' ? 1 : 0.25;
  const page = period === 'year' ? 30 : 1;
  let value: number;
  switch (key) {
    case 'ArrowRight': case 'ArrowUp': value = current + step; break;
    case 'ArrowLeft': case 'ArrowDown': value = current - step; break;
    case 'PageUp': value = current + page; break;
    case 'PageDown': value = current - page; break;
    case 'Home': value = period === 'year' ? 1 : 0; break;
    case 'End': value = period === 'year' ? 365 : LAST_SOLAR_MINUTE; break;
    default: return null;
  }
  return quantizeChartValue(value, period);
}

interface ScrubberOptions {
  getPeriod: () => ChartPeriod;
  getValue: () => number;
  onSelect: (value: number) => void;
}

/** Keep events on the stable container; re-rendering SVG must not lose a drag. */
export function bindChartScrubber(container: HTMLElement, options: ScrubberOptions): () => void {
  let drag: { id: number; x: number; y: number; touch: boolean; scrubbing: boolean } | null = null;
  const choose = (clientX: number) => {
    const box = container.getBoundingClientRect();
    const period = options.getPeriod();
    const value = chartValueAtClientX(clientX, box.left, box.width, getChartLayout(container),
      period === 'year' ? 1 : 0, period === 'year' ? 365 : 24);
    if (value !== null) options.onSelect(quantizeChartValue(value, period));
  };
  const clearDrag = () => {
    const id = drag?.id;
    drag = null;
    container.classList.remove('scrubbing');
    if (id !== undefined && container.hasPointerCapture(id)) container.releasePointerCapture(id);
  };
  const down = (event: PointerEvent) => {
    if (drag) { clearDrag(); return; }
    if (!event.isPrimary || event.button !== 0) return;
    const touch = event.pointerType === 'touch';
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, touch, scrubbing: !touch };
    container.setPointerCapture(event.pointerId);
    if (!touch) {
      event.preventDefault();
      container.focus({ preventScroll: true });
      container.classList.add('scrubbing');
      choose(event.clientX);
    }
  };
  const move = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    if (drag.touch && !drag.scrubbing) {
      const dx = Math.abs(event.clientX - drag.x);
      const dy = Math.abs(event.clientY - drag.y);
      // A vertical touch gesture scrolls the page/panel instead of changing the planet.
      if (dy > 8 && dy > dx) { clearDrag(); return; }
      if (dx < 8) return;
      drag.scrubbing = true;
      container.classList.add('scrubbing');
      container.focus({ preventScroll: true });
    }
    choose(event.clientX);
  };
  const up = (event: PointerEvent) => {
    if (!drag || drag.id !== event.pointerId) return;
    const isTap = Math.hypot(event.clientX - drag.x, event.clientY - drag.y) <= 8;
    if (drag.scrubbing || isTap) {
      container.focus({ preventScroll: true });
      choose(event.clientX);
    }
    clearDrag();
  };
  const cancel = (event: PointerEvent) => { if (drag?.id === event.pointerId) clearDrag(); };
  const key = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const value = chartValueForKey(event.key, options.getValue(), options.getPeriod());
    if (value === null) return;
    event.preventDefault();
    options.onSelect(value);
  };
  container.addEventListener('pointerdown', down);
  container.addEventListener('pointermove', move);
  container.addEventListener('pointerup', up);
  container.addEventListener('pointercancel', cancel);
  container.addEventListener('lostpointercapture', cancel);
  container.addEventListener('keydown', key);
  return () => {
    clearDrag();
    container.removeEventListener('pointerdown', down);
    container.removeEventListener('pointermove', move);
    container.removeEventListener('pointerup', up);
    container.removeEventListener('pointercancel', cancel);
    container.removeEventListener('lostpointercapture', cancel);
    container.removeEventListener('keydown', key);
  };
}
