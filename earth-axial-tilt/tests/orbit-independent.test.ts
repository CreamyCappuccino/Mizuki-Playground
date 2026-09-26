/** Independent numerical/provenance regressions for the equinox-anchored Earth model.
 * Kepler reference: https://ssd.jpl.nasa.gov/planets/approx_pos.html
 * The oracle uses bisection, not the production solver's Newton iteration.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'vitest';
import { CLASSIC_ORBIT, orbitalMoment, solveKepler, dayAtSeasonalLongitude,
  perihelionDay, normalizeOrbit, type OrbitParameters } from '../src/physics/orbit';
import { dailyMeanInsolation, dayLengthHours, solarDeclinationDeg } from '../src/physics/solar';
import { subsolarDirectionLocal } from '../src/physics/geometry';
import { solarMoment, rotationAtSolarHour, insolationAtSolarHour } from '../src/physics/diurnal';
import { solveSeasonalClimate, sampleThermalTemperature } from '../src/physics/energyBalance';
import { isThermalReady } from '../src/physics/temperatureModel';
import { DEFAULT_EXPERIMENT, encodeExperiment, decodeExperiment, experimentFile,
  decodeExperimentFile, validateExperiment, experimentURL } from '../src/experiments/state';

const TAU=2*Math.PI, DEG=Math.PI/180;
const angle=(x:number):number=>Math.atan2(Math.sin(x),Math.cos(x));
function near(a:number,b:number,tolerance:number):void {
  assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,
    `${a} differs from ${b} by ${Math.abs(a-b)} (tolerance ${tolerance})`);
}
function bisection(mean:number,e:number):number {
  const m=((mean+Math.PI)%TAU+TAU)%TAU-Math.PI;
  let lo=-Math.PI,hi=Math.PI;
  for(let i=0;i<70;i++){
    const x=(lo+hi)/2;
    if(x-e*Math.sin(x)<m)lo=x;else hi=x;
  }
  return (lo+hi)/2;
}
const configurations:OrbitParameters[]=[];
for(const eccentricity of [0,.0167,.1,.3])for(const perihelion of [0,87,180,281])
  for(const axis of [0,29,180,359.99])configurations.push({eccentricity,perihelion,axis});

function oldDecl(day:number,tilt:number):number {
  return Math.asin(Math.max(-1,Math.min(1,Math.sin(tilt*DEG)*Math.sin(TAU*(day-80)/365))))/DEG;
}
function oldHourAngle(lat:number,declination:number):number {
  const p=lat*DEG,d=declination*DEG,a=Math.sin(p)*Math.sin(d),b=Math.cos(p)*Math.cos(d);
  if(Math.abs(b)<1e-12)return a>1e-12?Math.PI:a<-1e-12?0:Math.PI/2;
  return Math.acos(Math.max(-1,Math.min(1,-a/b)));
}
function oldDailySolar(lat:number,day:number,tilt:number):number {
  const p=lat*DEG,d=oldDecl(day,tilt)*DEG,h=oldHourAngle(lat,oldDecl(day,tilt));
  return Math.max(0,1361/Math.PI*(h*Math.sin(p)*Math.sin(d)+Math.cos(p)*Math.cos(d)*Math.sin(h)));
}

describe('independent orbital mechanics audit',()=>{
  it('matches a bracket-only Kepler oracle, including wrap boundaries',()=>{
    for(const e of [0,.0167,.1,.3,.6])for(const m of [-TAU,-Math.PI,-1e-12,0,1e-12,Math.PI,TAU,
      ...Array.from({length:32},(_,i)=>TAU*((i*.6180339887498949)%1)-Math.PI)])
      near(angle(solveKepler(m,e)-bisection(m,e)),0,5e-13);
  });
  it('preserves the day80 anchor and inverts seasonal longitude across wraps',()=>{
    for(const orbit of configurations){
      near(angle(orbitalMoment(80,orbit).seasonalLongitude),0,8e-14);
      for(const season of [0,1,89.9,90,180,270,359.99]){
        const day=dayAtSeasonalLongitude(season,orbit);
        assert.ok(day>=1&&day<366);
        near(angle(orbitalMoment(day,orbit).seasonalLongitude-season*DEG),0,1e-13);
      }
    }
  });
  it('places apsides at 1±e and reports no physically distinct circular perihelion',()=>{
    for(const orbit of configurations){
      const day=perihelionDay(orbit);
      if(orbit.eccentricity===0){assert.equal(day,null);continue;}
      assert.notEqual(day,null);
      near(orbitalMoment(day!,orbit).distanceAU,1-orbit.eccentricity,2e-14);
      near(orbitalMoment(dayAtSeasonalLongitude(orbit.perihelion-orbit.axis+180,orbit),orbit).distanceAU,
        1+orbit.eccentricity,2e-14);
    }
  });
  it('obeys equal areas in time, checked from a finite difference of position angles',()=>{
    const h=1e-4,meanMotion=TAU/365;
    for(const orbit of configurations)for(const day of [1,80,130,200,330]){
      const m=orbitalMoment(day,orbit);
      const rate=angle(orbitalMoment(day+h,orbit).solarLongitude-orbitalMoment(day-h,orbit).solarLongitude)/(2*h*meanMotion);
      near(rate*m.distanceAU*m.distanceAU,Math.sqrt(1-orbit.eccentricity**2),2e-8);
      near(m.speedRatio,Math.sqrt(2/m.distanceAU-1),2e-15);
    }
  });
  it('time-averages inverse-square flux rather than averaging equally spaced true anomalies',()=>{
    for(const orbit of configurations){
      let mean=0;const n=1024;
      for(let i=0;i<n;i++)mean+=orbitalMoment(1+365*(i+.5)/n,orbit).irradianceFactor/n;
      near(mean,1/Math.sqrt(1-orbit.eccentricity**2),5e-13);
    }
  });
  it('retains the historical circular daylight and daily sunlight formulas',()=>{
    for(const tilt of [0,1,23.44,45,89.999,90])for(const lat of [-90,-80,-45,0,25,66.56,90])
      for(const day of [1,79.9,80,171.25,172,262.5,353.75,365.999])for(const axis of [0,17,270]){
        const orbit={eccentricity:0,perihelion:203,axis};
        near(dailyMeanInsolation(lat,day,tilt,orbit),oldDailySolar(lat,day,tilt),2e-12);
        near(dayLengthHours(lat,day,tilt,orbit),24*oldHourAngle(lat,oldDecl(day,tilt))/Math.PI,2e-12);
      }
  });
  it('agrees between declination, vector geometry and an apparent-noon operation',()=>{
    for(const orbit of configurations)for(const day of [1,80,130,200,330])for(const tilt of [0,23.44,90]){
      const v=subsolarDirectionLocal(day,tilt,orbit);
      near(Math.hypot(...v),1,5e-16);
      near(v[1],Math.sin(solarDeclinationDeg(day,tilt,orbit)*DEG),8e-16);
      const spin=rotationAtSolarHour(123,day,tilt,12,orbit);
      if(spin===null)continue;
      for(const lat of [-90,-20,0,25,80,90])near(solarMoment(lat,123,day,tilt,spin,orbit).insolation,
        insolationAtSolarHour(lat,day,tilt,12,orbit),2e-10);
    }
  });
  it('recovers the daily mean by independently integrating the local solar day',()=>{
    for(const eccentricity of [0,.3])for(const tilt of [0,23.44,90])
      for(const lat of [-90,-80,-25,0,66.56,90])for(const day of [1,80,130,220]){
        const orbit={eccentricity,perihelion:281,axis:33};let mean=0;const n=7200;
        for(let i=0;i<n;i++)mean+=insolationAtSolarHour(lat,day,tilt,24*(i+.5)/n,orbit)/n;
        near(mean,dailyMeanInsolation(lat,day,tilt,orbit),5e-5);
      }
  });
  it('rejects non-finite and out-of-range orbital inputs',()=>{
    for(const eccentricity of [-1,.3000001,Infinity,NaN])assert.throws(()=>normalizeOrbit({...CLASSIC_ORBIT,eccentricity}));
    assert.throws(()=>solveKepler(Infinity,.2));assert.throws(()=>solveKepler(1,1));
    assert.throws(()=>orbitalMoment(NaN));assert.throws(()=>normalizeOrbit({...CLASSIC_ORBIT,axis:NaN}));
  });
});

describe('independent portable-state audit',()=>{
  it('round-trips separate A/B orbital parameters in both formats, without leaking URL credentials',()=>{
    for(const eccentricity of [0,.0167,.2,.3])for(const axisAzimuth of [0,35,359.99]){
      const state={...DEFAULT_EXPERIMENT,eccentricity,eccentricityB:.3-eccentricity,perihelion:282.94,
        axisAzimuth,perihelionB:90,axisAzimuthB:33,dual:true,day:365.9,rotation:15.8};
      assert.deepEqual(decodeExperiment(encodeExperiment(state)),{status:'ok',state});
      assert.deepEqual(decodeExperimentFile(experimentFile(state)),{status:'ok',state});
      const url=new URL(experimentURL('https://username:password@example.test/lab?private=hidden#old',state));
      assert.deepEqual([url.username,url.password,url.search],['','','']);
      assert.deepEqual(decodeExperiment(url.hash),{status:'ok',state});
    }
  });
  it('migrates schema1 to the circle even when unknown orbital fields were present',()=>{
    const hash='#lab=1&a=45&b=0&day=171.25&spin=73&lat=25&lon=121&dual=1&layer=insolation';
    const parsed=decodeExperiment(hash);assert.equal(parsed.status,'ok');if(parsed.status!=='ok')return;
    for(const field of ['eccentricity','perihelion','axisAzimuth','eccentricityB','perihelionB','axisAzimuthB'] as const)
      assert.equal(parsed.state[field],0);
    assert.deepEqual(decodeExperiment(hash+'&e=.3&peri=270&axis=180&be=.2'),parsed);
    assert.deepEqual(decodeExperimentFile(JSON.stringify({application:'earth-axial-tilt',version:1,
      state:{...parsed.state,eccentricity:.3,axisAzimuth:180}})),parsed);
  });
  it('rejects malformed owned fields, duplicates and unknown versions atomically',()=>{
    for(const field of ['eccentricity','eccentricityB'])for(const value of [-1,1,.3000001,Infinity,NaN,'0.2',null,[],{}])
      assert.equal(validateExperiment({...DEFAULT_EXPERIMENT,[field]:value}),null);
    for(const field of ['perihelion','perihelionB','axisAzimuth','axisAzimuthB'])for(const value of [-1,360.0001,Infinity,NaN,'90',null])
      assert.equal(validateExperiment({...DEFAULT_EXPERIMENT,[field]:value}),null);
    for(const hash of ['#lab=3','#lab=2&e=1','#lab=2&e=.1&e=.2','#lab=2&axis=NaN','#lab=2&lat=25','#lab=2&baxis=361'])
      assert.equal(decodeExperiment(hash).status,'error');
    assert.equal(decodeExperimentFile('{').status,'error');
    assert.equal(decodeExperimentFile(' '.repeat(4097)).status,'error');
  });
});

describe('independent thermal provenance audit',()=>{
  it('converges at the supported extreme without clipping and rejects a stale circular solution',()=>{
    const orbit={eccentricity:.3,perihelion:90,axis:0};
    const solution=solveSeasonalClimate(90,2.5,{orbit});
    assert.ok(solution.periodicError<1e-6&&Math.abs(solution.energyResidual)<1e-5);
    assert.ok(solution.temperatures.every(Number.isFinite));
    // This is a known linear-EBM extrapolation, not a real habitable-climate prediction.
    assert.ok(solution.maximum>60);
    const source={model:'energy-balance' as const,tilt:90,depth:2.5,solution,orbit};
    assert.equal(isThermalReady(source),true);
    assert.equal(isThermalReady({...source,orbit:CLASSIC_ORBIT}),false);
    assert.equal(isThermalReady({...source,orbit:{...orbit,perihelion:270}}),false);
    assert.equal(sampleThermalTemperature(solution,25,50.5),sampleThermalTemperature(solution,25,415.5));
  });
});
