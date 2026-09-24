import { describe, it, expect } from 'vitest';
import { chartX, chartValueAtClientX, createChartLayout } from '../src/ui/chartLayout';
import { quantizeChartValue, chartValueForKey, LAST_SOLAR_MINUTE } from '../src/ui/chartScrubber';
import { formatModelDate } from '../src/ui/chart';
import { rotationAtSolarHour, solarMoment } from '../src/physics/diurnal';

describe('responsive chart coordinates', () => {
  it('keeps positive plot areas at phone and desktop sizes', () => {
    for (const [width, height] of [[280, 224], [336, 256], [518, 224], [560, 256]]) {
      for (const font of [14, 16, 28]) {
        const layout = createChartLayout(width, height, font);
        expect(layout.left).toBeGreaterThan(0);
        expect(layout.right).toBeGreaterThan(layout.left);
        expect(layout.right).toBeLessThan(width);
        expect(layout.bottom).toBeGreaterThan(layout.top);
        expect(layout.bottom).toBeLessThan(height);
        expect(layout.fontSize).toBe(font);
      }
    }
  });
  it('round-trips client coordinates, not just unscrolled local coordinates', () => {
    for (const width of [280, 336, 518, 600]) {
      const layout = createChartLayout(width, 224);
      for (const value of [1, 80, 171.25, 183, 365]) {
        const x = chartX(value, 1, 365, layout);
        for (const origin of [0, 20, 858]) {
          expect(chartValueAtClientX(origin + x, origin, width, layout, 1, 365)).toBeCloseTo(value, 8);
        }
      }
    }
  });
  it('handles a transformed viewport without changing the selected solar hour', () => {
    const layout = createChartLayout(518, 224, 16);
    for (const hour of [0, .25, 6, 12, 18, 24]) {
      const client = 200 + chartX(hour, 0, 24, layout) * 1.5;
      expect(chartValueAtClientX(client, 200, 518 * 1.5, layout, 0, 24)).toBeCloseTo(hour, 8);
    }
  });
  it('clamps dragging outside the plot to its endpoints', () => {
    const layout = createChartLayout(400, 224);
    expect(chartValueAtClientX(-999, 100, 400, layout, 1, 365)).toBe(1);
    expect(chartValueAtClientX(9999, 100, 400, layout, 1, 365)).toBe(365);
  });
  it('rejects invalid dimensions instead of emitting NaN into the graph', () => {
    for (const invalid of [0, -1, NaN, Infinity]) {
      expect(() => createChartLayout(invalid, 224)).toThrow(RangeError);
      expect(() => createChartLayout(400, invalid)).toThrow(RangeError);
      expect(() => createChartLayout(400, 224, invalid)).toThrow(RangeError);
    }
    const layout = createChartLayout(400, 224);
    expect(chartValueAtClientX(NaN, 0, 400, layout, 1, 365)).toBeNull();
    expect(chartValueAtClientX(100, 0, 0, layout, 1, 365)).toBeNull();
    expect(chartValueAtClientX(100, 0, 400, layout, 5, 5)).toBeNull();
  });
});

describe('graph navigation semantics', () => {
  it('selects whole days and keeps solar time inside the same day', () => {
    expect(quantizeChartValue(171.8, 'year')).toBe(172);
    expect(quantizeChartValue(-20, 'year')).toBe(1);
    expect(quantizeChartValue(400, 'year')).toBe(365);
    expect(quantizeChartValue(12.512, 'day')).toBe(12 + 31 / 60);
    expect(quantizeChartValue(24, 'day')).toBe(LAST_SOLAR_MINUTE);
    expect(quantizeChartValue(-2, 'day')).toBe(0);
    expect(() => quantizeChartValue(NaN, 'day')).toThrow(RangeError);
  });
  it('supports arrows, pages, Home and End without a mouse', () => {
    expect(chartValueForKey('ArrowRight', 172, 'year')).toBe(173);
    expect(chartValueForKey('ArrowDown', 172, 'year')).toBe(171);
    expect(chartValueForKey('PageUp', 172, 'year')).toBe(202);
    expect(chartValueForKey('PageDown', 172, 'year')).toBe(142);
    expect(chartValueForKey('Home', 172, 'year')).toBe(1);
    expect(chartValueForKey('End', 172, 'year')).toBe(365);
    expect(chartValueForKey('ArrowUp', 12, 'day')).toBe(12.25);
    expect(chartValueForKey('PageDown', 12, 'day')).toBe(11);
    expect(chartValueForKey('End', 12, 'day')).toBe(LAST_SOLAR_MINUTE);
    expect(chartValueForKey('Tab', 12, 'day')).toBeNull();
    expect(chartValueForKey('ArrowRight', NaN, 'day')).toBeNull();
  });
  it('starts annual key steps at the displayed day after fractional playback', () => {
    expect(chartValueForKey('ArrowRight', 353.75, 'year')).toBe(354);
    expect(chartValueForKey('ArrowLeft', 353.75, 'year')).toBe(352);
    expect(chartValueForKey('ArrowRight', 365.99, 'year')).toBe(365);
  });
  it('formats calendar labels without claiming real solstice dates', () => {
    expect(formatModelDate(1)).toBe('Jan 1');
    expect(formatModelDate(32)).toBe('Feb 1');
    expect(formatModelDate(60)).toBe('Mar 1');
    expect(formatModelDate(172)).toBe('Jun 21');
    expect(formatModelDate(353.75)).toBe('Dec 19');
    expect(formatModelDate(365.9)).toBe('Dec 31');
  });
  it('converts graph solar-time selections into the same physical rotation frame', () => {
    for (const day of [1, 80, 172, 355]) {
      for (const tilt of [0, 23.44, 60, 90]) {
        for (const selected of [0, 6, 12, 18, LAST_SOLAR_MINUTE]) {
          const rotation = rotationAtSolarHour(121.5654, day, tilt, selected);
          expect(rotation).not.toBeNull();
          const moment = solarMoment(25.033, 121.5654, day, tilt, rotation!);
          // Circular distance avoids a spurious 00:00 versus 24:00 floating-point mismatch.
          const difference = Math.abs(moment.solarHours! - selected);
          expect(Math.min(difference, 24 - difference)).toBeLessThan(1e-8);
        }
      }
    }
  });
});
