import {test,expect} from 'vitest';
import {PLANET_ORDER,planetSummary,comparisonRecipe,explorerCSV,galleryCSV} from '../src/planet/synthesis';
import {PLANETS} from '../src/planet/definitions';
import {DEFAULT_EXPLORER,explorerFile,parseExplorerFile,explorerHash,parseExplorerHash} from '../src/planet/explorerState';
import {worldDefinition,seasonAtElapsed,illumination} from '../src/planet/geometry';
import {planetaryMomentAtSeason} from '../src/planet/astronomy';
import {readFileSync} from 'node:fs';

test('all four native worlds share explicit units, capabilities and time-weighted flux',()=>{
  expect(PLANET_ORDER).toEqual(['earth','mars','uranus','mercury']);
  for(const id of PLANET_ORDER){const p=PLANETS[id],s=planetSummary(id);let mean=0;
    for(let i=0;i<1024;i++)mean+=planetaryMomentAtSeason(p,seasonAtElapsed(p,p.orbit.yearEarthDays*(i+.5)/1024)).irradianceWm2/1024;
    expect(s.annualRayNormalMean).toBeCloseTo(mean,8);expect(s.perihelionAU).toBeLessThan(s.aphelionAU);
    expect(s.siderealHours).toBeGreaterThan(0);expect(s.meanSolarHours).toBeGreaterThan(0);
    expect(s.climate).toBe(id==='earth'?'earth-existing':'none');
  }
  const u=planetSummary('uranus');expect(u.meanSolarHours).toBeLessThan(u.siderealHours);
  const m=planetSummary('mercury');expect(m.meanSolarHours/24/m.yearDays).toBe(2);
});
test('all 16 planet pairs and modified poles round-trip without flattening worlds',()=>{
  for(const a of PLANET_ORDER)for(const b of PLANET_ORDER)for(const tilt of [null,0,90,180]){
    const x={...DEFAULT_EXPLORER,a:{id:a,tilt},b:{id:b,tilt:null}};
    expect(parseExplorerHash(explorerHash(x))).toEqual(x);expect(parseExplorerFile(explorerFile(x))).toEqual(x);
  }
});
test('recipes state exactly the question being asked and preserve native definitions',()=>{
  const before=JSON.stringify(PLANETS),a=comparisonRecipe('sideways'),b=comparisonRecipe('clocks'),c=comparisonRecipe('distance');
  expect(a.a.tilt).toBe(90);expect(a.b.id).toBe('uranus');expect(b.clock).toBe('elapsed');expect(b.days).toBe(365);
  expect(c.a.tilt).toBe(0);expect(c.b.tilt).toBe(0);expect(c.b.id).toBe('mercury');
  expect(worldDefinition(a.a).rotation.obliquityDeg).toBe(90);expect(JSON.stringify(PLANETS)).toBe(before);
  const eq=comparisonRecipe('equal');for(const ls of [0,90,180,270])expect(illumination(worldDefinition(eq.a),ls,65)).toEqual(illumination(worldDefinition(eq.b),ls,65));
});
test('seasonal CSV carries exact computed values, equal-angle labels and finite cells',()=>{
  const s=comparisonRecipe('sideways'),text=explorerCSV(s),lines=text.trim().split('\n');expect(lines).toHaveLength(363);
  const a=lines[1].split(','),b=lines[182].split(',');expect(a.slice(0,2)).toEqual(['A','earth']);expect(b.slice(0,2)).toEqual(['B','uranus']);
  for(const row of lines.slice(1))expect(row.split(',').slice(2).every(x=>Number.isFinite(Number(x)))).toBe(true);
  expect(galleryCSV().trim().split('\n')).toHaveLength(5);
  expect(()=>explorerCSV({...s,latitude:Infinity})).toThrow();
});
test('new pages carry complete bilingual static labels and unique IDs',()=>{
  for(const file of ['planet-explorer.html','mercury-lab.html']){
    const s=readFileSync(file,'utf8'),ids=[...s.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);expect(new Set(ids).size).toBe(ids.length);
    for(const tag of s.match(/<[^>]*\bdata-en=[^>]*>/g)??[]){expect(tag).toMatch(/data-ja="[^"]+"/);expect(tag).toMatch(/data-en="[^"]+"/);}
  }
});
