import { describe, expect, it } from 'vitest';
import { decodeExperiment, decodeExperimentFile, DEFAULT_EXPERIMENT, encodeExperiment, experimentFile } from '../src/experiments/state';
import { dailyMeanInsolation, dayLengthHours, solarDeclinationDeg } from '../src/physics/solar';
import { CLASSIC_ORBIT, modelDayAtTrueLongitude, orbitalState } from '../src/physics/orbit';
import { solveSeasonalClimate } from '../src/physics/energyBalance';
import { isThermalReady } from '../src/physics/temperatureModel';

describe('v1.2 orbit mechanics', () => {
  it('preserves representative v1 circular results exactly', () => {
    for (const day of [1, 80, 172, 266, 355]) {
      expect(solarDeclinationDeg(day, 23.44, CLASSIC_ORBIT)).toBe(solarDeclinationDeg(day, 23.44));
      expect(dayLengthHours(45, day, 23.44, CLASSIC_ORBIT)).toBe(dayLengthHours(45, day, 23.44));
      expect(dailyMeanInsolation(45, day, 23.44, CLASSIC_ORBIT)).toBe(dailyMeanInsolation(45, day, 23.44));
    }
  });

  it('migrates v1 URL and JSON state to the classic circular orbit', () => {
    const migrated = {...DEFAULT_EXPERIMENT, tilt: 45};
    expect(decodeExperiment('#lab=1&a=45')).toEqual({status:'ok', state:migrated});
    expect(decodeExperimentFile(JSON.stringify({application:'earth-axial-tilt',version:1,state:{tilt:45}})))
      .toEqual({status:'ok',state:migrated});
    expect(decodeExperiment('#lab=1&a=45&ea=.2')).toEqual({status:'error',reason:'invalid'});
    expect(decodeExperimentFile(JSON.stringify({application:'earth-axial-tilt',version:1,
      state:{tilt:45,eccentricityA:.2}}))).toEqual({status:'error',reason:'invalid'});
  });

  it('round-trips every orbit parameter in v2 URL and JSON state', () => {
    const state={...DEFAULT_EXPERIMENT,eccentricityA:.2,eccentricityB:.4,
      perihelionLongitudeA:35,perihelionLongitudeB:215,axisLongitudeA:10,axisLongitudeB:190};
    expect(decodeExperiment(encodeExperiment(state))).toEqual({status:'ok',state});
    expect(decodeExperimentFile(experimentFile(state))).toEqual({status:'ok',state});
  });

  it('rejects unsupported or invalid orbit state atomically', () => {
    expect(decodeExperiment('#lab=3&a=45')).toEqual({status:'error',reason:'version'});
    for (const field of ['ea=.6001','eb=-.1','pa=360.1','pb=NaN','xa=-1','xb=361']) {
      expect(decodeExperiment(`#lab=2&a=45&${field}`)).toEqual({status:'error',reason:'invalid'});
    }
  });

  it('puts perihelion and opposite season markers at requested true longitudes', () => {
    const orbit={eccentricity:.35,perihelionLongitude:42,axisLongitude:17};
    const perihelionDay=modelDayAtTrueLongitude(42*Math.PI/180,orbit);
    expect(orbitalState(perihelionDay,orbit).distanceAu).toBeCloseTo(.65,10);
    const warmSeasonDay=modelDayAtTrueLongitude(orbit.axisLongitude*Math.PI/180+Math.PI/2,orbit);
    expect(solarDeclinationDeg(warmSeasonDay,23.44,orbit)).toBeCloseTo(23.44,8);
  });

  it('never treats a thermal solution from another orbit as current', () => {
    const orbit={eccentricity:.2,perihelionLongitude:90,axisLongitude:25};
    const solution=solveSeasonalClimate(23.44,2.5,{bands:12,stepsPerDay:1},orbit);
    expect(isThermalReady({model:'energy-balance',tilt:23.44,depth:2.5,orbit,solution})).toBe(true);
    expect(isThermalReady({model:'energy-balance',tilt:23.44,depth:2.5,
      orbit:{...orbit,perihelionLongitude:270},solution})).toBe(false);
  });
});
