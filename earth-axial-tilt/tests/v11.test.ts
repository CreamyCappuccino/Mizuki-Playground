import { describe, expect, it } from 'vitest';
import { DEFAULT_EXPERIMENT, decodeExperiment, encodeExperiment, validateExperiment, experimentLocation,
  experimentURL, experimentFile, decodeExperimentFile, MAX_EXPERIMENT_LENGTH } from '../src/experiments/state';
import { EXPERIMENT_PRESETS, findExperimentPreset } from '../src/experiments/presets';
import { solarMoment } from '../src/physics/diurnal';

describe('v1.1 reproducible bounded experiment data',()=>{
  it('round-trips every field, including fractional model times and custom coordinates',()=>{
    const value={...DEFAULT_EXPERIMENT,tilt:43.27,tiltB:88.9,day:365.75,rotation:219.456,
      latitude:-81.056,longitude:-170.03,dual:true,heatDepth:50 as const,surfaceMode:'daylight' as const,
      period:'day' as const,chartMetric:'insolation' as const,sceneView:'orbit' as const,reference:true,guides:false,speed:12 as const};
    expect(decodeExperiment(encodeExperiment(value))).toEqual({status:'ok',state:value});
    expect(decodeExperimentFile(experimentFile(value))).toEqual({status:'ok',state:value});
  });
  it('uses documented defaults for omitted fields instead of the previous experiment',()=>{
    expect(decodeExperiment('#lab=1&a=45')).toEqual({status:'ok',state:{...DEFAULT_EXPERIMENT,tilt:45}});
  });
  it('ignores ordinary document fragments without touching the world',()=>{
    expect(decodeExperiment('#science')).toEqual({status:'none'});
    expect(decodeExperiment('')).toEqual({status:'none'});
  });
  it('rejects unsupported versions rather than partially applying familiar keys',()=>{
    for(const version of ['0','2','01','9999','NaN'])expect(decodeExperiment(`#lab=${version}&a=45`)).toEqual({status:'error',reason:'version'});
  });
  it('rejects duplicate owned keys',()=>{
    expect(decodeExperiment('#lab=1&a=0&a=90').status).toBe('error');
    expect(decodeExperiment('#lab=1&lab=1').status).toBe('error');
  });
  it('does not interpret unknown keys, HTML, scripts or prototype names',()=>{
    expect(decodeExperiment('#lab=1&__proto__=bad&name=%3Cscript%3E&autoplay=1&language=ja')).toEqual({status:'ok',state:DEFAULT_EXPERIMENT});
    expect(decodeExperimentFile('{"application":"earth-axial-tilt","version":1,"state":{"__proto__":{"tilt":90}}}')).toEqual({status:'ok',state:DEFAULT_EXPERIMENT});
    expect(({} as {tilt?:number}).tilt).toBeUndefined();
  });
  it('rejects invalid numeric inputs atomically, including empty and overflowing numbers',()=>{
    for(const invalid of ['',' ','NaN','Infinity','1e999','91','-0.1','0x20','null']) {
      expect(decodeExperiment(`#lab=1&a=${encodeURIComponent(invalid)}&day=100`).status).toBe('error');
    }
    expect(decodeExperiment('#lab=1&day=366').status).toBe('error');
    expect(decodeExperiment('#lab=1&spin=361').status).toBe('error');
  });
  it('validates coordinate pairs and resolves city names only from exact preset coordinates',()=>{
    expect(decodeExperiment('#lab=1&lat=12').status).toBe('error');
    expect(decodeExperiment('#lab=1&lon=12').status).toBe('error');
    expect(decodeExperiment('#lab=1&lat=91&lon=0').status).toBe('error');
    expect(experimentLocation({...DEFAULT_EXPERIMENT}).id).toBe('taipei');
    expect(experimentLocation({...DEFAULT_EXPERIMENT,latitude:25.1}).name).toBe('Custom point');
  });
  it('requires explicit allowed booleans, heat capacities and enums',()=>{
    for(const field of ['dual=true','ref=','heat=10.01','speed=2','layer=weather','period=hour','model=gcm','view=moon'])
      expect(decodeExperiment('#lab=1&'+field).status).toBe('error');
    expect(validateExperiment({...DEFAULT_EXPERIMENT,dual:'false'})).toBeNull();
    expect(validateExperiment({...DEFAULT_EXPERIMENT,heatDepth:'10'})).toBeNull();
  });
  it('bounds payload size and JSON formats',()=>{
    expect(decodeExperiment('#lab=1&'+ 'a'.repeat(MAX_EXPERIMENT_LENGTH)).status).toBe('error');
    for(const input of ['[]','null','{}','{"application":"other","version":1}', 'bad json'])
      expect(decodeExperimentFile(input).status).toBe('error');
    expect(decodeExperimentFile(' '.repeat(MAX_EXPERIMENT_LENGTH+1)).status).toBe('error');
  });
  it('normalizes a full rotation, without rounding scientific coordinates',()=>{
    expect(validateExperiment({...DEFAULT_EXPERIMENT,rotation:360})?.rotation).toBe(0);
    expect(validateExperiment({...DEFAULT_EXPERIMENT,latitude:1.123456789})?.latitude).toBe(1.123456789);
  });
  it('shares only the app route and owned hash; strips arbitrary queries and credentials',()=>{
    const url=new URL(experimentURL('https://name:secret@example.test/earth/?token=secret#old',{...DEFAULT_EXPERIMENT}));
    expect(url.pathname).toBe('/earth/');expect(url.search).toBe('');expect(url.username).toBe('');expect(url.password).toBe('');
    expect(decodeExperiment(url.hash)).toEqual({status:'ok',state:DEFAULT_EXPERIMENT});
    expect(()=>experimentURL('javascript:alert(1)',{...DEFAULT_EXPERIMENT})).toThrow();
  });
  it('never serializes playback, physical device information or display preferences',()=>{
    const file=JSON.parse(experimentFile({...DEFAULT_EXPERIMENT}));
    for(const key of ['language','quality','textSize','playback','focus','username','locationName'])expect(file.state).not.toHaveProperty(key);
  });
  it('all curated experiments validate and are individually reproducible',()=>{
    expect(new Set(EXPERIMENT_PRESETS.map(p=>p.id)).size).toBe(EXPERIMENT_PRESETS.length);
    for(const preset of EXPERIMENT_PRESETS){
      expect(validateExperiment(preset.state)).toEqual(preset.state);
      expect(decodeExperiment(encodeExperiment(preset.state))).toEqual({status:'ok',state:preset.state});
      expect(preset.title[0]).not.toBe(preset.title[1]);
    }
    expect(findExperimentPreset('missing')).toBeUndefined();
  });
  it('fast and slow presets differ only in global heat capacity, not A/B capacity',()=>{
    const a=findExperimentPreset('thermal-fast')!.state,b=findExperimentPreset('thermal-slow')!.state;
    expect({...a,heatDepth:b.heatDepth}).toEqual(b);expect(a.dual).toBe(false);expect(b.dual).toBe(false);
  });
  it('the Taipei day experiment actually starts at solar noon',()=>{
    const s=findExperimentPreset('taipei-day')!.state;
    expect(solarMoment(s.latitude,s.longitude,s.day,s.tilt,s.rotation).solarHours).toBeCloseTo(12,8);
  });
});
