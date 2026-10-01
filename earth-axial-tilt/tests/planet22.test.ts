import { describe,it,expect } from 'vitest';
import { EARTH_PLANET,URANUS_PLANET } from '../src/planet/definitions';
import { planetaryMomentAtSeason } from '../src/planet/astronomy';
import { dot,illumination,seasonAtElapsed,spinPole,surfaceNormal,sunDirection,worldDefinition } from '../src/planet/geometry';
import { DEFAULT_EXPLORER,explorerFile,explorerHash,parseExplorerFile,parseExplorerHash,validateExplorer } from '../src/planet/explorerState';

describe('Uranus directed-spin geometry',()=>{
  it('uses >90 degree tilt once, and agrees with dot-product declination',()=>{
    expect(spinPole(97.77)[2]).toBeLessThan(0);
    for(const tilt of [0,23.44,90,97.77,180])for(const ls of [0,45,90,180,270,359]){
      const p=worldDefinition({id:'earth',tilt});
      expect(dot(spinPole(tilt),sunDirection(ls))).toBeCloseTo(Math.sin(illumination(p,ls,25).declination*Math.PI/180),13);
    }
    expect(illumination(URANUS_PLANET,90,65).rotationFraction).toBe(1);
    expect(illumination(URANUS_PLANET,270,65).rotationFraction).toBe(0);
    expect(illumination(URANUS_PLANET,90,0).declination).toBeCloseTo(82.23,10);
  });
  it('wraps each independent year and inverts season time',()=>{
    for(const p of [EARTH_PLANET,URANUS_PLANET])for(const ls of [1,45,90,180,270,359]){
      const days=planetaryMomentAtSeason(p,ls).elapsedEarthDays;
      expect(seasonAtElapsed(p,days)).toBeCloseTo(ls,9);
      expect(seasonAtElapsed(p,days+2*p.orbit.yearEarthDays)).toBeCloseTo(ls,9);
    }
  });
  it('frozen rotational means match independent longitude integration',()=>{
    for(const p of [EARTH_PLANET,URANUS_PLANET,worldDefinition({id:'earth',tilt:90})])for(const lat of [-80,-25,0,65,90])for(const ls of [0,90,270]){
      const S=planetaryMomentAtSeason(p,ls).irradianceWm2,N=14400;
      let total=0;
      for(let j=0;j<N;j++)total+=Math.max(0,dot(surfaceNormal(p.rotation.obliquityDeg,lat,(j+.5)*360/N,0),sunDirection(ls)))*S/N;
      expect(Math.abs(total-illumination(p,ls,lat).frozenMeanWm2)).toBeLessThan(5e-5);
    }
    const horizon=illumination(worldDefinition({id:'earth',tilt:90}),90,0);
    expect(horizon.rotationFraction).toBe(.5);expect(horizon.frozenMeanWm2).toBeLessThan(1e-10);
  });
});

describe('Explorer state is atomic and separate from Earth formats',()=>{
  it('round-trips, copies nested worlds, and imports the legacy Earth/Mars comparison',()=>{
    expect(parseExplorerHash(explorerHash(DEFAULT_EXPLORER))).toEqual(DEFAULT_EXPLORER);
    expect(parseExplorerFile(explorerFile(DEFAULT_EXPLORER))).toEqual(DEFAULT_EXPLORER);
    const x=validateExplorer(DEFAULT_EXPLORER);x.a.tilt=90;expect(DEFAULT_EXPLORER.a.tilt).toBe(null);
    const legacy=parseExplorerHash('#planet=1&a=mars&b=earth&ls=251&lat=-30')!;
    expect(legacy.a.id).toBe('mars');expect(legacy.season).toBe(251);expect(legacy.latitude).toBe(-30);
  });
  it('rejects unknown, incomplete, oversized, nonfinite and out of bound payloads',()=>{
    for(const value of [null,[],{}, {...DEFAULT_EXPLORER,days:NaN},{...DEFAULT_EXPLORER,latitude:91},
      {...DEFAULT_EXPLORER,a:{id:'venus',tilt:null}},{...DEFAULT_EXPLORER,a:{id:'earth',tilt:181}},
      {...DEFAULT_EXPLORER,extra:1},{...DEFAULT_EXPLORER,a:{id:'earth',tilt:null,extra:1}}])expect(()=>validateExplorer(value)).toThrow();
    for(const h of ['#explorer=2&state={}','#explorer=1&explorer=1&state={}','#explorer=1&state=%zz','#planet=1&a=earth&b=mars&ls=&lat=25','#'+ 'x'.repeat(4100)])expect(()=>parseExplorerHash(h)).toThrow();
  });
});
