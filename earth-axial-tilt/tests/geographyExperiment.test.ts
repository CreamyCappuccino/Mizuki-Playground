import { describe, expect, it } from 'vitest';
import { GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID } from '../src/physics/geographyMask';
import { DEFAULT_GEOGRAPHY_EXPERIMENT, decodeGeographyExperiment, encodeGeographyExperiment,
  geographyExperimentFromHash, geographyExperimentHash } from '../src/experiments/geographyExperiment';

describe('real geography preview state', () => {
  it('round-trips only the pinned preview dataset and solver', () => {
    const state = { ...DEFAULT_GEOGRAPHY_EXPERIMENT, tilt: 60, day: 210.5, latitude: -35,
      longitude: 151, layer: 'difference' as const, orbit: { eccentricity: .2, perihelion: 90, axis: 25 } };
    expect(decodeGeographyExperiment(encodeGeographyExperiment(state))).toEqual(state);
    expect(geographyExperimentFromHash(geographyExperimentHash(state))).toEqual(state);
    const envelope = JSON.parse(encodeGeographyExperiment(state));
    expect(envelope.mask).toBe(GEOGRAPHY_MASK_DIGEST);
    expect(envelope.solver).toBe(GEOGRAPHY_SOLVER_ID);
  });

  it('rejects future, mismatched and internally invalid snapshots atomically', () => {
    const base = JSON.parse(encodeGeographyExperiment(DEFAULT_GEOGRAPHY_EXPERIMENT));
    for (const mutate of [
      (x: any) => { x.version = 2; },
      (x: any) => { x.mask = 'other'; },
      (x: any) => { x.solver = 'other'; },
      (x: any) => { x.state.tilt = 91; },
      (x: any) => { x.state.longitude = 181; },
      (x: any) => { x.state.orbit.eccentricity = .31; },
      (x: any) => { x.state.reference = false; x.state.layer = 'difference'; },
    ]) {
      const value = structuredClone(base); mutate(value);
      expect(() => decodeGeographyExperiment(JSON.stringify(value))).toThrow();
    }
    expect(() => geographyExperimentFromHash('#geo=%7B')).toThrow();
  });
});
