import { describe, expect, it } from 'vitest';
import { compactOrbitViewport, orbitLabelKey, orbitViewportFov } from '../src/scene/orbitPresentation';

describe('short orbit view presentation, not simulation state', () => {
  it('targets short narrow views, retaining desktop and tall single layouts', () => {
    expect(compactOrbitViewport(390, 220)).toBe(true);
    expect(compactOrbitViewport(390, 700)).toBe(false);
    expect(compactOrbitViewport(640, 220)).toBe(false);
  });
  it('shortens only seasons and retains full keys in normal views', () => {
    expect(orbitLabelKey('Northern summer', true)).toBe('Summer');
    expect(orbitLabelKey('Northern summer', false)).toBe('Northern summer');
    expect(orbitLabelKey('Perihelion', true)).toBe('Perihelion');
  });
  it('zooms only short orbit views, leaving close-up and desktop unchanged', () => {
    expect(orbitViewportFov(40, 390, 220, true)).toBeCloseTo(28.8);
    expect(orbitViewportFov(40, 390, 220, false)).toBe(40);
    expect(orbitViewportFov(40, 1000, 700, true)).toBe(40);
  });
});
