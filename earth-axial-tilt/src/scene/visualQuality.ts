/** Display-only configuration: no orbital, climate or latitude parameters here. */
export type VisualQuality = 'eco' | 'balanced' | 'high';
export function parseVisualQuality(value: unknown): VisualQuality {
  return value === 'eco' || value === 'balanced' || value === 'high' ? value : 'high';
}
export function qualitySettings(quality: VisualQuality, deviceRatio: number, maximumAnisotropy = 1) {
  const limits = { eco: { ratio: 1, anisotropy: 2 }, balanced: { ratio: 1.5, anisotropy: 4 }, high: { ratio: 2, anisotropy: 8 } }[parseVisualQuality(quality)];
  const ratio = Number.isFinite(deviceRatio) && deviceRatio > 0 ? deviceRatio : 1;
  const anisotropy = Number.isFinite(maximumAnisotropy) ? Math.max(1, maximumAnisotropy) : 1;
  return { pixelRatio: Math.min(ratio, limits.ratio), anisotropy: Math.min(anisotropy, limits.anisotropy) };
}
/** Keep the horizontal field of view comfortable on a portrait display. */
export function viewFieldOfView(aspect: number): number {
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return Math.min(100, 2 * Math.atan(Math.tan(19 * Math.PI / 180) / Math.min(1, safeAspect)) * 180 / Math.PI);
}
