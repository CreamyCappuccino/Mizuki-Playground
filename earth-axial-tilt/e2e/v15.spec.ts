import { test, expect, type Page } from '@playwright/test';
import { DEFAULT_SWEEP, validateSweep } from '../src/synthesis/model';
import { sweepHash, sweepFile } from '../src/synthesis/state';
import { earthState } from '../src/synthesis/bridges';
async function open(page:Page){await page.goto('/synthesis-lab.html');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','idle');await page.locator('#sy-language').selectOption('en');}
async function run(page:Page){await page.locator('#sy-run').click();await expect(page.locator('#sy-status')).toHaveAttribute('data-status','ready');}
async function metric(page:Page,key:string){return page.locator(`#sy-cards [data-metric="${key}"]`).evaluate(n=>({a:Number((n as HTMLElement).dataset.a),b:Number((n as HTMLElement).dataset.b)}));}
test('real orbital sweep measures stronger shorter seasons and distinct energy, then exports metrics',async({page},info)=>{
 await open(page);await run(page);await expect(page.locator('#sy-selected option')).toHaveCount(13);
 const q=await metric(page,'solstice'),days=await metric(page,'halfDays'),energy=await metric(page,'halfEnergy');
 expect(q.a).toBeGreaterThan(q.b);expect(days.a).toBeLessThan(days.b);expect(Math.abs(energy.a-energy.b)).toBeLessThan(1e-6);
 await expect(page.locator('#sy-annual .sy-curve')).toHaveCount(2);await expect(page.locator('#sy-map')).toHaveAttribute('data-rows','13');
 expect(Number(await page.locator('#sy-status').getAttribute('data-retained-bytes'))).toBeLessThan(200000);
 await page.locator('#sy-trend').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('v15-orbital-sweep.png')});
 await page.locator('#sy-map').screenshot({path:info.outputPath('v15-seasonal-angle-map.png')});
 await page.locator('#sy-recipes').screenshot({path:info.outputPath('v15-earth-story-recipes.png')});
 await page.screenshot({path:info.outputPath('v15-workspace-full.png'),fullPage:true});
 await page.locator('summary[data-sy="share"]').click();
 const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#sy-csv').click()]);expect(download.suggestedFilename()).toBe('earth-orbital-sweep.csv');
 await page.locator('#sy-link').click();await expect(page.locator('#sy-url')).toHaveValue(/synthesis=1/);
});
test('circle degeneracy, count changes and cancellation never display a previous sweep',async({page})=>{
 await open(page);await run(page);await page.locator('#sy-eccentricity').fill('0');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','idle');await expect(page.locator('#sy-cards>div')).toHaveCount(0);await run(page);
 const q=await metric(page,'solstice');expect(q.a).toBe(q.b);expect((await metric(page,'halfDays')).a).toBe(182.5);
 await page.locator('#sy-count').fill('41');
 await page.evaluate(()=>{document.querySelector<HTMLFormElement>('#sy-form')!.requestSubmit();document.querySelector<HTMLButtonElement>('#sy-cancel')!.click();});
 await expect(page.locator('#sy-status')).toHaveAttribute('data-status','canceled');await expect(page.locator('#sy-cards>div')).toHaveCount(0);
 await page.locator('#sy-large').check();await expect(page.locator('#sy-status')).toHaveAttribute('data-status','canceled');await run(page);await expect(page.locator('#sy-selected option')).toHaveCount(41);
});
test('same-document settings, JSON, invalid hashes and reload restore are atomic and idle',async({page})=>{
 await open(page);await run(page);await page.evaluate(()=>{location.hash='synthesis=99&state=invalid';});
 await expect(page.locator('#sy-error')).toContainText('Invalid');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','ready');
 const next=validateSweep({...DEFAULT_SWEEP,latitude:-65,summer:270});
 await page.evaluate(hash=>{location.hash=hash;},sweepHash(next));await expect(page.locator('#sy-latitude')).toHaveValue('-65');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','idle');
 await page.reload();await expect(page.locator('#sy-summer')).toHaveValue('270');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','idle');
 await page.locator('summary[data-sy="share"]').click();await page.locator('#sy-json').fill(sweepFile(next).replace('"count": 13','"count": 999'));await page.locator('#sy-apply').click();await expect(page.locator('#sy-count')).toHaveValue('13');
 await page.locator('#sy-json').fill(sweepFile({...next,latitude:30}));await page.locator('#sy-apply').click();await expect(page.locator('#sy-latitude')).toHaveValue('30');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','idle');
});
test('Japanese Large mobile remains readable, keyboard-selectable, and needs no climate worker',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{const Native=window.Worker;(window as unknown as {workers:number}).workers=0;window.Worker=class extends Native{constructor(url:string|URL,options?:WorkerOptions){super(url,options);(window as unknown as {workers:number}).workers++;}};});
 await open(page);await page.locator('#sy-language').selectOption('ja');await page.locator('#sy-large').check();await run(page);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator('#sy-selected').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');await page.locator('#sy-comparison').selectOption('0');
 await expect(page.locator('#sy-status')).toHaveAttribute('data-status','ready');
 expect(await page.evaluate(()=>(window as unknown as {workers:number}).workers)).toBe(0);
 await page.locator('#sy-trend').scrollIntoViewIfNeeded();expect(await page.locator('#sy-trend svg').evaluate(n=>parseFloat(getComputedStyle(n).fontSize))).toBeGreaterThanOrEqual(17);
 await page.screenshot({path:info.outputPath('v15-mobile-ja.png')});
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));
 await page.locator('#sy-comparison').selectOption('3');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','ready');
});
test('exact A/B settings reach the existing 3D Earth and Season Atlas',async({page},info)=>{
 test.setTimeout(90000);await open(page);await run(page);await page.locator('#sy-profile').selectOption('earth-geography');await page.locator('#sy-longitude').fill('105');await page.locator('#sy-longitude').press('Tab');
 const expected=earthState(validateSweep({...DEFAULT_SWEEP,profile:'earth-geography',longitude:105}));
 await page.locator('#sy-earth').click();await expect(page.locator('#climate-geography')).toHaveValue('earth-geography');
 await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready',{timeout:60000});
 await expect(page.locator('#compare-tilt-b')).toHaveValue(String(expected.tiltB));
 await expect(page.locator('#earth-canvas')).toHaveAttribute('data-scene-view','orbit');
 await page.locator('#open-atlas').click();await expect(page.locator('#season-atlas')).toBeVisible();
 await expect(page.locator('#atlas-location-note')).toContainText('105');
 await page.screenshot({path:info.outputPath('v15-earth-atlas-bridge.png')});
});
test('orbit-only bridge opens paused zonal feedback with named material storage, never geographic feedback',async({page})=>{
 await open(page);await run(page);await page.locator('#sy-profile').selectOption('idealized-ocean');await expect(page.locator('#sy-storage')).toContainText('50');await page.locator('#sy-feedback').click();
 await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');await expect(page.locator('#fb-depth')).toHaveValue('50');
 await expect(page.locator('#fb-peri')).toHaveValue('90');await expect(page.locator('#fb-latitude')).toHaveValue('65');
});
test('parameter switches retain background edits and invalid destination edits stay disabled after resize',async({page})=>{
 await open(page);await page.locator('#sy-tilt').fill('60');await page.locator('#sy-eccentricity').fill('0.2');await page.locator('#sy-parameter').selectOption('eccentricity');
 await expect(page.locator('#sy-tilt')).toHaveValue('60');await expect(page.locator('#sy-end')).toHaveValue('0.3');await run(page);
 await page.locator('#sy-longitude').fill('999');await page.locator('#sy-longitude').press('Tab');await expect(page.locator('#sy-earth')).not.toHaveAttribute('href');
 await page.setViewportSize({width:900,height:800});await expect(page.locator('#sy-earth')).not.toHaveAttribute('href');await expect(page.locator('#sy-status')).toHaveAttribute('data-status','ready');
 await page.locator('#sy-longitude').fill('0');await page.locator('#sy-longitude').press('Tab');await expect(page.locator('#sy-earth')).toHaveAttribute('href',/lab=4/);
 await expect(page.locator('#sy-recipes a')).toHaveCount(7);
});
