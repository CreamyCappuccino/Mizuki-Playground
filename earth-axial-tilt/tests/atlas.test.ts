import { describe, expect, it } from 'vitest';
import { atlasReading, atlasReady, atlasScale, atlasSelection, buildAtlasField, type AtlasConfig } from '../src/physics/atlas';
import { solveSeasonalClimate, sampleThermalTemperature } from '../src/physics/energyBalance';
import { dailyMeanInsolation, dayLengthHours, SOLAR_CONSTANT } from '../src/physics/solar';
import { atlasColor } from '../src/ui/atlasColors';

function config(tilt = 23.44): AtlasConfig {
  return { metric: 'insolation', view: 'absolute',
    source: { model: 'illustrative', tilt, depth: 10, solution: null },
    reference: { model: 'illustrative', tilt: 23.44, depth: 10, solution: null } };
}

describe('latitude-year atlas', () => {
  it('contains all 365 days and both poles in a north-to-south field', () => {
    const c = config(90), field = buildAtlasField(c)!;
    expect(field.rows).toBe(91); expect(field.columns).toBe(365);
    expect(field.values.length).toBe(91 * 365);
    for (const [row, latitude] of [[0,90], [45,0], [90,-90]]) {
      for (const day of [1,80,172,355,365]) {
        expect(field.values[row * 365 + day - 1]).toBeCloseTo(dailyMeanInsolation(latitude, day, 90), 10);
      }
    }
  });
  it('keeps zero-tilt solar rows constant all year', () => {
    const field = buildAtlasField(config(0))!;
    for (let row = 0; row < 91; row += 10) {
      for (const day of [1,80,172,266,365]) expect(field.values[row*365+day-1]).toBeCloseTo(field.values[row*365], 10);
    }
  });
  it('matches daylight physics including polar day and polar night', () => {
    const c = { ...config(90), metric: 'daylight' as const };
    const field = buildAtlasField(c)!;
    expect(atlasReading(c, 90, 172)?.value).toBe(24);
    expect(atlasReading(c, -90, 172)?.value).toBe(0);
    for (const value of field.values) { expect(value).toBeGreaterThanOrEqual(0); expect(value).toBeLessThanOrEqual(24); }
    expect(atlasReading(c, 25.033, 172)?.value).toBe(dayLengthHours(25.033,172,90));
  });
  it('reports an exactly neutral difference at Earth tilt for all metrics', () => {
    for (const metric of ['temperature','insolation','daylight'] as const) {
      const field = buildAtlasField({ ...config(), metric, view: 'difference' })!;
      expect(field.minimum).toBe(0); expect(field.maximum).toBe(0);
    }
  });
  it('subtracts the same day and latitude, not an annual mean or opposite hemisphere', () => {
    const c = { ...config(60), view: 'difference' as const };
    for (const [lat,day] of [[60,172],[-60,355],[0,80]]) {
      const reading = atlasReading(c,lat,day)!;
      expect(reading.current).toBe(dailyMeanInsolation(lat,day,60));
      expect(reading.reference).toBe(dailyMeanInsolation(lat,day,23.44));
      expect(reading.value).toBe(reading.current-reading.reference!);
    }
  });
  it('uses the already solved EBM field with unchanged temperature sampling', () => {
    const solution = solveSeasonalClimate(45,10);
    const c: AtlasConfig = { ...config(45), metric: 'temperature', source: { model: 'energy-balance', tilt:45,depth:10,solution } };
    expect(atlasReading(c,25.033,172.3)?.value).toBe(sampleThermalTemperature(solution,25.033,172.3));
    const field = buildAtlasField(c)!;
    expect(field.values[32*365+171]).toBe(sampleThermalTemperature(solution,26,172));
  });
  it('never replaces a pending or wrong-configuration temperature with a legacy estimate', () => {
    const c: AtlasConfig = { ...config(60), metric: 'temperature', source: { model:'energy-balance',tilt:60,depth:10,solution:null } };
    expect(atlasReady(c)).toBe(false); expect(buildAtlasField(c)).toBeNull(); expect(atlasReading(c,25,100)).toBeNull();
    c.source.solution = solveSeasonalClimate(45,10);
    expect(buildAtlasField(c)).toBeNull();
    c.metric='insolation'; expect(buildAtlasField(c)).not.toBeNull();
  });
  it('requires a matching reference model and heat storage for temperature differences', () => {
    const solution = solveSeasonalClimate(23.44,10);
    const c: AtlasConfig = { ...config(), metric:'temperature', view:'difference',
      source: { model:'energy-balance',tilt:23.44,depth:10,solution },
      reference: { model:'energy-balance',tilt:23.44,depth:10,solution } };
    expect(buildAtlasField(c)?.maximum).toBe(0);
    c.reference.depth=50; expect(buildAtlasField(c)).toBeNull();
    c.reference.depth=10; c.reference.model='illustrative'; expect(buildAtlasField(c)).toBeNull();
  });
  it('documents and keeps the exact all-day-horizon convention', () => {
    const c = config(90);
    expect(atlasReading(c,0,171.25)?.value).toBeLessThan(1e-8);
    c.metric='daylight'; expect(atlasReading(c,0,171.25)?.value).toBe(12);
  });
  it('keeps temperature and difference display scales inclusive without numeric clipping', () => {
    const c = { ...config(90), metric:'temperature' as const };
    for (const view of ['absolute','difference'] as const) {
      const cfg={...c,view}, field=buildAtlasField(cfg)!, scale=atlasScale(cfg,field);
      expect(scale.minimum).toBeLessThanOrEqual(field.minimum); expect(scale.maximum).toBeGreaterThanOrEqual(field.maximum);
      if (view==='difference') expect(scale.minimum).toBe(-scale.maximum);
    }
    const solar=atlasScale(config(90),buildAtlasField(config(90))!);
    expect(solar.minimum).toBe(0); expect(solar.maximum).toBe(SOLAR_CONSTANT);
  });
  it('maps pointer corners, center and clamped outside values consistently', () => {
    expect(atlasSelection(0,0)).toEqual({day:1,latitude:90});
    expect(atlasSelection(1,1)).toEqual({day:365,latitude:-90});
    expect(atlasSelection(.5,.5)).toEqual({day:183,latitude:0});
    expect(atlasSelection(-2,2)).toEqual({day:1,latitude:-90});
    expect(atlasSelection(NaN,.5)).toBeNull();
    expect(atlasSelection(.5,Infinity)).toBeNull();
  });
  it('rejects invalid physical inputs', () => {
    for (const latitude of [-91,91,NaN,Infinity]) expect(() => atlasReading(config(),latitude,100)).toThrow();
    for (const day of [0,367,NaN,Infinity]) expect(() => atlasReading(config(),0,day)).toThrow();
  });
  it('uses a neutral zero in a finite symmetric difference palette', () => {
    const scale={minimum:-24,maximum:24,diverging:true};
    expect(atlasColor(0,'daylight',scale)).toEqual([232,234,224]);
    expect(atlasColor(-24,'daylight',scale)).not.toEqual(atlasColor(24,'daylight',scale));
    for (const value of [-100,-24,-1,0,1,24,100]) {
      for (const component of atlasColor(value,'daylight',scale)) {
        expect(component).toBeGreaterThanOrEqual(0);expect(component).toBeLessThanOrEqual(255);
      }
    }
    expect(() => atlasColor(NaN,'daylight',scale)).toThrow();
  });
});
