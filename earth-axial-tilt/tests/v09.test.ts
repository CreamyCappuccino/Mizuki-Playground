import { describe, it, expect } from 'vitest';
import { Vector3 } from 'three';
import { advanceCoupled, SPIN_DEGREES_PER_MODEL_DAY, INERTIAL_TURNS_PER_YEAR } from '../src/physics/motion';
import { advanceSimulation } from '../src/ui/playback';
import { solarMoment } from '../src/physics/diurnal';
import { sunDirection } from '../src/physics/geometry';
import { compareMeasurements, comparisonViewports } from '../src/physics/comparison';
import { solveSeasonalClimate } from '../src/physics/energyBalance';
import type { TemperatureSource } from '../src/physics/temperatureModel';

const source = (tilt: number): TemperatureSource => ({model:'illustrative', tilt, depth:10, solution:null});
describe('coupled prograde model clock',()=>{
  it('preserves 366 inertial turns per 365 mean solar days',()=>{
    expect(INERTIAL_TURNS_PER_YEAR).toBe(366);
    expect(SPIN_DEGREES_PER_MODEL_DAY*365).toBeCloseTo(366*360,8);
    expect(advanceCoupled(80,25,365).day).toBeCloseTo(80,9);
    expect(advanceCoupled(80,25,365).rotation).toBeCloseTo(25,9);
  });
  it('makes the orbital angular momentum agree with eastward spin',()=>{
    const r=new Vector3(...sunDirection(80)).negate();
    const later=new Vector3(...sunDirection(80.01)).negate();
    expect(r.clone().cross(later.sub(r)).y).toBeGreaterThan(0);
  });
  it('returns to the same apparent solar time after one mean solar day at zero tilt',()=>{
    const old=solarMoment(25,121,80,0,19);
    const next=advanceCoupled(80,19,1);
    const current=solarMoment(25,121,next.day,0,next.rotation);
    expect(current.solarHours).toBeCloseTo(old.solarHours!,8);
    expect(current.insolation).toBeCloseTo(old.insolation,8);
  });
  it('has no step subdivision dependence',()=>{
    const once=advanceCoupled(365.9,359.8,0.375);
    let parts={day:365.9,rotation:359.8};
    for(let i=0;i<75;i++)parts=advanceCoupled(parts.day,parts.rotation,.005);
    expect(parts.day).toBeCloseTo(once.day,8);expect(parts.rotation).toBeCloseTo(once.rotation,8);
  });
  it('wraps a year and rotation without discarding fractional phase',()=>{
    const next=advanceCoupled(365.9,350,.2);
    expect(next.day).toBeCloseTo(1.1,8);
    expect(next.rotation).toBeCloseTo((350+.2*SPIN_DEGREES_PER_MODEL_DAY)%360,8);
  });
  it('keeps both rates proportional across speed choices',()=>{
    for(const speed of [1,4,12]){
      const next=advanceSimulation(80,0,'coupled',.1,speed);
      expect(next.day-80).toBeCloseTo(.01*speed,8);
      expect(next.rotation/(next.day-80)).toBeCloseTo(SPIN_DEGREES_PER_MODEL_DAY,7);
    }
  });
  it('clamps large frame gaps and ignores invalid elapsed time',()=>{
    expect(advanceSimulation(80,0,'coupled',999,1)).toEqual(advanceSimulation(80,0,'coupled',.1,1));
    expect(advanceSimulation(80,0,'coupled',NaN,1)).toEqual({day:80,rotation:0});
  });
  it('preserves the two independent experiment meanings',()=>{
    expect(advanceSimulation(80,30,'day',.1,1).day).toBe(80);
    expect(advanceSimulation(80,30,'year',.1,1).rotation).toBe(30);
  });
  it('rejects invalid clock inputs instead of NaN propagation',()=>{
    for(const value of [NaN,Infinity,-Infinity])expect(()=>advanceCoupled(value,0,1)).toThrow(RangeError);
  });
});
describe('comparison values',()=>{
  it('A equals B gives zero in every row',()=>{
    for(const tilt of [0,23.44,45,90])for(const lat of [-90,0,25,90])for(const row of compareMeasurements(source(tilt),source(tilt),lat,172))expect(row.difference).toBe(0);
  });
  it('uses A minus B, including signs and shared astronomy',()=>{
    const a=compareMeasurements(source(23.44),source(90),45,172);
    const b=compareMeasurements(source(90),source(23.44),45,172);
    a.forEach((row,i)=>expect(row.difference).toBeCloseTo(-b[i].difference!,8));
  });
  it('has no stale temperature when one side is pending',()=>{
    const a={...source(23.44),model:'energy-balance' as const,solution:solveSeasonalClimate(23.44,10)};
    const b={...a,tilt:90};
    const rows=compareMeasurements(a,b,25,172);
    expect(rows.find(r=>r.key==='temperature')).toMatchObject({a:expect.any(Number),b:null,difference:null});
    expect(rows.find(r=>r.key==='solar')!.difference).not.toBeNull();
  });
  it('will not silently compare different temperature models or heat capacities',()=>{
    expect(()=>compareMeasurements(source(0),{...source(90),depth:50},25,172)).toThrow();
    expect(()=>compareMeasurements(source(0),{...source(90),model:'energy-balance'},25,172)).toThrow();
  });
});
describe('one context, non-overlapping comparison viewports',()=>{
  it('covers the canvas exactly on desktop and phone, including odd pixel sizes',()=>{
    for(const [w,h] of [[1440,560],[391,781],[759,1000],[761,777]]){
      const views=comparisonViewports(w,h,true);
      expect(views).toHaveLength(2);
      expect(views.reduce((sum,r)=>sum+r.width*r.height,0)).toBe(w*h);
      expect(views[0].width===w?views[1].y:views[1].x).toBe(views[0].width===w?views[0].height:views[0].width);
    }
  });
  it('retains a full single view when disabled',()=>{
    expect(comparisonViewports(1000,600,false)).toEqual([{side:'A',x:0,y:0,width:1000,height:600}]);
  });
});
