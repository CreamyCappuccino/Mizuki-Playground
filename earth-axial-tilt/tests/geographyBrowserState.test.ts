import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPERIMENT, decodeExperiment, decodeExperimentFile, encodeExperiment, experimentFile, validateExperiment } from '../src/experiments/state';
import { geographyTemperatureSource } from '../src/physics/geographyTemperatureSource';
import { buildGeographyGrid } from '../src/physics/geographyGrid';
import { GEOGRAPHY_GRID_ID, GEOGRAPHY_MASK_DIGEST, GEOGRAPHY_SOLVER_ID } from '../src/physics/geographyMask';
import { atlasReady, buildAtlasField, type AtlasConfig } from '../src/physics/atlas';
import { compareMeasurements } from '../src/physics/comparison';
describe('Earth geography schema 4 ownership', () => {
  const state = { ...DEFAULT_EXPERIMENT, climateProfile: 'earth-geography' as const, latitude: 45, longitude: 105 };
  it('round trips only in the new version, rejecting old schema3 profile in both transports', () => {
    expect(encodeExperiment(state)).toContain('lab=4');
    expect(decodeExperiment(encodeExperiment(state))).toEqual({ status:'ok', state });
    expect(decodeExperimentFile(experimentFile(state))).toEqual({ status:'ok', state });
    expect(decodeExperiment(encodeExperiment(state).replace('lab=4','lab=3')).status).toBe('error');
    expect(decodeExperimentFile(JSON.stringify({ application:'earth-axial-tilt',version:3,state })).status).toBe('error');
  });
  it('retains old migrations and rejects invalid combinations atomically', () => {
    expect(decodeExperiment('#lab=3&geo=idealized-ocean')).toMatchObject({status:'ok',state:{climateProfile:'idealized-ocean'}});
    expect(decodeExperiment('#lab=2&geo=earth-geography')).toMatchObject({status:'ok',state:{climateProfile:'classic'}});
    expect(validateExperiment({...state,temperatureModel:'illustrative'})).toBeNull();
    expect(decodeExperiment('#lab=4&geo=unknown').status).toBe('error');
    expect(decodeExperiment('#lab=4&geo=earth-geography&model=illustrative').status).toBe('error');
  });
});

function syntheticSource(tilt:number) {
  const grid=buildGeographyGrid(),orbit={eccentricity:0,perihelion:0,axis:0};
  return geographyTemperatureSource({tilt,orbit,retainedDepth:10},{grid,orbit,tilt,
    temperatures:Float64Array.from({length:365*648},(_,k)=>k+tilt),landFraction:new Float64Array(648),
    years:1,stepsPerDay:2,periodicError:0,energyResidual:0,maxStepEnergyResidual:0,
    maxRelativeLinearResidual:0,maxLinearIterations:1,minimum:tilt,maximum:365*648-1+tilt,
    provenance:{id:GEOGRAPHY_MASK_DIGEST,grid:GEOGRAPHY_GRID_ID,solver:GEOGRAPHY_SOLVER_ID,retainedClassicDepth:10}});
}
describe('integrated geography Atlas and Compare sampling contract (synthetic fields)',()=>{
  it('uses exactly 18 native rows and the chosen longitude, never a zonal mean',()=>{
    const config:AtlasConfig={metric:'temperature',view:'absolute',source:syntheticSource(60),reference:syntheticSource(23.44),longitude:105};
    const field=buildAtlasField(config)!;
    expect(field.rows).toBe(18);expect(field.columns).toBe(365);
    for(let row=0;row<18;row++)for(let day=0;day<365;day++)
      expect(field.values[row*365+day]).toBe(day*648+(17-row)*36+28+60);
    const ocean=buildAtlasField({...config,longitude:-135})!;
    expect(field.values[0]-ocean.values[0]).toBe(24);
    expect(()=>buildAtlasField({...config,longitude:undefined})).toThrow('longitude');
  });
  it('owns the 23.44° same-mask Atlas reference and exact identical-world differences',()=>{
    const a=syntheticSource(60),ref=syntheticSource(23.44);
    const config:AtlasConfig={metric:'temperature',view:'difference',source:a,reference:ref,longitude:105};
    expect(buildAtlasField(config)!.values[0]).toBeCloseTo(60-23.44,10);
    expect(atlasReady({...config,reference:a})).toBe(false);
    expect(compareMeasurements(a,a,45,172,105).every(row=>row.difference===0)).toBe(true);
    expect(()=>compareMeasurements(a,{model:'illustrative',tilt:60,depth:10,solution:null},45,172,105)).toThrow();
  });
});
