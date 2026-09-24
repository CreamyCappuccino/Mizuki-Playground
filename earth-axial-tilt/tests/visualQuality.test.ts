import { describe, it, expect } from 'vitest';
import { parseVisualQuality, qualitySettings, viewFieldOfView } from '../src/scene/visualQuality';

describe('display-only quality policy', () => {
  it('allows only documented profiles and falls back safely', () => {
    for (const value of ['eco', 'balanced', 'high']) expect(parseVisualQuality(value)).toBe(value);
    for (const value of [null, undefined, '', 'ultra', '<script>', 3, {}]) expect(parseVisualQuality(value)).toBe('high');
  });
  it('caps actual framebuffer ratio at 1, 1.5 or 2', () => {
    expect(qualitySettings('eco', 3, 16)).toEqual({ pixelRatio: 1, anisotropy: 2 });
    expect(qualitySettings('balanced', 3, 16)).toEqual({ pixelRatio: 1.5, anisotropy: 4 });
    expect(qualitySettings('high', 3, 16)).toEqual({ pixelRatio: 2, anisotropy: 8 });
  });
  it('never upsamples an ordinary display or exceeds hardware texture filtering', () => {
    for (const quality of ['eco', 'balanced', 'high'] as const) {
      expect(qualitySettings(quality, 1, 1)).toEqual({ pixelRatio: 1, anisotropy: 1 });
    }
  });
  it('handles invalid host capability reports without NaN or infinity', () => {
    for (const value of [NaN, Infinity, -3, 0]) {
      const settings = qualitySettings('high', value, NaN);
      expect(settings.pixelRatio).toBe(1); expect(settings.anisotropy).toBe(1);
    }
  });
  it('retains the existing desktop lens while framing portrait Earth', () => {
    expect(viewFieldOfView(16 / 9)).toBeCloseTo(38, 10);
    expect(viewFieldOfView(1)).toBeCloseTo(38, 10);
    expect(viewFieldOfView(390 / 844)).toBeGreaterThan(38);
    expect(viewFieldOfView(390 / 844)).toBeLessThan(100);
  });
  it('bounds even pathological aspect ratios to a valid perspective lens', () => {
    for (const aspect of [0, -1, NaN, Infinity, 0.01, 100]) {
      expect(viewFieldOfView(aspect)).toBeGreaterThan(0); expect(viewFieldOfView(aspect)).toBeLessThanOrEqual(100);
    }
  });
});
