import { describe,it,expect } from 'vitest';
import { mercuryMoment,mercurySeries,mercuryHash,mercuryURL,parseMercuryHash,mercuryCSV,DEFAULT_MERCURY,validateMercury } from '../src/planet/mercury';
import { MERCURY_PLANET } from '../src/planet/definitions';
import { illumination } from '../src/planet/geometry';
const D=Math.PI/180,TAU=Math.PI*2;
function reference(cycles:number,e:number){
  const turns=Math.floor(cycles),M=TAU*(cycles-turns);let lo=0,hi=TAU;
  for(let i=0;i<80;i++){const E=(lo+hi)/2;if(E-e*Math.sin(E)>M)hi=E;else lo=E;}
  const E=(lo+hi)/2,v=2*Math.atan2(Math.sqrt(1+e)*Math.sin(E/2),Math.sqrt(1-e)*Math.cos(E/2));
  return {trueAnomaly:v/D+360*turns,r:MERCURY_PLANET.orbit.semiMajorAxisAU*(1-e*Math.cos(E))};
}
describe('Mercury coupled 3:2 astronomy',()=>{
  it('matches an independent bracket-only Kepler and half-angle reference',()=>{
    for(const e of [0,.1,.20563593,.3])for(let i=0;i<=150;i++){
      const x=mercuryMoment({...DEFAULT_MERCURY,eccentricity:e,cycles:i/75}),r=reference(i/75,e);
      expect(x.trueAnomaly).toBeCloseTo(r.trueAnomaly,10);expect(x.distanceAU).toBeCloseTo(r.r,12);
    }
  });
  it('two orbits make exactly three sidereal turns and one net solar cycle',()=>{
    const a=mercuryMoment(DEFAULT_MERCURY),b=mercuryMoment({...DEFAULT_MERCURY,cycles:1}),c=mercuryMoment({...DEFAULT_MERCURY,cycles:2});
    expect(c.spinTurns).toBe(3);expect(c.sunBodyLongitude-a.sunBodyLongitude).toBeCloseTo(-360,10);
    expect(b.sunBodyLongitude-a.sunBodyLongitude).toBeCloseTo(-180,10);expect(c.instantWm2).toBeCloseTo(a.instantWm2,9);
    expect(MERCURY_PLANET.rotation.solarDayHours).toBe(MERCURY_PLANET.orbit.yearEarthDays*48);
    expect(illumination(MERCURY_PLANET,90,0).daylightHours).toBeNull();
  });
  it('reverses near perihelion but never for the circular 3:2 counterfactual',()=>{
    expect(mercuryMoment(DEFAULT_MERCURY).reversing).toBe(true);
    expect(mercuryMoment({...DEFAULT_MERCURY,cycles:.5}).reversing).toBe(false);
    expect(mercurySeries({...DEFAULT_MERCURY,eccentricity:0}).every(x=>!x.reversing)).toBe(true);
    for(const cycles of [.01,.1,.45,.9,1,1.99]){
      const x=mercuryMoment({...DEFAULT_MERCURY,cycles}),h=1e-6;
      const numerical=(mercuryMoment({...DEFAULT_MERCURY,cycles:cycles+h}).sunBodyLongitude-mercuryMoment({...DEFAULT_MERCURY,cycles:cycles-h}).sunBodyLongitude)/(2*h*MERCURY_PLANET.orbit.yearEarthDays);
      expect(x.apparentRateDegPerDay).toBeCloseTo(numerical,7);
    }
  });
  it('local sunlight and elevation obey independent hour-angle geometry',()=>{
    for(const lat of [-90,-45,0,70,90])for(const lon of [-90,0,90])for(const cycles of [0,.4,1,1.4,2]){
      const x=mercuryMoment({...DEFAULT_MERCURY,latitude:lat,longitude:lon,cycles});
      const delta=Math.asin(Math.sin(.034*D)*Math.sin(x.seasonalLongitude*D));
      const mu=Math.sin(lat*D)*Math.sin(delta)+Math.cos(lat*D)*Math.cos(delta)*Math.cos(x.hourAngleDeg*D);
      expect(x.instantWm2).toBeCloseTo(x.fluxWm2*Math.max(0,Math.abs(mu)<1e-12?0:mu),7);
    }
  });
  it('has three horizon crossings around the middle perihelion for the 90-degree meridian',()=>{
    let crossings=0,old=mercuryMoment({...DEFAULT_MERCURY,longitude:90,cycles:.9}).elevationDeg;
    for(let i=1;i<=4000;i++){const y=mercuryMoment({...DEFAULT_MERCURY,longitude:90,cycles:.9+i*.2/4000}).elevationDeg;
      if(old*y<0)crossings++;old=y;}
    expect(crossings).toBe(3);
  });
});
describe('Mercury state and export',()=>{
  it('preserves scientific state without userinfo, search or playback',()=>{
    const s={...DEFAULT_MERCURY,cycles:1,longitude:90};expect(parseMercuryHash(mercuryHash(s))).toEqual(s);
    const u=new URL(mercuryURL('https://u:p@e.test/mercury-lab.html?x=secret',s));expect(u.username+u.password+u.search).toBe('');
    const lines=mercuryCSV(s).trim().split('\n');expect(lines).toHaveLength(722);expect(lines.at(-1)!.split(',')[2]).toBe('3');
    expect(validateMercury(s)).not.toBe(s);
  });
  it('rejects unknown, oversized, duplicate or malformed state without coercion',()=>{
    for(const x of [{...DEFAULT_MERCURY,latitude:null},{...DEFAULT_MERCURY,cycles:'1'},{...DEFAULT_MERCURY,version:2},{...DEFAULT_MERCURY,evil:1},{...DEFAULT_MERCURY,eccentricity:.31}])expect(()=>validateMercury(x)).toThrow();
    for(const x of ['#mercury=2&state={}',mercuryHash(DEFAULT_MERCURY)+'&mercury=1','#mercury=1&state=%zz','#'+'x'.repeat(2048)])expect(()=>parseMercuryHash(x)).toThrow();
  });
});
