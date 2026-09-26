import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_EXPERIMENT, encodeExperiment } from '../src/experiments/state';

const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{
  const list:string[]=[];errors.set(page,list);
  page.on('pageerror',error=>list.push(error.message));
  page.on('console',message=>{if(message.type()==='error'&&/THREE|WebGL|shader/i.test(message.text()))list.push(message.text());});
});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function ready(page:Page){
  await page.goto('/');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#visual-status')).toHaveAttribute('data-status','ready');
}
async function range(page:Page,id:string,value:string){
  await page.locator(id).fill(value);await page.locator(id).dispatchEvent('input');
}

test('eccentric orbit drives distance, inverse-square flux, speed and dynamic season navigation',async({page},info)=>{
  await ready(page);
  await range(page,'#orbit-eccentricity','0.4');
  await range(page,'#orbit-perihelion','40');
  await range(page,'#orbit-axis','20');
  await expect(page.locator('#metric-distance')).not.toHaveText('1.000 AU');
  await expect(page.locator('#metric-relative-flux')).not.toHaveText('×1.000');
  await page.locator('#scene-view').selectOption('orbit');
  await page.locator('[data-season-day="171.25"]').click();
  const day=Number(await page.locator('#day').inputValue());
  expect(day).not.toBe(171);
  const view=JSON.parse((await page.locator('#earth-canvas').getAttribute('data-view-a'))!);
  expect(view.orbit.eccentricity).toBe(.4);
  const tilt=23.44*Math.PI/180,axis=20*Math.PI/180;
  expect(view.axis[0]).toBeCloseTo(-Math.sin(tilt)*Math.sin(axis),7);
  expect(view.axis[1]).toBeCloseTo(Math.cos(tilt),7);
  expect(view.axis[2]).toBeCloseTo(-Math.sin(tilt)*Math.cos(axis),7);
  await page.screenshot({path:info.outputPath('v12-eccentric-orbit.png'),fullPage:true});
});

test('circular orbit explains the undefined perihelion direction and remains direction-degenerate',async({page})=>{
  await ready(page);
  await expect(page.locator('#orbit-degenerate')).toContainText('every point is equally near');
  const before=await page.locator('#earth-canvas').getAttribute('data-earth-position');
  await range(page,'#orbit-perihelion','237');
  await expect(page.locator('#metric-distance')).toHaveText('1.000 AU');
  await expect(page.locator('#metric-relative-flux')).toHaveText('×1.000');
  expect(await page.locator('#earth-canvas').getAttribute('data-earth-position')).toBe(before);
});

test('Compare A/B accepts independent orbit parameters without mixing thermal results',async({page})=>{
  await ready(page);await page.locator('#compare-toggle').click();
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
  await page.locator('#compare-preset').selectOption('eccentricity');
  await expect(page.locator('#compare-b-eccentricity')).toHaveValue('0.3');
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready',{timeout:30_000});
  const views=await page.locator('#earth-canvas').evaluate(el=>({
    a:JSON.parse((el as HTMLElement).dataset.viewA!),b:JSON.parse((el as HTMLElement).dataset.viewB!),
  }));
  expect(views.a.orbit.eccentricity).toBe(0);
  expect(views.b.orbit.eccentricity).toBe(.3);
  expect(views.a.day).toBe(views.b.day);
});

test('schema 1 migrates to classic orbit while schema 2 restores every orbit field',async({page})=>{
  await page.goto('/#lab=1&a=45');
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#orbit-eccentricity')).toHaveValue('0');
  const state={...DEFAULT_EXPERIMENT,eccentricityA:.2,eccentricityB:.4,
    perihelionLongitudeA:35,perihelionLongitudeB:215,axisLongitudeA:10,axisLongitudeB:190,dual:true};
  await page.evaluate(hash=>{location.hash=hash;},encodeExperiment(state));
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready',{timeout:30_000});
  await expect(page.locator('#orbit-eccentricity')).toHaveValue('0.2');
  await expect(page.locator('#compare-b-eccentricity')).toHaveValue('0.4');
  await expect(page.locator('#compare-b-perihelion')).toHaveValue('215');
  await expect(page.locator('#compare-b-axis')).toHaveValue('190');
});

test('Japanese large mobile orbit controls remain readable without horizontal overflow',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{localStorage.setItem('earth-lab:language','ja');localStorage.setItem('earth-lab:text-size','large');});
  await ready(page);
  await expect(page.locator('.orbit-mechanics')).toContainText('軌道力学');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('.orbit-mechanics').screenshot({path:info.outputPath('v12-orbit-controls-mobile-ja.png')});
});
