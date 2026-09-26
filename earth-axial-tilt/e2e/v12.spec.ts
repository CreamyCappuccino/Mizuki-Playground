import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_EXPERIMENT,encodeExperiment,decodeExperiment,experimentFile,type ExperimentState} from '../src/experiments/state';
import {solveSeasonalClimate,sampleThermalTemperature} from '../src/physics/energyBalance';
test.setTimeout(90_000);
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/i.test(m.text()))list.push(m.text());});});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function open(page:Page,state:Partial<ExperimentState>={}){
  await page.goto('/'+encodeExperiment({...DEFAULT_EXPERIMENT,...state}));
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  if(state.dual)await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
  await page.locator('#orbit-workbench > summary').click();
}
async function change(page:Page,id:string,value:string){await page.locator(id).fill(value);await page.locator(id).press('Enter');}
const distance=(page:Page)=>page.locator('#orbit-values').getAttribute('data-distance').then(Number);
const flux=(page:Page)=>page.locator('#orbit-values').getAttribute('data-flux').then(Number);

test('circle degeneracy, Kepler apsides and inverse-square diagnostics are actionable',async({page},info)=>{
  await open(page,{sceneView:'orbit'});
  expect(await distance(page)).toBe(1);expect(await flux(page)).toBe(1361);
  await expect(page.locator('#orbit-near')).toBeDisabled();await expect(page.locator('#orbit-peri')).toBeDisabled();
  await page.locator('#orbit-summer').click();await page.locator('#orbit-near').click();
  expect(await distance(page)).toBeCloseTo(.8,10);const near=await flux(page);expect(near).toBeCloseTo(1361/.64,8);
  const fast=Number(await page.locator('#orbit-values').getAttribute('data-speed'));
  await page.locator('#orbit-far').click();expect(await distance(page)).toBeCloseTo(1.2,10);
  expect(near/await flux(page)).toBeCloseTo(2.25,10);
  expect(fast).toBeGreaterThan(Number(await page.locator('#orbit-values').getAttribute('data-speed')));
  await change(page,'#orbit-e','.31');await expect(page.locator('#orbit-e')).toHaveValue('0.2');await expect(page.locator('#orbit-input-status')).not.toBeEmpty();
  await page.locator('#orbit-classic').click();expect(await distance(page)).toBe(1);await expect(page.locator('#orbit-near')).toBeDisabled();
  await page.screenshot({path:info.outputPath('v12-classic-orbit.png')});
});

test('same tilt with different orbits differs, then copying orbit makes all A/B differences zero',async({page},info)=>{
  await open(page,{dual:true,tiltB:23.44,eccentricity:.2,perihelion:90,eccentricityB:.2,perihelionB:270,sceneView:'orbit',surfaceMode:'insolation'});
  expect(Number(await page.locator('#compare-solar [data-column="diff"]').getAttribute('data-value'))).not.toBe(0);
  await expect(page.locator('#compare-context')).toContainText('elapsed model day');
  await page.screenshot({path:info.outputPath('v12-perihelion-comparison.png'),fullPage:true});
  await page.locator('#orbit-copy-a').click();await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
  for(const metric of ['solar','daylight','temperature'])await expect(page.locator(`#compare-${metric} [data-column="diff"]`)).toHaveAttribute('data-value','0');
  await page.locator('#orbit-side').selectOption('B');await expect(page.locator('#orbit-peri')).toHaveValue('90');
  await page.locator('#compare-exit').click();await expect(page.locator('#orbit-side')).toHaveValue('A');
});

test('rapid orbit edits clear old temperature immediately and compute only the final requested climate',async({page})=>{
  await open(page,{surfaceMode:'temperature'});
  const intermediate=await page.evaluate(()=>{
    const set=(id:string,v:string)=>{const el=document.getElementById(id) as HTMLInputElement;el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));};
    set('orbit-e','.1');set('orbit-e','.2');set('orbit-peri','270');set('orbit-axis','30');
    return {status:document.getElementById('climate-status')!.dataset.status,temperature:document.getElementById('metric-temp')!.textContent};
  });
  expect(intermediate.status).toBe('loading');expect(intermediate.temperature).toContain('Calculating');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  const solution=solveSeasonalClimate(23.44,10,{orbit:{eccentricity:.2,perihelion:270,axis:30}});
  await expect(page.locator('#metric-temp')).toHaveText(`${sampleThermalTemperature(solution,25.033,172).toFixed(1)} °C`);
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-temperature-layer','energy-balance');
});

test('old links remain circular, while schema2 files restore independent A/B orbits',async({page})=>{
  await page.goto('/#lab=1&a=45&dual=1&b=0&day=172');await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','ready');
  await page.locator('#orbit-workbench > summary').click();await expect(page.locator('#orbit-e')).toHaveValue('0');
  await page.locator('#experiment-workbench > summary').click();
  const state={...DEFAULT_EXPERIMENT,dual:true,eccentricity:.3,perihelion:90,axisAzimuth:30,eccentricityB:.1,perihelionB:270,axisAzimuthB:120};
  await page.locator('#experiment-file').setInputFiles({name:'orbit.json',mimeType:'application/json',buffer:Buffer.from(experimentFile(state))});
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','ready');await expect(page.locator('#orbit-e')).toHaveValue('0.3');
  await page.locator('#orbit-side').selectOption('B');await expect(page.locator('#orbit-axis')).toHaveValue('120');
  await page.locator('#experiment-copy').click();
  expect(decodeExperiment(new URL(await page.locator('#experiment-link').inputValue()).hash)).toEqual({status:'ok',state});
  await page.locator('#experiment-undo').click();await expect(page.locator('#orbit-e')).toHaveValue('0');
});

test('Japanese large phone controls wrap, have touch targets and include the orbit guide',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});await page.addInitScript(()=>{localStorage.setItem('earth-lab:language','ja');localStorage.setItem('earth-lab:text-size','large');});
  await open(page,{eccentricity:.2,perihelion:90,sceneView:'orbit'});
  await expect(page.locator('#orbit-values')).toContainText('距離');await expect(page.locator('#orbit-values')).not.toContainText('Distance');
  const layout=await page.locator('#orbit-workbench').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth+1,fonts:[...el.querySelectorAll('input,button')].map(e=>parseFloat(getComputedStyle(e).fontSize)),heights:[...el.querySelectorAll('.orbit-actions button')].map(e=>e.getBoundingClientRect().height)}));
  expect(layout.overflow).toBe(false);expect(Math.min(...layout.fonts)).toBeGreaterThanOrEqual(16);expect(Math.min(...layout.heights)).toBeGreaterThanOrEqual(44);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.locator('#orbit-workbench').screenshot({path:info.outputPath('v12-orbit-panel-phone-ja.png')});
  await page.locator('[data-help-topic="kepler"]').click();await expect(page.locator('#help-title')).toHaveText('軌道の実験室');
  await expect(page.locator('#help-body')).toContainText('歳差');await page.keyboard.press('Escape');
  await expect(page.locator('[data-help-topic="kepler"]')).toBeFocused();
});

test('language, Basic and Focus switches preserve A/B orbital parameters',async({page},info)=>{
  await page.setViewportSize({width:1440,height:1000});
  await open(page,{dual:true,tiltB:45,eccentricity:.2,perihelion:90,eccentricityB:.1,perihelionB:270,sceneView:'orbit'});
  // Numeric state is compared through settings serialization, not translated labels.
  await page.locator('#experiment-workbench > summary').click();await page.locator('#experiment-copy').click();const before=new URL(await page.locator('#experiment-link').inputValue()).hash;
  await page.locator('#language').selectOption('ja');await page.locator('#text-size').selectOption('large');
  await page.locator('#tools-mode').selectOption('basic');await page.locator('#focus-view').click();
  await expect(page.locator('#earth-canvas')).toHaveAttribute('data-view-b',/"eccentricity":0.1/);
  await page.screenshot({path:info.outputPath('v12-dual-focus-ja.png')});await page.keyboard.press('Escape');
  await page.locator('#tools-mode').selectOption('all');await page.locator('#experiment-copy').click();
  expect(new URL(await page.locator('#experiment-link').inputValue()).hash).toBe(before);
});

test('zero tilt still has distance forcing and extreme thermal extrapolation remains visibly labelled',async({page},info)=>{
  await open(page,{tilt:0,eccentricity:.2,perihelion:90});
  await expect(page.locator('#orbit-axis')).toBeDisabled();await expect(page.locator('#orbit-degeneracy')).toContainText('zero tilt');
  await page.locator('#orbit-near').click();const light=await page.locator('#metric-daylight').textContent(),near=await flux(page);
  await page.locator('#orbit-far').click();expect(await page.locator('#metric-daylight').textContent()).toBe(light);expect(await flux(page)).toBeLessThan(near);
  await change(page,'#tilt-number','90');await change(page,'#orbit-e','.3');await page.locator('#heat-storage').selectOption('2.5');
  await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');await expect(page.locator('#climate-warning')).toBeVisible();await expect(page.locator('#climate-warning')).toContainText('not predictions');
  await page.screenshot({path:info.outputPath('v12-linear-ebm-warning.png'),fullPage:true});
});

test('atlas explicitly uses A orbit at 23.44 degrees, not the comparison orbit',async({page},info)=>{
  await open(page,{dual:true,tilt:45,eccentricity:.2,perihelion:90,eccentricityB:.3,perihelionB:270});
  await page.locator('#open-atlas').click();await expect(page.locator('#season-atlas')).toBeVisible();
  await expect(page.locator('#season-atlas')).toContainText('23.44° with Earth A’s orbit and heat storage');
  await page.screenshot({path:info.outputPath('v12-atlas-reference.png')});
});
