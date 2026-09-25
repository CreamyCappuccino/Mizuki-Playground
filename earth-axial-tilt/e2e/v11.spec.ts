import {test,expect,type Page} from '@playwright/test';
import {DEFAULT_EXPERIMENT,encodeExperiment,experimentFile} from '../src/experiments/state';
const errors=new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{
  const list:string[]=[];errors.set(page,list);page.on('pageerror',e=>list.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|THREE/i.test(m.text()))list.push(m.text());});
});
test.afterEach(({page})=>expect(errors.get(page)).toEqual([]));
async function open(page:Page){
  await page.goto('/');await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
  await page.locator('#experiment-workbench > summary').click();
}
async function prepare(page:Page,id:string){
  await page.locator('#experiment-preset').selectOption(id);await page.locator('#experiment-apply').click();
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','ready');
}
const values=(page:Page)=>page.locator('#tilt,#rotation,#day,#location-coords,#heat-storage,#temperature-model').evaluateAll(els=>els.map(el=>el instanceof HTMLInputElement||el instanceof HTMLSelectElement?el.value:el.textContent));

test('questions apply complete experiments, stay paused and undo to the previous state',async({page})=>{
  await open(page);const before=await values(page);
  await prepare(page,'polar-contrast');
  await expect(page.locator('#compare-toggle')).toHaveAttribute('aria-pressed','true');
  await expect(page.locator('#compare-tilt-b')).toHaveValue('90');
  await expect(page.locator('#location-name')).toHaveText('North Pole');
  await expect(page.locator('#scene-view')).toHaveValue('orbit');
  await expect(page.locator('#play-year')).toHaveAttribute('aria-pressed','false');
  await page.locator('#experiment-undo').click();await expect(page.locator('#compare-toggle')).toHaveAttribute('aria-pressed','false');
  expect(await values(page)).toEqual(before);
});

test('shared URL restores all scientific fields while retaining language and large text',async({page},info)=>{
  await page.addInitScript(()=>{localStorage.setItem('earth-lab:language','ja');localStorage.setItem('earth-lab:text-size','large');});
  const state={...DEFAULT_EXPERIMENT,tilt:45,tiltB:60,day:211.5,rotation:122.3,dual:true,heatDepth:50 as const,
    latitude:-35.4,longitude:139.2,surfaceMode:'daylight' as const,sceneView:'orbit' as const,speed:4 as const};
  await page.goto('/'+encodeExperiment(state));
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
  await expect(page.locator('#language')).toHaveValue('ja');await expect(page.locator('#text-size')).toHaveValue('large');
  await expect(page.locator('#tilt-number')).toHaveValue('45');await expect(page.locator('#compare-tilt-b')).toHaveValue('60');
  await expect(page.locator('#location-coords')).toHaveText('35.40° S · 139.20° E');
  await expect(page.locator('#heat-storage')).toHaveValue('50');
  await expect(page.locator('#play-coupled')).toHaveAttribute('aria-pressed','false');
  await page.locator('#experiment-copy').click();
  expect(new URL(await page.locator('#experiment-link').inputValue()).hash).toBe(encodeExperiment(state));
  await page.screenshot({path:info.outputPath('v11-japanese-shared-orbit.png')});
});

test('invalid and future URL payloads never partially change an existing world',async({page})=>{
  await open(page);await prepare(page,'taipei-day');const before=await values(page);
  for(const hash of ['#lab=1&a=45&heat=999','#lab=90&a=0','#lab=1&lat=12','#lab=1&a=0&a=90']){
    await page.evaluate(h=>{location.hash=h;},hash);
    await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','error');
    expect(await values(page)).toEqual(before);
  }
});

test('file export and import use the same validated schema; hostile files are inert',async({page})=>{
  await open(page);await prepare(page,'thermal-slow');
  const download=page.waitForEvent('download');await page.locator('#experiment-export').click();
  const file=await download;expect(file.suggestedFilename()).toBe('earth-experiment.json');
  const state={...DEFAULT_EXPERIMENT,tilt:77,rotation:44,latitude:3,longitude:10};
  await page.locator('#experiment-file').setInputFiles({name:'saved.json',mimeType:'application/json',buffer:Buffer.from(experimentFile(state))});
  await expect(page.locator('#tilt-number')).toHaveValue('77');
  const before=await values(page);
  await page.locator('#experiment-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"application":"earth-axial-tilt","version":1,"state":{"tilt":"<script>"}}')});
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','error');expect(await values(page)).toEqual(before);
});

test('clipboard fallback is readable, snapshots become stale, and localhost limits are explained',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new Error('denied'))},configurable:true}));
  await open(page);await page.locator('#experiment-copy').click();
  await expect(page.locator('#experiment-link')).toBeFocused();
  await expect(page.locator('#experiment-notice')).toContainText('Select and copy');
  await expect(page.locator('#experiment-workbench')).toContainText('localhost');
  await page.locator('#tilt-number').fill('60');await page.locator('#tilt-number').press('Enter');
  await expect(page.locator('#experiment-link-stale')).toBeVisible();
  await page.locator('#experiment-copy').click();await expect(page.locator('#experiment-link-stale')).toBeHidden();
});

test('newer user edits win over a slow comparison import',async({page})=>{
  await open(page);
  let release:()=>void=()=>{};
  const gate=new Promise<void>(r=>{release=r;});
  await page.route('**/compareLab-*.js',async route=>{await gate;await route.continue();});
  await page.locator('#experiment-preset').selectOption('polar-contrast');await page.locator('#experiment-apply').click();
  await page.locator('#tilt-number').fill('31');await page.locator('#tilt-number').press('Enter');
  release();await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','cancelled');
  await expect(page.locator('#tilt-number')).toHaveValue('31');
  await expect(page.locator('#compare-toggle')).toHaveAttribute('aria-pressed','false');
});

test('Japanese workbench keeps large touch controls and no horizontal overflow',async({page},info)=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{localStorage.setItem('earth-lab:language','ja');localStorage.setItem('earth-lab:text-size','large');});
  await open(page);await prepare(page,'zero-seasons');
  await expect(page.locator('#experiment-observe')).toContainText('一年を再生');
  const layout=await page.locator('#experiment-workbench').evaluate(el=>({overflow:el.scrollWidth>el.clientWidth,font:parseFloat(getComputedStyle(el.querySelector('button')!).fontSize)}));
  expect(layout.overflow).toBe(false);expect(layout.font).toBeGreaterThanOrEqual(16);
  await page.locator('#experiment-workbench').screenshot({path:info.outputPath('v11-workbench-phone-ja.png')});
});


test('an invalid newer hash cancels an in-flight old URL without applying it later',async({page})=>{
  await open(page);const before=await values(page);
  let release:()=>void=()=>{};const gate=new Promise<void>(r=>{release=r;});
  await page.route('**/compareLab-*.js',async route=>{await gate;await route.continue();});
  await page.evaluate(hash=>{location.hash=hash;},encodeExperiment({...DEFAULT_EXPERIMENT,dual:true,tilt:65}));
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','loading');
  await page.evaluate(()=>{location.hash='#lab=99&a=10';});
  await expect(page.locator('#experiment-notice')).toHaveAttribute('data-status','error');
  release();await expect(page.locator('#compare-toggle')).toBeEnabled();
  expect(await values(page)).toEqual(before);
});
