import {test,expect,type Page} from '@playwright/test';
test.setTimeout(90_000);
const errors = new WeakMap<Page,string[]>();
test.beforeEach(({page})=>{
  const list:string[]=[];errors.set(page,list);
  page.on('pageerror',error=>list.push(error.message));
  page.on('console',message=>{ if(message.type()==='error' && /THREE|WebGL|shader/i.test(message.text()))list.push(message.text()); });
});
test.afterEach(({page})=>{ expect(errors.get(page)).toEqual([]); });
test('optional labs load on demand; Basic/All changes visibility, never the experiment',async({page},info)=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));
 await page.goto('/');await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
 expect(requests.some(u=>/\/(seasonAtlas|compareLab)-/.test(u))).toBe(false);
 const science=()=>page.locator('#tilt,#day,#rotation,#metric-temp').evaluateAll(els=>els.map(el=>el instanceof HTMLInputElement?el.value:el.textContent));
 const before=await science();
 await page.locator('#language').selectOption('ja');
 await page.locator('#tools-mode').selectOption('basic');
 await expect(page.locator('.appearance-controls')).toBeHidden();
 await expect(page.locator('#quick-start')).toBeVisible();
 await page.locator('#intro-dismiss').click();await page.reload();
 await expect(page.locator('#tools-mode')).toHaveValue('basic');await expect(page.locator('#quick-start')).toBeHidden();
 await page.locator('#tools-mode').selectOption('all');
 await expect(page.locator('.appearance-controls')).toBeVisible();
 await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
 expect(await science()).toEqual(before);
 await page.locator('#open-atlas').click();await expect(page.locator('#season-atlas')).toBeVisible();
 expect(requests.some(u=>/\/seasonAtlas-/.test(u))).toBe(true);
 await page.screenshot({path:info.outputPath('v10-atlas-ja.png')});
});

test('comparison and atlas clearly identify their different reference worlds',async({page})=>{
 await page.goto('/');await page.locator('#compare-toggle').click();
 await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
 await page.locator('#open-atlas').click();
 await expect(page.locator('#atlas-comparison-note')).toBeVisible();
 await expect(page.locator('#atlas-comparison-note')).toContainText('not with Earth B');
 await page.keyboard.press('Escape');await page.locator('#compare-exit').click();
 await page.locator('#open-atlas').click();await expect(page.locator('#atlas-comparison-note')).toBeHidden();
});

test('failed optional module is retryable while the primary planet remains usable',async({page})=>{
 await page.goto('/');await expect(page.locator('#climate-status')).toHaveAttribute('data-status','ready');
 await page.route('**/seasonAtlas-*.js',r=>r.abort());
 await page.locator('#open-atlas').click();await expect(page.locator('#open-atlas')).toContainText('Reload to retry');
 await expect(page.locator('#tilt')).toBeEnabled();
 await page.unroute('**/seasonAtlas-*.js');
 // Browser module maps may retain an import failure. Reload is always a supported recovery.
 await page.locator('#open-atlas').click();await page.waitForLoadState();await page.locator('#open-atlas').click();await expect(page.locator('#season-atlas')).toBeVisible();
});

test('Japanese large landscape controls and modal focus survive display switches',async({page},info)=>{
 await page.setViewportSize({width:844,height:390});await page.goto('/');
 await page.locator('#language').selectOption('ja');await page.locator('#text-size').selectOption('large');
 await page.locator('#compare-toggle').click();await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
 await expect(page.locator('#compare-tilt-b')).toBeEnabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-help-topic="dual"]').click();await expect(page.locator('#context-help')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.locator('[data-help-topic="dual"]')).toBeFocused();
 await page.screenshot({path:info.outputPath('v10-landscape-ja.png'),fullPage:true});
});


test('dual Focus preserves both worlds and has a visible return path on a phone',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');
 await page.locator('#language').selectOption('ja');await page.locator('#compare-toggle').click();
 await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
 const before=await page.locator('#compare-temperature').allTextContents();
 await page.locator('#focus-view').click();
 await expect(page.locator('#compare-controls')).toBeHidden();
 await expect(page.locator('#earth-canvas')).toHaveAttribute('data-view-b',/"tilt":90/);
 await expect(page.locator('#focus-view')).toBeInViewport();
 await page.screenshot({path:info.outputPath('v10-dual-focus-phone-ja.png')});
 await page.keyboard.press('Escape');await expect(page.locator('#compare-controls')).toBeVisible();
 expect(await page.locator('#compare-temperature').allTextContents()).toEqual(before);
});

test('reviewed Japanese comparison panel matches the pinned Chromium image',async({page},info)=>{
 test.skip(info.project.name !== 'chromium', 'Golden font rasterization is pinned to Linux Chromium; WebKit uses behavioural checks.');
 await page.setViewportSize({width:1440,height:1000});await page.goto('/');
 await page.locator('#language').selectOption('ja');await page.locator('#temperature-model').selectOption('illustrative');
 await page.locator('#compare-toggle').click();await expect(page.locator('#compare-status')).toHaveAttribute('data-status','ready');
 await expect(page.locator('#compare-results')).toHaveScreenshot('comparison-panel-ja.png',{maxDiffPixelRatio:0.002,animations:'disabled',scale:'css'});
});
