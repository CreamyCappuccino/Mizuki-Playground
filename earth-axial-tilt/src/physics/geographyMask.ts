import payload from '../../data/land-fractions.json';
import type { GeographyMask } from './geographyClimate';

export const GEOGRAPHY_MASK_DIGEST = '09462b795716c3a3ce747bcf0835b089b38be8028d09b75cc1cdd196b2567084';
export const GEOGRAPHY_GRID_ID = 'phi-midpoint-18x36-v1';
export const GEOGRAPHY_SOLVER_ID = 'geography-backward-euler-pcg-v1';
export const GEOGRAPHY_SOURCE_ARCHIVE = '1926c621afd6ac67c3f36639bb1236134a48d82226dc675d3e3df53d02d2a3de';

/** Verify the actual numerical payload, not just its self-reported digest.
 * Async Web Crypto runs before computation; no remote data/runtime fetch.
 */
export async function productionGeographyMask(): Promise<GeographyMask> {
  if (payload.grid.id !== GEOGRAPHY_GRID_ID || payload.grid.nlat !== 18 || payload.grid.nlon !== 36 ||
      payload.source.version !== '4.1.0' || payload.source.archiveSha256 !== GEOGRAPHY_SOURCE_ARCHIVE ||
      payload.fractionsFloat64LESha256 !== GEOGRAPHY_MASK_DIGEST || payload.quadrature.samplesPerAxis !== 64 ||
      payload.fractions.length !== 648 || payload.fractions.some(f => !Number.isFinite(f) || f < 0 || f > 1)) {
    throw new Error('Production geography mask metadata mismatch.');
  }
  const bytes = new ArrayBuffer(648 * 8), view = new DataView(bytes);
  payload.fractions.forEach((f, k) => view.setFloat64(k * 8, f, true));
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  if (digest !== GEOGRAPHY_MASK_DIGEST) throw new Error('Production geography mask checksum mismatch.');
  // Return a private snapshot: a consumer cannot mutate a later solve's mask.
  return { nlat: 18, nlon: 36, fractions: Float64Array.from(payload.fractions),
    provenance: Object.freeze({ id: GEOGRAPHY_MASK_DIGEST, sourceVersion: payload.source.version,
      sourceArchiveSha256: GEOGRAPHY_SOURCE_ARCHIVE, quadratureSamplesPerAxis: 64 }) };
}
