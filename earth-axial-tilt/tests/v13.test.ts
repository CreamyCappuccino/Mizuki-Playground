import { describe, expect, it } from 'vitest';
import { atlasReading, atlasReady, buildAtlasField, type AtlasConfig } from '../src/physics/atlas';
import { effectiveHeatDepth, geographyCounterpart } from '../src/physics/climateGeography';
import { sampleThermalTemperature, solveSeasonalClimate } from '../src/physics/energyBalance';
import { isThermalReady, profileFromSource, type TemperatureSource } from '../src/physics/temperatureModel';
import { DEFAULT_EXPERIMENT, decodeExperiment, decodeExperimentFile, encodeExperiment, experimentFile, validateExperiment } from '../src/experiments/state';
import { ThermalClient, type ClimateWorker, type ThermalReply, type ThermalRequest } from '../src/ui/thermalClient';

const land = solveSeasonalClimate(23.44, 10, { climateProfile: 'idealized-land' });
const ocean = solveSeasonalClimate(23.44, 10, { climateProfile: 'idealized-ocean' });
const source = (solution: typeof land): TemperatureSource => ({
  model: 'energy-balance', tilt: 23.44, depth: 10, climateProfile: solution.climateProfile, solution,
});
const temperatures = (solution: typeof land, latitude = 45) =>
  Array.from({ length: 365 }, (_, day) => sampleThermalTemperature(solution, latitude, day + 1));

describe('v1.3 idealized climate geography', () => {
  it('keeps Earth Classic unchanged and reuses the documented Fast/Slow capacities exactly', () => {
    const classic = solveSeasonalClimate(23.44, 10);
    const fast = solveSeasonalClimate(23.44, 2.5);
    const slow = solveSeasonalClimate(23.44, 50);
    expect(classic.climateProfile).toBe('classic');
    expect(classic.effectiveDepth).toBe(10);
    expect(land.effectiveDepth).toBe(2.5);
    expect(ocean.effectiveDepth).toBe(50);
    expect(land.temperatures).toEqual(fast.temperatures);
    expect(ocean.temperatures).toEqual(slow.temperatures);
  });

  it('changes amplitude and lag without changing the annual-mean equilibrium', () => {
    const landYear = temperatures(land), oceanYear = temperatures(ocean);
    const range = (values: number[]) => Math.max(...values) - Math.min(...values);
    const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
    expect(range(landYear)).toBeGreaterThan(range(oceanYear));
    expect(landYear.indexOf(Math.max(...landYear))).toBeLessThan(oceanYear.indexOf(Math.max(...oceanYear)));
    expect(Math.abs(mean(landYear) - mean(oceanYear))).toBeLessThan(0.001);
  });

  it('carries profile provenance and rejects a solution from another material', () => {
    expect(effectiveHeatDepth('classic', 10)).toBe(10);
    expect(geographyCounterpart('idealized-land')).toBe('idealized-ocean');
    expect(isThermalReady(source(land))).toBe(true);
    expect(isThermalReady({ ...source(land), climateProfile: 'idealized-ocean' })).toBe(false);
    expect(profileFromSource({ ...source(land), climateProfile: 'idealized-ocean' }, 45)).toBeNull();
  });

  it('uses the other material at the same tilt and orbit for Atlas differences', () => {
    const config: AtlasConfig = {
      metric: 'temperature', view: 'difference', referenceKind: 'geography',
      source: source(land), reference: source(ocean),
    };
    expect(atlasReady(config)).toBe(true);
    const reading = atlasReading(config, 45, 210)!;
    expect(reading.current).toBe(sampleThermalTemperature(land, 45, 210));
    expect(reading.reference).toBe(sampleThermalTemperature(ocean, 45, 210));
    expect(reading.value).toBe(reading.current - reading.reference!);
    expect(buildAtlasField(config)).not.toBeNull();
    expect(atlasReady({ ...config, reference: { ...config.reference, tilt: 45 } })).toBe(false);
  });
});

describe('v1.3 portable state and worker ownership', () => {
  it('round-trips schema 3 and migrates schemas 1 and 2 to Earth Classic', () => {
    const value = { ...DEFAULT_EXPERIMENT, climateProfile: 'idealized-land' as const };
    expect(decodeExperiment(encodeExperiment(value))).toEqual({ status: 'ok', state: value });
    expect(decodeExperimentFile(experimentFile(value))).toEqual({ status: 'ok', state: value });
    expect(decodeExperiment('#lab=2&e=.1&model=energy-balance')).toEqual({
      status: 'ok', state: { ...DEFAULT_EXPERIMENT, eccentricity: .1 },
    });
    const schema2 = JSON.stringify({ application: 'earth-axial-tilt', version: 2,
      state: { ...DEFAULT_EXPERIMENT, climateProfile: undefined, eccentricity: .2 } });
    expect(decodeExperimentFile(schema2)).toEqual({ status: 'ok', state: { ...DEFAULT_EXPERIMENT, eccentricity: .2 } });
  });

  it('rejects invalid profiles and illustrative geography atomically', () => {
    expect(validateExperiment({ ...DEFAULT_EXPERIMENT, climateProfile: 'forest' })).toBeNull();
    expect(validateExperiment({ ...DEFAULT_EXPERIMENT, temperatureModel: 'illustrative', climateProfile: 'idealized-land' })).toBeNull();
    expect(decodeExperiment('#lab=3&geo=idealized-land&model=illustrative').status).toBe('error');
  });

  it('snapshots profile intent in coalesced worker requests', () => {
    const sent: ThermalRequest[] = [], replies: ThermalReply[] = [];
    const worker: ClimateWorker = { postMessage: request => sent.push(request), terminate: () => {}, onmessage: null, onerror: null };
    const client = new ThermalClient(() => worker, reply => replies.push(reply));
    client.request(23.44, 10, true, undefined, 'idealized-land', true);
    client.request(23.44, 10, true, undefined, 'idealized-ocean', true);
    expect(sent[0]).toMatchObject({ climateProfile: 'idealized-land', geographyContrast: true });
    worker.onmessage!({ data: { id: sent[0].id, error: 'obsolete' } } as MessageEvent<ThermalReply>);
    expect(replies).toHaveLength(0);
    expect(sent[1]).toMatchObject({ climateProfile: 'idealized-ocean', geographyContrast: true });
    client.dispose();
  });
});
