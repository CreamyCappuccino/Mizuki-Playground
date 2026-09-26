import {test,expect} from '@playwright/test';
import {DEFAULT_FEEDBACK,feedbackFile,feedbackHash} from '../src/feedback/experiment';
async function openLab(page:import('@playwright/test').Page){await page.goto('/feedback-lab.html');await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');await page.locator('#fb-language').selectOption('en');}
async function run(page:import('@playwright/test').Page){await page.locator('#fb-run').click();await expect(page.locator('#fb-status')).toHaveAttribute('data-status','ready',{timeout:60000});}
test('feedback real worker distinguishes warm/cold and off restores a common climate',async({page},info)=>{
 await openLab(page);await run(page);
 const values=await page.locator('[data-mean]').evaluateAll(nodes=>nodes.map(n=>Number((n as HTMLElement).dataset.mean)));
 expect(values[0]).toBeGreaterThan(10);expect(values[1]).toBeLessThan(-30);expect(values).toHaveLength(2);
 await expect(page.locator('.feedback-curve')).toHaveCount(2);await expect(page.locator('#fb-ramp')).toBeVisible();await page.screenshot({path:info.outputPath('v14-feedback-warm-cold.png'),fullPage:true});
 await page.locator('#fb-enabled').selectOption('false');await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');await run(page);
 const off=await page.locator('[data-mean]').evaluateAll(nodes=>nodes.map(n=>Number((n as HTMLElement).dataset.mean)));
 expect(Math.abs(off[0]-off[1])).toBeLessThan(1e-5);await expect(page.locator('#fb-proxy-off')).toBeVisible();
});
test('history retains previous states and revisiting the same multiplier is path dependent',async({page},info)=>{
 await openLab(page);await page.locator('#fb-preset').selectOption('memory');await run(page);
 await expect(page.locator('#fb-selected option')).toHaveCount(5);const first=Number(await page.locator('[data-mean]').getAttribute('data-mean'));
 await page.locator('#fb-selected').selectOption('2');const returned=Number(await page.locator('[data-mean]').getAttribute('data-mean'));
 expect(first).toBeGreaterThan(10);expect(returned).toBeLessThan(-30);
 await page.locator('#fb-history').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('v14-feedback-history.png')});
 await page.locator('#fb-selected').selectOption('4');expect(Number(await page.locator('[data-mean]').getAttribute('data-mean'))).toBeGreaterThan(10);
});
test('portable history is atomic and a restored link does not auto-run',async({page})=>{
 await openLab(page);await run(page);await page.locator('summary[data-fb="share"]').click();
 await page.locator('#fb-json').fill(feedbackFile({...DEFAULT_FEEDBACK,tilt:60}).replace('"version": 1','"version": 99'));await page.locator('#fb-apply').click();
 await expect(page.locator('#fb-tilt')).toHaveValue('23.44');await expect(page.locator('#fb-status')).toHaveAttribute('data-status','ready');
 await page.locator('#fb-json').fill(feedbackFile({...DEFAULT_FEEDBACK,tilt:60}));await page.locator('#fb-apply').click();
 await expect(page.locator('#fb-tilt')).toHaveValue('60');await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');
 await page.goto('/feedback-lab.html'+feedbackHash({...DEFAULT_FEEDBACK,tilt:45}));await expect(page.locator('#fb-tilt')).toHaveValue('45');await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');
 await run(page);
 await page.evaluate(()=>{location.hash='feedback=99&state=invalid';});
 await expect(page.locator('#fb-form-error')).toContainText('Invalid');
 await expect(page.locator('#fb-tilt')).toHaveValue('45');
 await expect(page.locator('#fb-status')).toHaveAttribute('data-status','ready');
 // Two valid same-document edits restore the newest full intent, still paused.
 await page.evaluate(hash=>{location.hash=hash;},feedbackHash({...DEFAULT_FEEDBACK,tilt:30,mode:'path',multipliers:[1,.9,1]}));
 await expect(page.locator('#fb-tilt')).toHaveValue('30');await expect(page.locator('#fb-preset')).toHaveValue('custom');
 await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');await expect(page.locator('[data-mean]')).toHaveCount(0);
 await page.reload();await expect(page.locator('#fb-tilt')).toHaveValue('30');await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');
});
test('Japanese Large remains readable and display sampling does not start another worker',async({page},info)=>{
 await page.setViewportSize({width:390,height:844});
 await page.addInitScript(()=>{const Native=window.Worker;(window as unknown as {fbStarts:number}).fbStarts=0;window.Worker=class extends Native{constructor(url:URL|string,options?:WorkerOptions){super(url,options);(window as unknown as {fbStarts:number}).fbStarts++;}};});
 await openLab(page);await page.locator('#fb-language').selectOption('ja');await page.locator('#fb-large').check();await run(page);
 const starts=await page.evaluate(()=>(window as unknown as {fbStarts:number}).fbStarts);
 await page.locator('#fb-latitude').fill('90');await page.locator('#fb-latitude').press('Tab');await page.locator('#fb-day').evaluate((el)=>{(el as HTMLInputElement).value='365';el.dispatchEvent(new Event('input',{bubbles:true}));});
 expect(await page.evaluate(()=>(window as unknown as {fbStarts:number}).fbStarts)).toBe(starts);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await expect(page.locator('#fb-ramp')).toBeVisible();
 await page.locator('#fb-annual').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('v14-feedback-mobile-ja.png')});
});
test('cancel invalidates visible fields and malformed reply fails explicitly before deliberate retry',async({page})=>{
 await page.addInitScript(()=>{const Native=window.Worker;let first=true;window.Worker=class extends Native{
 constructor(url:URL|string,options?:WorkerOptions){super(url,options);if(String(url).includes('feedback.worker')&&first){first=false;this.postMessage=()=>{setTimeout(()=>this.dispatchEvent(new MessageEvent('message',{data:null})),10);};}}};});
 await openLab(page);await page.locator('#fb-run').click();await expect(page.locator('#fb-status')).toHaveAttribute('data-status','error');await expect(page.locator('[data-mean]')).toHaveCount(0);await run(page);
 await page.locator('#fb-preset').selectOption('sweep');
 // Synchronous DOM clicks test deliberate cancellation before any worker callback.
 await page.evaluate(()=>{document.querySelector<HTMLButtonElement>('#fb-run')!.click();document.querySelector<HTMLButtonElement>('#fb-cancel')!.click();});
 await expect(page.locator('#fb-status')).toHaveAttribute('data-status','canceled');await page.locator('#fb-day').evaluate((el)=>{(el as HTMLInputElement).value='50';el.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#fb-status')).toHaveAttribute('data-status','canceled');await expect(page.locator('[data-mean]')).toHaveCount(0);
 await page.locator('#fb-preset').selectOption('compare');await run(page);
});

test('history presets preserve valid unrun scientific edits and custom factors',async({page})=>{
 await openLab(page);
 await page.locator('#fb-tilt').fill('60');await page.locator('#fb-ecc').fill('0.2');await page.locator('#fb-depth').selectOption('50');
 await page.locator('#fb-preset').selectOption('memory');
 await expect(page.locator('#fb-tilt')).toHaveValue('60');await expect(page.locator('#fb-ecc')).toHaveValue('0.2');await expect(page.locator('#fb-depth')).toHaveValue('50');
 await expect(page.locator('#fb-factors')).toHaveValue('1, 0.9, 1, 1.4, 1');
 await page.locator('#fb-factors').fill('1, 0.8, 1.2');await page.locator('#fb-preset').selectOption('custom');
 await expect(page.locator('#fb-factors')).toHaveValue('1, 0.8, 1.2');
 await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');await expect(page.locator('[data-mean]')).toHaveCount(0);
});

test('an unsettled 80-year history remains inspectable without claiming equilibrium',async({page},info)=>{
 await page.goto('/feedback-lab.html'+feedbackHash({...DEFAULT_FEEDBACK,depth:50,mode:'path',multipliers:[.92,1]}));
 await expect(page.locator('#fb-status')).toHaveAttribute('data-status','idle');await page.locator('#fb-language').selectOption('en');
 await run(page);await expect(page.locator('#fb-unsettled')).toBeVisible();
 await expect(page.locator('#fb-status')).toContainText('not an equilibrium');
 await expect(page.locator('#fb-selected option')).toHaveCount(1);
 await expect(page.locator('#fb-cards')).toContainText('Last simulated year');
 await expect(page.locator('.feedback-curve')).toHaveCount(1);
 await page.locator('#fb-cards').scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath('v14-feedback-unsettled.png')});
});
