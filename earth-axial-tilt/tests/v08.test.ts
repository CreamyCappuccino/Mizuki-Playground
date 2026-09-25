import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { chooseLanguage, getLanguage, msg, setLanguage, t } from '../src/ui/i18n';
import { jaMessages } from '../src/ui/messages';
import { HELP } from '../src/ui/contextHelp';
import { MODEL_SEASONS, ORBIT_RADIUS, orbitLayout } from '../src/scene/orbitLayout';
import { solarDeclinationDeg } from '../src/physics/solar';
import { sunDirection } from '../src/physics/geometry';
import { Euler, Matrix4, Vector3 } from 'three';

afterEach(() => setLanguage('en'));
describe('bilingual presentation', () => {
  it('uses an explicit saved language before browser preferences', () => {
    expect(chooseLanguage('en', 'ja-JP')).toBe('en');
    expect(chooseLanguage('ja', 'en-US')).toBe('ja');
    expect(chooseLanguage('garbage', 'ja-JP')).toBe('ja');
    expect(chooseLanguage(null, 'zh-TW')).toBe('en');
  });
  it('translates labels and parameterized values reversibly', () => {
    setLanguage('ja'); expect(getLanguage()).toBe('ja'); expect(t('Axial tilt')).toBe('地軸の傾き');
    expect(msg`Thermal EBM · ${10} m heat storage`).toBe('熱収支モデル · 蓄熱 10 m 相当');
    setLanguage('en'); expect(t('Axial tilt')).toBe('Axial tilt');
    expect(msg`Thermal EBM · ${10} m heat storage`).toBe('Thermal EBM · 10 m heat storage');
  });
  it('preserves each template placeholder exactly once in the catalog', () => {
    for(const [en,ja] of Object.entries(jaMessages)) {
      expect(ja.trim(),en).not.toBe('');
      expect((ja.match(/\{\d+\}/g)??[]).sort(),en).toEqual((en.match(/\{\d+\}/g)??[]).sort());
    }
  });
  it('has a translation for every marked static phrase', () => {
    const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const decode=(s:string)=>s.replace(/&quot;/g,'"').replace(/&#x27;|&#39;/g,"'").replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
    for(const m of html.matchAll(/data-i18n(?:-aria-label|-title|-content)?="([^"]+)"/g)) expect(jaMessages[decode(m[1])],decode(m[1])).toBeDefined();
  });
  it('provides a meaning, experiment, observation and limitation for every help topic', () => {
    expect(Object.keys(HELP).length).toBeGreaterThanOrEqual(10);
    for(const help of Object.values(HELP)) for(const text of Object.values(help)) {
      expect(text).toHaveLength(2); expect(text.every((s: string)=>s.length>0)).toBe(true);
    }
  });
});
describe('Sun-centred presentation frame', () => {
  it('puts Earth on the same circular radius with incoming light toward the Sun', () => {
    for(let day=1;day<=365;day+=7) {
      const {position}=orbitLayout(day,23.44), incoming=sunDirection(day);
      expect(Math.hypot(...position)).toBeCloseTo(ORBIT_RADIUS,10);
      position.forEach((v,i)=>expect(-v/ORBIT_RADIUS).toBeCloseTo(incoming[i],12));
    }
  });
  it('retains axis direction through the full orbit, even at extreme tilt', () => {
    for(const tilt of [0,23.44,45,90]) for(const s of MODEL_SEASONS) {
      expect(orbitLayout(s.day,tilt).axis).toEqual(orbitLayout(1,tilt).axis);
      const normal=new Vector3(0,1,0).transformDirection(new Matrix4().makeRotationFromEuler(new Euler(tilt*Math.PI/180,137*Math.PI/180,0,'XYZ')));
      normal.toArray().forEach((v,i)=>expect(v).toBeCloseTo(orbitLayout(s.day,tilt).axis[i],12));
    }
  });
  it('matches astronomical declination independently of presentation distance', () => {
    for(const tilt of [0,23.44,45,90]) for(const {day} of MODEL_SEASONS) {
      const {axis,position}=orbitLayout(day,tilt);
      const dot=axis.reduce((sum,a,i)=>sum-a*position[i]/ORBIT_RADIUS,0);
      expect(Math.asin(Math.max(-1,Math.min(1,dot)))*180/Math.PI).toBeCloseTo(solarDeclinationDeg(day,tilt),8);
    }
  });
  it('rejects malformed presentation inputs', () => {
    expect(()=>orbitLayout(NaN,23.44)).toThrow(); expect(()=>orbitLayout(172,91)).toThrow();
  });
});
